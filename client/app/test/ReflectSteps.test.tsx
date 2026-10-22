import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import ReflectEntryPage from "~/components/reflect/ReflectEntryPage";

/**
 * Reflect's B5 steps through the entry page: Feelings and needs (the fold, the
 * cap, when a word commits, the faux offer), the reality check (the shown-back
 * story, the interpretation offer, the pairs), the close and Finish, and the
 * after-entry question. useApi is mocked; the server's rules aren't repeated
 * (they are in the API's integration tests).
 */

let entry: any;
let moveOffer: any = null;
let fauxFor: Record<string, any> = {};
let lastError: string | null = null;
let failSaves = false;
const navigate = vi.fn();
let events: string[] = [];

const WORDS = (ids: string[]) => ids.map((id) => ({ id, label: id }));

const CONTENT = {
  locale: "en",
  reviewStatus: "reviewed",
  prompts: {
    story: { scenePrompt: "SCENE-PROMPT", scenePlaceholder: "ph", storyPrompt: "STORY-PROMPT" },
    feelings: {
      prompt: "FEELINGS-PROMPT",
      whenLabel: "WHEN-LABEL",
      whenPlaceholder: "when she closed the door",
      feelingLabel: "FEELING-LABEL",
      needLabel: "NEED-LABEL",
      metLabel: "MET-LABEL",
      metOptions: { met: "Met", unmet: "Unmet", notSure: "Not sure" },
    },
    reality: { prompt: "REALITY-PROMPT", readingLabel: "READING-LABEL", cameraLabel: "CAMERA-LABEL" },
    close: { prompt: "CLOSE-PROMPT" },
    interpretation: { offerLine: "“{word}” might be a reading.", useLabel: "USE-THIS", dismissLabel: "NOT-THIS" },
  },
  feelings: WORDS(["hurt", "tired", "angry", "sad", "afraid", "lonely"]),
  needs: WORDS(["respect", "rest", "trust", "care", "space"]),
  otherLabel: "other…",
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

const FAUX = {
  position: 0,
  conceptId: "ignored",
  line: "FAUX-LINE",
  feelingHints: ["hurt?", "somethingelse?"],
  needHints: ["respect?"],
  feelingHintsLabel: "the feeling",
  needHintsLabel: "the need",
  dismiss: "leave it",
  note: "your words, your call.",
};

const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  const v = opts?.variables ?? {};
  if (q.includes("query ReflectEntry")) return { reflectEntry: entry };
  if (q.includes("query ReflectContent")) return { reflectContent: CONTENT };
  if (q.includes("mutation SaveReflectEntry")) {
    events.push("save-entry");
    return failSaves ? null : { saveReflectEntry: { id: "e1", step: "X" } };
  }
  if (q.includes("mutation SaveReflectMoment")) {
    events.push(`save-moment:${v.position}`);
    if (failSaves) return null;
    return {
      saveReflectMoment: {
        moment: { id: `m${v.position}`, position: v.position },
        fauxOffer: v.feeling && fauxFor[v.feeling] ? fauxFor[v.feeling] : null,
      },
    };
  }
  if (q.includes("mutation SaveReflectReading")) {
    events.push(`save-reading:${v.position}`);
    return failSaves ? null : { saveReflectReading: { id: `r${v.position}`, position: v.position } };
  }
  if (q.includes("mutation MoveReflectEntry")) {
    events.push(`move:${v.to}`);
    return {
      moveReflectEntry: {
        entry: { ...entry, step: v.to },
        interpretationOffer: v.to === "REALITY" ? moveOffer : null,
      },
    };
  }
  if (q.includes("mutation FinishReflectEntry")) {
    events.push("finish");
    return { finishReflectEntry: { id: "e1", step: "CLOSE" } };
  }
  if (q.includes("mutation AnswerReflectEntry")) {
    events.push("answer");
    return { answerReflectEntry: true };
  }
  return {};
});

const callsTo = (name: string) => mockCall.mock.calls.filter((c) => String(c[0]?.query).includes(`mutation ${name}`));

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall, getLastError: () => lastError }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", dir: () => "ltr" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ state: null }),
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

const moment = (position: number, extra: Record<string, unknown> = {}) => ({
  id: `m${position}`,
  position,
  whenText: null,
  feeling: null,
  feelingSource: null,
  need: null,
  needSource: null,
  met: null,
  ...extra,
});

const reading = (position: number, extra: Record<string, unknown> = {}) => ({
  id: `r${position}`,
  position,
  reading: null,
  camera: null,
  ...extra,
});

beforeEach(() => {
  entry = entryAt("FEELINGS");
  moveOffer = null;
  fauxFor = {};
  lastError = null;
  failSaves = false;
  events = [];
  navigate.mockClear();
  mockCall.mockClear();
});

describe("Feelings and needs: the fold and the cap (AC-11, AC-24, W7)", () => {
  it("opens one blank card with no Add another, and Next with nothing written is the skip", async () => {
    render(<ReflectEntryPage />);
    expect(await screen.findByText("FEELINGS-PROMPT")).toBeTruthy();
    expect(screen.getAllByTestId("reflect-moment-card")).toHaveLength(1);
    // Six feelings, five needs, each palette with other….
    expect(screen.getAllByText("other…")).toHaveLength(2);
    expect(screen.getByText("hurt").getAttribute("dir")).toBe("ltr");
    expect(screen.queryByText("reflect.feelings.addMoment")).toBeNull(); // the first card has no stored row yet
    fireEvent.click(screen.getByText("reflect.nav.next"));
    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(callsTo("SaveReflectMoment")).toHaveLength(0); // nothing written, nothing sent
  });

  it("rebuilds the moments from the entry, the last one open and the earlier ones folded to when · feeling · need", async () => {
    entry = entryAt("FEELINGS", {
      moments: [
        moment(0, { whenText: "when she closed the door", feeling: "hurt", feelingSource: "PALETTE", need: "respect", needSource: "PALETTE" }),
        moment(1, { whenText: "when he laughed", feeling: "angry", feelingSource: "PALETTE" }),
      ],
    });
    render(<ReflectEntryPage />);
    expect(await screen.findByText("when she closed the door · hurt · respect")).toBeTruthy();
    expect(screen.getAllByTestId("reflect-moment-card")).toHaveLength(1);
    expect((screen.getByLabelText("WHEN-LABEL") as HTMLInputElement).value).toBe("when he laughed");
    // The folded row is the only control: a tap reopens it and folds the other.
    fireEvent.click(screen.getByText("when she closed the door · hurt · respect"));
    expect((screen.getByLabelText("WHEN-LABEL") as HTMLInputElement).value).toBe("when she closed the door");
    expect(screen.getByText("when he laughed · angry")).toBeTruthy();
  });

  it("Add another is gone at three, with no message in its place", async () => {
    entry = entryAt("FEELINGS", { moments: [moment(0), moment(1), moment(2)] });
    render(<ReflectEntryPage />);
    await screen.findByText("FEELINGS-PROMPT");
    expect(screen.queryByText("reflect.feelings.addMoment")).toBeNull();
    expect(document.body.textContent).not.toMatch(/three|cap|limit/i);
  });

  it("Add another shows once the card has a stored row, and a new card's first write is the next free position", async () => {
    entry = entryAt("FEELINGS", { moments: [moment(0, { whenText: "w0" })] });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.feelings.addMoment"));
    expect(screen.getAllByTestId("reflect-moment-card")).toHaveLength(1);
    expect(screen.getByText("w0")).toBeTruthy(); // the first folded to a line
    // The new card has no stored row: no second Add another until it is written.
    expect(screen.queryByText("reflect.feelings.addMoment")).toBeNull();
    fireEvent.click(screen.getByText("tired"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(1));
    expect(callsTo("SaveReflectMoment")[0][0].variables.position).toBe(1);
    expect(await screen.findByText("reflect.feelings.addMoment")).toBeTruthy();
  });
});

describe("Feelings and needs: when a word commits (AC-22, AC-23)", () => {
  it("a chip saves at once with its source, and a second tap clears it", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("hurt"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(1));
    expect(callsTo("SaveReflectMoment")[0][0].variables).toEqual({
      entryId: "e1",
      position: 0,
      feeling: "hurt",
      feelingSource: "PALETTE",
    });
    expect(screen.getByText("hurt").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText("hurt"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    expect(callsTo("SaveReflectMoment")[1][0].variables.feeling).toBe("");
    expect(screen.getByText("hurt").getAttribute("aria-pressed")).toBe("false");
  });

  it("Met, Unmet and Not sure save at once, and a second tap clears with an explicit null (AC-23)", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("Unmet"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(1));
    expect(callsTo("SaveReflectMoment")[0][0].variables).toEqual({ entryId: "e1", position: 0, met: "UNMET" });
    fireEvent.click(screen.getByText("Unmet"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    const cleared = callsTo("SaveReflectMoment")[1][0].variables;
    expect(cleared).toEqual({ entryId: "e1", position: 0, met: null });
    expect("met" in cleared).toBe(true);
  });

  it("the when line saves on the pause", async () => {
    render(<ReflectEntryPage />);
    fireEvent.change(await screen.findByLabelText("WHEN-LABEL"), { target: { value: "when she left" } });
    expect(callsTo("SaveReflectMoment")).toHaveLength(0);
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(1), { timeout: 3000 });
    expect(callsTo("SaveReflectMoment")[0][0].variables).toEqual({ entryId: "e1", position: 0, whenText: "when she left" });
  });

  it("an own word is never saved on the pause: only on blur, Enter or flush", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click((await screen.findAllByText("other…"))[0]);
    const own = screen.getByRole("textbox", { name: "FEELING-LABEL" }) as HTMLInputElement;
    expect(own.getAttribute("dir")).toBe("auto");
    expect(own.maxLength).toBe(60);
    fireEvent.change(own, { target: { value: "igno" } });
    await new Promise((r) => setTimeout(r, 1100)); // past the 800 ms pause
    expect(callsTo("SaveReflectMoment")).toHaveLength(0);

    fireEvent.change(own, { target: { value: "ignored" } });
    fireEvent.blur(own);
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(1));
    expect(callsTo("SaveReflectMoment")[0][0].variables).toEqual({
      entryId: "e1",
      position: 0,
      feeling: "ignored",
      feelingSource: "OWN",
    });

    // Enter commits too.
    fireEvent.click(screen.getAllByText("other…")[1]);
    const need = screen.getByRole("textbox", { name: "NEED-LABEL" }) as HTMLInputElement;
    fireEvent.change(need, { target: { value: "to be heard" } });
    fireEvent.keyDown(need, { key: "Enter" });
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    expect(callsTo("SaveReflectMoment")[1][0].variables).toMatchObject({ need: "to be heard", needSource: "OWN" });
  });

  it("Next flushes an own word still being typed, before the move", async () => {
    render(<ReflectEntryPage />);
    fireEvent.click((await screen.findAllByText("other…"))[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "FEELING-LABEL" }), { target: { value: "flat" } });
    fireEvent.click(screen.getByText("reflect.nav.next"));
    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(events).toEqual(["save-moment:0", "move:REALITY"]);
  });
});

describe("the faux-feeling offer (AC-25, PD-9)", () => {
  async function surface() {
    fauxFor = { ignored: FAUX };
    render(<ReflectEntryPage />);
    fireEvent.click((await screen.findAllByText("other…"))[0]);
    const own = screen.getByRole("textbox", { name: "FEELING-LABEL" });
    fireEvent.change(own, { target: { value: "ignored" } });
    fireEvent.blur(own);
    return await screen.findByTestId("reflect-faux-offer");
  }

  it("sits inside its moment, and Keep mine hides it with nothing sent", async () => {
    const offer = await surface();
    expect(within(offer).getByText("FAUX-LINE")).toBeTruthy();
    const before = mockCall.mock.calls.length;
    fireEvent.click(within(offer).getByText("reflect.faux.keepMine"));
    expect(screen.queryByTestId("reflect-faux-offer")).toBeNull();
    expect(mockCall.mock.calls.length).toBe(before);
  });

  it("Use one shows the hints, and a hint in the palette is saved with the palette source", async () => {
    const offer = await surface();
    expect(within(offer).queryByText("hurt?")).toBeNull();
    fireEvent.click(within(offer).getByText("reflect.faux.useOne"));
    expect(within(offer).getByText("hurt?").getAttribute("dir")).toBe("ltr");
    fireEvent.click(within(offer).getByText("hurt?"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    expect(callsTo("SaveReflectMoment")[1][0].variables).toEqual({
      entryId: "e1",
      position: 0,
      feeling: "hurt",
      feelingSource: "PALETTE",
    });
    expect(screen.queryByTestId("reflect-faux-offer")).toBeNull();
  });

  it("a hint that is not a palette word is saved as the person's own", async () => {
    const offer = await surface();
    fireEvent.click(within(offer).getByText("reflect.faux.useOne"));
    fireEvent.click(within(offer).getByText("somethingelse?"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    expect(callsTo("SaveReflectMoment")[1][0].variables).toMatchObject({ feeling: "somethingelse", feelingSource: "OWN" });
  });

  it("goes when the feeling changes under it: a chip tapped as the own word's field loses focus (verify B5)", async () => {
    fauxFor = { ignored: FAUX };
    render(<ReflectEntryPage />);
    fireEvent.click((await screen.findAllByText("other…"))[0]);
    const own = screen.getByRole("textbox", { name: "FEELING-LABEL" });
    fireEvent.change(own, { target: { value: "ignored" } });
    // A real tap on a chip blurs the field at mousedown, so the own word is sent, then the chip's click.
    fireEvent.blur(own);
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.click(screen.getByText("hurt"));
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    expect(callsTo("SaveReflectMoment")[1][0].variables).toMatchObject({ feeling: "hurt", feelingSource: "PALETTE" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("reflect-faux-offer")).toBeNull();
  });

  it("stays when the same word is committed again", async () => {
    await surface();
    const own = screen.getByRole("textbox", { name: "FEELING-LABEL" });
    fireEvent.change(own, { target: { value: "ignoredx" } });
    fireEvent.change(own, { target: { value: "ignored" } });
    fireEvent.keyDown(own, { key: "Enter" });
    await waitFor(() => expect(callsTo("SaveReflectMoment")).toHaveLength(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("reflect-faux-offer")).toBeTruthy();
  });

  it("is dropped on any move (G11)", async () => {
    await surface();
    fireEvent.click(screen.getByText("reflect.nav.back"));
    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(screen.queryByTestId("reflect-faux-offer")).toBeNull();
  });
});

describe("Back (G2, PD-6)", () => {
  it("Feelings goes back to the story, Reality to Feelings, Close to Reality, each after a flush", async () => {
    entry = entryAt("FEELINGS");
    const { unmount } = render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.back"));
    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(callsTo("MoveReflectEntry")[0][0].variables).toEqual({ entryId: "e1", to: "STORY" });
    unmount();

    mockCall.mockClear();
    entry = entryAt("REALITY");
    const second = render(<ReflectEntryPage />);
    const camera = await screen.findByLabelText("CAMERA-LABEL");
    fireEvent.change(camera, { target: { value: "she put the bag down" } });
    fireEvent.click(screen.getByText("reflect.nav.back")); // inside the 800 ms pause
    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(events.slice(-2)).toEqual(["save-reading:0", "move:FEELINGS"]);
    second.unmount();

    mockCall.mockClear();
    entry = entryAt("CLOSE");
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.back"));
    await waitFor(() => expect(callsTo("MoveReflectEntry")).toHaveLength(1));
    expect(callsTo("MoveReflectEntry")[0][0].variables).toEqual({ entryId: "e1", to: "REALITY" });
  });

  it("Back sits at the start of the footer and Next at the end, on all three steps (W2)", async () => {
    for (const step of ["FEELINGS", "REALITY"]) {
      entry = entryAt(step, step === "REALITY" ? { story: "x" } : {});
      const { unmount } = render(<ReflectEntryPage />);
      const back = await screen.findByText("reflect.nav.back");
      const next = screen.getByText("reflect.nav.next");
      expect(back.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(back.parentElement).toBe(next.parentElement);
      expect(back.parentElement!.firstElementChild).toBe(back);
      expect(back.parentElement!.lastElementChild).toBe(next);
      unmount();
    }
    entry = entryAt("CLOSE");
    render(<ReflectEntryPage />);
    const back = await screen.findByText("reflect.nav.back");
    const finish = screen.getByText("reflect.nav.finish");
    expect(back.parentElement!.firstElementChild).toBe(back);
    expect(back.parentElement!.lastElementChild).toBe(finish);
  });

  it("the story and the pre-check still have no Back", async () => {
    entry = entryAt("STORY");
    render(<ReflectEntryPage />);
    await screen.findByLabelText("SCENE-PROMPT");
    expect(screen.queryByText("reflect.nav.back")).toBeNull();
  });
});

describe("the reality check (AC-27, AC-30, W9, W10, W11)", () => {
  const STORY = "She always does this when we visit.\nI said hello.";

  it("shows the story back read-only, folded, and a tap anywhere on it only toggles it; the word is never marked", async () => {
    moveOffer = { word: "always", sentence: "She always does this when we visit." };
    entry = entryAt("FEELINGS", { story: STORY });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.next"));
    const shown = await screen.findByTestId("reflect-story-shown");
    const text = shown.querySelector("p")!;
    expect(text.getAttribute("dir")).toBe("auto");
    expect(text.className).toContain("line-clamp-3");
    expect(shown.querySelector("mark, strong, em, span")).toBeNull();
    expect(text.textContent).toBe(STORY);
    expect(screen.getByText("reflect.reality.showAll")).toBeTruthy();
    fireEvent.click(text); // anywhere on it
    expect(text.className).not.toContain("line-clamp-3");
    expect(screen.getByText("reflect.reality.showLess")).toBeTruthy();
    fireEvent.click(screen.getByText("reflect.reality.showLess")); // the keyboard's button: one toggle, not two
    expect(text.className).toContain("line-clamp-3");
    expect(callsTo("SaveReflectReading")).toHaveLength(0);
  });

  it("shows the offer above the pairs with the word isolated, and Not this one sends nothing", async () => {
    moveOffer = { word: "always", sentence: "She always does this when we visit." };
    entry = entryAt("FEELINGS", { story: STORY });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.next"));
    const offer = await screen.findByTestId("reflect-interpretation-offer");
    expect(offer.querySelector("bdi")!.getAttribute("dir")).toBe("ltr");
    expect(offer.querySelector("bdi")!.textContent).toBe("always");
    const pairs = screen.getByTestId("reflect-pairs");
    expect(offer.compareDocumentPosition(pairs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const before = mockCall.mock.calls.length;
    fireEvent.click(within(offer).getByText("NOT-THIS"));
    expect(screen.queryByTestId("reflect-interpretation-offer")).toBeNull();
    expect(mockCall.mock.calls.length).toBe(before);
  });

  it("Use this fills the first empty reading with the sentence, saves it, and moves focus to that pair's camera half", async () => {
    moveOffer = { word: "always", sentence: "She always does this when we visit." };
    entry = entryAt("FEELINGS", { story: STORY });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.next"));
    fireEvent.click(await screen.findByText("USE-THIS"));
    expect((screen.getByLabelText("READING-LABEL") as HTMLInputElement).value).toBe("She always does this when we visit.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("CAMERA-LABEL")));
    expect(screen.queryByTestId("reflect-interpretation-offer")).toBeNull();
    await waitFor(() => expect(callsTo("SaveReflectReading")).toHaveLength(1));
    expect(callsTo("SaveReflectReading")[0][0].variables).toEqual({
      entryId: "e1",
      position: 0,
      reading: "She always does this when we visit.",
    });
  });

  it("Use this skips a pair whose reading is written, and takes the next empty one at the next free position", async () => {
    moveOffer = { word: "always", sentence: "Second sentence." };
    entry = entryAt("FEELINGS", { story: STORY, readings: [reading(0, { reading: "mine" })] });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.next"));
    fireEvent.click(await screen.findByText("USE-THIS"));
    await waitFor(() => expect(callsTo("SaveReflectReading")).toHaveLength(1));
    expect(callsTo("SaveReflectReading")[0][0].variables.position).toBe(1);
    expect((screen.getAllByLabelText("READING-LABEL")[0] as HTMLInputElement).value).toBe("mine");
    expect((screen.getAllByLabelText("READING-LABEL")[1] as HTMLInputElement).value).toBe("Second sentence.");
  });

  it("dims the pairs while the move that opens the step is out, and leaves them usable after", async () => {
    let release: () => void = () => {};
    entry = entryAt("FEELINGS", { story: STORY });
    const base = mockCall.getMockImplementation()!;
    mockCall.mockImplementationOnce(base); // ReflectEntry
    mockCall.mockImplementationOnce(base); // ReflectContent
    render(<ReflectEntryPage />);
    const next = await screen.findByText("reflect.nav.next");
    mockCall.mockImplementationOnce(async (o: any) => {
      await new Promise<void>((r) => (release = r));
      return base(o);
    });
    fireEvent.click(next);
    const pairs = await screen.findByTestId("reflect-pairs");
    expect(pairs.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByLabelText("READING-LABEL") as HTMLInputElement).disabled).toBe(true);
    release();
    await waitFor(() => expect(screen.getByTestId("reflect-pairs").getAttribute("aria-busy")).toBe("false"));
    expect((screen.getByLabelText("READING-LABEL") as HTMLInputElement).disabled).toBe(false);
  });

  it("has no offer after a reload (the move result carried none), and Add another is gone at three pairs", async () => {
    entry = entryAt("REALITY", { story: STORY, readings: [reading(0), reading(1), reading(2)] });
    render(<ReflectEntryPage />);
    await screen.findAllByLabelText("READING-LABEL");
    expect(screen.queryByTestId("reflect-interpretation-offer")).toBeNull();
    expect(screen.getAllByLabelText("READING-LABEL")).toHaveLength(3);
    expect(screen.queryByText("reflect.reality.addPair")).toBeNull();
  });

  it("Add another waits for a stored pair, then adds a pair that writes at the next free position", async () => {
    entry = entryAt("REALITY", { story: STORY, readings: [reading(0, { reading: "r0" })] });
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.reality.addPair"));
    expect(screen.getAllByLabelText("READING-LABEL")).toHaveLength(2);
    expect(screen.queryByText("reflect.reality.addPair")).toBeNull();
    fireEvent.change(screen.getAllByLabelText("CAMERA-LABEL")[1], { target: { value: "he said hello" } });
    await waitFor(() => expect(callsTo("SaveReflectReading")).toHaveLength(1), { timeout: 3000 });
    expect(callsTo("SaveReflectReading")[0][0].variables).toEqual({ entryId: "e1", position: 1, camera: "he said hello" });
    expect(await screen.findByText("reflect.reality.addPair")).toBeTruthy();
  });

  it("gives the pairs and the shown-back story a direction of their own (G7)", async () => {
    entry = entryAt("REALITY", { story: "x", readings: [reading(0)] });
    render(<ReflectEntryPage />);
    expect((await screen.findByLabelText("READING-LABEL")).getAttribute("dir")).toBe("auto");
    expect(screen.getByLabelText("CAMERA-LABEL").getAttribute("dir")).toBe("auto");
  });
});

describe("the close, Finish and after the entry (AC-33, AC-34, AC-35)", () => {
  it("shows one field and Finish, never disabled, and Finish with it empty finishes", async () => {
    entry = entryAt("CLOSE");
    render(<ReflectEntryPage />);
    await screen.findByLabelText("CLOSE-PROMPT");
    const finish = screen.getByText("reflect.nav.finish") as HTMLButtonElement;
    expect(finish.disabled).toBe(false);
    expect(screen.queryByText("reflect.nav.next")).toBeNull();
    fireEvent.click(finish);
    await waitFor(() => expect(callsTo("FinishReflectEntry")).toHaveLength(1));
    expect(callsTo("SaveReflectEntry")).toHaveLength(0);
  });

  it("flushes the close text, then finishes, then replaces the history state and shows the question", async () => {
    entry = entryAt("CLOSE");
    render(<ReflectEntryPage />);
    fireEvent.change(await screen.findByLabelText("CLOSE-PROMPT"), { target: { value: "it was smaller" } });
    fireEvent.click(screen.getByText("reflect.nav.finish"));
    await screen.findByText("reflect.after.differently");
    expect(events).toEqual(["save-entry", "finish"]);
    expect(callsTo("SaveReflectEntry")[0][0].variables).toEqual({ entryId: "e1", close: "it was smaller" });
    expect(navigate).toHaveBeenCalledWith(".", { replace: true, state: { finished: true } });
    // Three answers in the spec's order, Skip, and no Stop here or Back (W12).
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["reflect.after.differently", "reflect.after.same", "reflect.after.moreCaughtUp", "reflect.after.skip"]);
  });

  async function atQuestion() {
    entry = entryAt("CLOSE");
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("reflect.nav.finish"));
    await screen.findByText("reflect.after.skip");
  }

  it("an answer is sent once however it is tapped, and then the done line shows with no number on it", async () => {
    await atQuestion();
    // All three taps land before React has re-rendered: the shared lock lets only the first through.
    const same = screen.getByText("reflect.after.same");
    const skip = screen.getByText("reflect.after.skip");
    act(() => {
      same.click();
      same.click();
      skip.click();
    });
    await screen.findByText("reflect.after.done");
    expect(callsTo("AnswerReflectEntry")).toHaveLength(1);
    expect(callsTo("AnswerReflectEntry")[0][0].variables).toEqual({ entryId: "e1", answer: "SAME" });
    expect(document.body.textContent).not.toMatch(/\d/);
    fireEvent.click(screen.getByText("reflect.after.back"));
    expect(navigate).toHaveBeenCalledWith("/tools/reflect");
  });

  it("two quick taps on different answers send only the first", async () => {
    await atQuestion();
    const buttons = screen.getAllByRole("button");
    act(() => {
      buttons[0].click();
      buttons[2].click();
    });
    await screen.findByText("reflect.after.done");
    expect(callsTo("AnswerReflectEntry")).toHaveLength(1);
    expect(callsTo("AnswerReflectEntry")[0][0].variables.answer).toBe("DIFFERENTLY");
  });

  it("Skip stores nothing and goes to the done line", async () => {
    await atQuestion();
    fireEvent.click(screen.getByText("reflect.after.skip"));
    await screen.findByText("reflect.after.done");
    expect(callsTo("AnswerReflectEntry")).toHaveLength(0);
  });
});

describe("a write refused as closed (B4's Owed)", () => {
  it("leaves for the home with replace, on a save, a move and a finish", async () => {
    lastError = "This entry is closed.";
    // a save
    entry = entryAt("FEELINGS");
    failSaves = true;
    const a = render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("hurt"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect", { replace: true }));
    a.unmount();

    // a move
    navigate.mockClear();
    failSaves = false;
    mockCall.mockImplementationOnce(async () => ({ reflectEntry: entry }));
    mockCall.mockImplementationOnce(async () => ({ reflectContent: CONTENT }));
    const b = render(<ReflectEntryPage />);
    const next = await screen.findByText("reflect.nav.next");
    mockCall.mockImplementationOnce(async () => null);
    fireEvent.click(next);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect", { replace: true }));
    b.unmount();

    // a finish
    navigate.mockClear();
    entry = entryAt("CLOSE");
    mockCall.mockImplementationOnce(async () => ({ reflectEntry: entry }));
    mockCall.mockImplementationOnce(async () => ({ reflectContent: CONTENT }));
    render(<ReflectEntryPage />);
    const finish = await screen.findByText("reflect.nav.finish");
    mockCall.mockImplementationOnce(async () => null);
    fireEvent.click(finish);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect", { replace: true }));
  });

  it("any other failure still shows the line and stays", async () => {
    lastError = "Something else";
    failSaves = true;
    render(<ReflectEntryPage />);
    fireEvent.click(await screen.findByText("hurt"));
    expect(await screen.findByText("reflect.notSaved")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
