import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReflectEntryPage from "~/components/reflect/ReflectEntryPage";
import { holdsWrittenText } from "~/components/reflect/types";

/**
 * Reflect's entry page: the pre-check's advisory swap and its clearing, what
 * leaving the pre-check sends, G5's hidden delete, and a failed save holding
 * Next and Stop here. useApi is mocked and the server's rules aren't repeated.
 */

let lang = "en";
let entry: any;
let stopped: any;
let saveOk = true;
let saveDelay = 0;
// What the server saw, in the order it saw it: a save counts when it finishes, a move or a stop when it arrives.
let events: string[] = [];
const navigate = vi.fn();

const CONTENT = {
  locale: "en",
  reviewStatus: "reviewed",
  prompts: { story: { scenePrompt: "SCENE-PROMPT", scenePlaceholder: "ph", storyPrompt: "STORY-PROMPT" } },
  limits: {
    scene: 140,
    story: 5000,
    storySoftLine: 1500,
    whenText: 280,
    reading: 280,
    camera: 280,
    ownWord: 60,
    close: 1000,
    momentsCap: 3,
    readingsCap: 3,
  },
};

const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("query ReflectEntry")) return { reflectEntry: entry };
  if (q.includes("query ReflectContent")) return { reflectContent: CONTENT };
  if (q.includes("mutation SaveReflectEntry")) {
    if (saveDelay) await new Promise((r) => setTimeout(r, saveDelay));
    events.push("save-done");
    return saveOk ? { saveReflectEntry: { id: "e1", step: "X" } } : null;
  }
  if (q.includes("mutation MoveReflectEntry")) {
    events.push("move");
    return { moveReflectEntry: { entry: { ...entry, step: opts.variables.to } } };
  }
  if (q.includes("mutation StopReflectEntry")) {
    events.push("stop");
    return { stopReflectEntry: stopped };
  }
  if (q.includes("mutation DeleteReflectEntry")) return { deleteReflectEntry: true };
  return {};
});

const opNames = () =>
  mockCall.mock.calls
    .map((c) => /(?:query|mutation) (\w+)/.exec(String(c[0]?.query))?.[1])
    .filter((n) => n && n !== "ReflectEntry" && n !== "ReflectContent");
const callsTo = (name: string) => mockCall.mock.calls.filter((c) => String(c[0]?.query).includes(`mutation ${name}`));

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && Object.keys(opts).length ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: lang, dir: () => (lang === "fa" ? "rtl" : "ltr") },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children }: any) => <a href={typeof to === "string" ? to : "#"}>{children}</a>,
}));

function entryAt(step: string, extra: Record<string, unknown> = {}) {
  return {
    id: "e1",
    step,
    scene: null,
    story: null,
    close: null,
    createdAt: "2031-03-04T10:00:00.000Z",
    moments: [],
    readings: [],
    ...extra,
  };
}

beforeEach(() => {
  lang = "en";
  saveOk = true;
  saveDelay = 0;
  events = [];
  entry = entryAt("PRECHECK");
  stopped = entryAt("PRECHECK");
  navigate.mockClear();
  mockCall.mockClear();
});

describe("holdsWrittenText (AC-56)", () => {
  it("is false for an empty entry and true for any one written field", () => {
    expect(holdsWrittenText(entryAt("PRECHECK") as any)).toBe(false);
    expect(holdsWrittenText(entryAt("STORY", { scene: "" }) as any)).toBe(false);
    expect(holdsWrittenText(entryAt("STORY", { scene: "kitchen" }) as any)).toBe(true);
    expect(holdsWrittenText(entryAt("STORY", { close: "x" }) as any)).toBe(true);
    expect(
      holdsWrittenText(
        entryAt("FEELINGS", { moments: [{ id: "m", position: 0, whenText: null, feeling: "sad", need: null }] }) as any
      )
    ).toBe(true);
    expect(
      holdsWrittenText(
        entryAt("REALITY", { readings: [{ id: "r", position: 0, reading: null, camera: "she left" }] }) as any
      )
    ).toBe(true);
  });
});

describe("the pre-check", () => {
  it("shows the advisory in place of Next when a trigger answer is tapped, and clears it on a second tap (W4)", async () => {
    render(<ReflectEntryPage />);
    expect(await screen.findByText("reflect.nav.next")).toBeTruthy();
    expect(screen.queryByText("reflect.precheck.advisory")).toBeNull();

    fireEvent.click(screen.getByText("reflect.precheck.when.days"));
    expect(screen.getByText("reflect.precheck.advisory")).toBeTruthy();
    expect(screen.getByText("reflect.precheck.notNow")).toBeTruthy();
    expect(screen.getByText("reflect.precheck.keepGoing")).toBeTruthy();
    expect(screen.queryByText("reflect.nav.next")).toBeNull();

    fireEvent.click(screen.getByText("reflect.precheck.when.days")); // second tap clears
    expect(screen.queryByText("reflect.precheck.advisory")).toBeNull();
    expect(screen.getByText("reflect.nav.next")).toBeTruthy();

    // "Yes" is the other trigger; a non-trigger answer shows nothing.
    fireEvent.click(screen.getByText("reflect.precheck.when.longer"));
    expect(screen.queryByText("reflect.precheck.advisory")).toBeNull();
    fireEvent.click(screen.getByText("reflect.precheck.before.yes"));
    expect(screen.getByText("reflect.precheck.advisory")).toBeTruthy();
    fireEvent.click(screen.getByText("reflect.precheck.before.yes"));
    expect(screen.getByText("reflect.nav.next")).toBeTruthy();
  });

  it("has no Back, and Stop here sits in the bar", async () => {
    render(<ReflectEntryPage />);
    await screen.findByText("reflect.nav.next");
    expect(screen.queryByText("reflect.nav.back")).toBeNull();
    expect(screen.getByText("reflect.nav.stop")).toBeTruthy();
  });

  it("leaving it sends one save with the answers, then the move to the story (PD-6)", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.precheck.when.weeks"));
    fireEvent.click(screen.getByText("reflect.precheck.before.no"));
    fireEvent.click(screen.getByText("reflect.nav.next"));

    expect(await screen.findByText("STORY-PROMPT")).toBeTruthy();
    expect(opNames()).toEqual(["SaveReflectEntry", "MoveReflectEntry"]);
    expect(callsTo("SaveReflectEntry")[0][0].variables).toEqual({
      entryId: "e1",
      precheckWhen: "WEEKS",
      precheckBefore: "NO",
    });
    expect(callsTo("MoveReflectEntry")[0][0].variables).toEqual({ entryId: "e1", to: "STORY" });
  });

  it("sends the save even when both answers are blank", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.next"));
    await screen.findByText("STORY-PROMPT");
    expect(callsTo("SaveReflectEntry")[0][0].variables).toEqual({
      entryId: "e1",
      precheckWhen: null,
      precheckBefore: null,
    });
  });

  it("Not now saves the answers, stops, and the calm close hides Delete when nothing was written (G5)", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.precheck.when.days"));
    fireEvent.click(screen.getByText("reflect.precheck.notNow"));

    expect(await screen.findByText("reflect.calmClose.back")).toBeTruthy();
    expect(opNames()).toEqual(["SaveReflectEntry", "StopReflectEntry"]);
    expect(screen.queryByText("reflect.calmClose.delete")).toBeNull();
    expect(screen.queryByText("reflect.calmClose.kept")).toBeNull();

    fireEvent.click(screen.getByText("reflect.calmClose.back"));
    expect(navigate).toHaveBeenCalledWith("/tools/reflect");
  });
});

describe("the calm close after Stop here", () => {
  it("offers Delete and the kept line when the entry holds text, behind a confirm, and lands on the home (G9)", async () => {
    entry = entryAt("STORY", { scene: "kitchen" });
    stopped = entryAt("STORY", { scene: "kitchen" });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.stop"));

    expect(await screen.findByText("reflect.calmClose.kept")).toBeTruthy();
    fireEvent.click(screen.getByText("reflect.calmClose.delete"));
    // The dialog's own Cancel and Delete: Cancel removes nothing.
    fireEvent.click(await screen.findByText("common.cancel"));
    expect(callsTo("DeleteReflectEntry")).toHaveLength(0);

    fireEvent.click(screen.getByText("reflect.calmClose.delete"));
    fireEvent.click(await screen.findByText("common.delete"));
    await waitFor(() => expect(callsTo("DeleteReflectEntry")).toHaveLength(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect", { replace: true }));
  });

  it("reads what the calm close offers from the stopped entry, not from the page", async () => {
    entry = entryAt("STORY");
    stopped = entryAt("STORY"); // the server holds nothing, whatever was typed
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.stop"));
    await screen.findByText("reflect.calmClose.back");
    expect(screen.queryByText("reflect.calmClose.delete")).toBeNull();
  });
});

describe("the story and autosave", () => {
  it("sends a field alone after the pause, and shows nothing while it saves (W6)", async () => {
    entry = entryAt("STORY");
    render(<ReflectEntryPage />);
    const story = (await screen.findByLabelText("STORY-PROMPT")) as HTMLTextAreaElement;
    expect(story.getAttribute("dir")).toBe("auto");
    expect(story.maxLength).toBe(5000);
    fireEvent.change(story, { target: { value: "She said no." } });
    expect(callsTo("SaveReflectEntry")).toHaveLength(0); // not yet: 800 ms
    await waitFor(() => expect(callsTo("SaveReflectEntry")).toHaveLength(1), { timeout: 3000 });
    expect(callsTo("SaveReflectEntry")[0][0].variables).toEqual({ entryId: "e1", story: "She said no." });
    expect(screen.queryByText("reflect.notSaved")).toBeNull();
  });

  it("flushes the text being typed before the move is sent (D-15)", async () => {
    entry = entryAt("STORY");
    saveDelay = 100; // a slow save: the move must still wait for it
    render(<ReflectEntryPage />);
    const scene = (await screen.findByLabelText("SCENE-PROMPT")) as HTMLInputElement;
    expect(scene.getAttribute("dir")).toBe("auto");
    fireEvent.change(scene, { target: { value: "My sister's kitchen" } });
    fireEvent.click(screen.getByText("reflect.nav.next")); // well inside the 800 ms pause

    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(events).toEqual(["save-done", "move"]);
    expect(callsTo("SaveReflectEntry")[0][0].variables).toEqual({ entryId: "e1", scene: "My sister's kitchen" });
  });

  it("Stop here saves the field being typed before it stops", async () => {
    entry = entryAt("STORY");
    saveDelay = 100;
    render(<ReflectEntryPage />);
    fireEvent.change(await screen.findByLabelText("STORY-PROMPT"), { target: { value: "half a sentence" } });
    fireEvent.click(screen.getByText("reflect.nav.stop"));
    await screen.findByText("reflect.calmClose.back");
    expect(events).toEqual(["save-done", "stop"]);
  });

  it("a failed save keeps the text, shows the not-saved line, and holds Next and Stop here until it saves (G3)", async () => {
    entry = entryAt("STORY");
    saveOk = false;
    render(<ReflectEntryPage />);
    const story = (await screen.findByLabelText("STORY-PROMPT")) as HTMLTextAreaElement;
    fireEvent.change(story, { target: { value: "kept in the page" } });

    expect(await screen.findByText("reflect.notSaved", undefined, { timeout: 3000 })).toBeTruthy();
    expect(story.value).toBe("kept in the page");
    expect((screen.getByText("reflect.nav.next") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("reflect.nav.stop") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText("reflect.nav.next")); // disabled: nothing is sent
    expect(callsTo("MoveReflectEntry")).toHaveLength(0);

    saveOk = true;
    fireEvent.click(screen.getByText("reflect.tryAgain"));
    await waitFor(() => expect(screen.queryByText("reflect.notSaved")).toBeNull());
    expect((screen.getByText("reflect.nav.next") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText("reflect.nav.stop") as HTMLButtonElement).disabled).toBe(false);
    // The retry sent the same text.
    const last = callsTo("SaveReflectEntry").at(-1)![0];
    expect(last.variables).toEqual({ entryId: "e1", story: "kept in the page" });
  });

  it("past the soft line one sentence appears, and no counter does (AC-20, AC-44)", async () => {
    entry = entryAt("STORY");
    render(<ReflectEntryPage />);
    const story = await screen.findByLabelText("STORY-PROMPT");
    expect(screen.queryByText("reflect.story.softLine")).toBeNull();
    fireEvent.change(story, { target: { value: "a".repeat(1501) } });
    expect(screen.getByText("reflect.story.softLine")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/1501|1,500|5000/);
  });

  it("at the bound the page says so in one sentence, with no number (AC-51)", async () => {
    entry = entryAt("STORY");
    render(<ReflectEntryPage />);
    const scene = await screen.findByLabelText("SCENE-PROMPT");
    fireEvent.change(scene, { target: { value: "x".repeat(140) } });
    expect(screen.getByText("reflect.bound")).toBeTruthy();
  });
});

describe("the entry route", () => {
  it("goes to the home when no entry is open (G15)", async () => {
    entry = null;
    render(<ReflectEntryPage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect", { replace: true }));
  });

  it("shows the banner on the first step, and not after the person moves on (G17)", async () => {
    lang = "fa";
    render(<ReflectEntryPage />);
    expect(await screen.findByTestId("reflect-banner")).toBeTruthy();
    fireEvent.click(screen.getByText("reflect.nav.next"));
    await screen.findByText("STORY-PROMPT");
    expect(screen.queryByTestId("reflect-banner")).toBeNull();
  });

  it("shows no banner in the practice locale with a reviewed pack", async () => {
    render(<ReflectEntryPage />);
    await screen.findByText("reflect.nav.next");
    expect(screen.queryByTestId("reflect-banner")).toBeNull();
  });
});
