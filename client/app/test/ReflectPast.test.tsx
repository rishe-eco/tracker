import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReflectPastListPage from "~/components/reflect/ReflectPastListPage";
import ReflectPastEntryPage from "~/components/reflect/ReflectPastEntryPage";

/**
 * Past entries: a row is one link and nothing else (AC-38), the empty line has
 * no digit (AC-62), the not-found screen is the same for every cause (AC-61),
 * parts never written are left out and nothing marks an entry as stopped
 * (AC-39, AC-60), and a delete lands on the list without a way back to the
 * entry (AC-40). useApi is mocked; the rules are in the API's tests.
 */

let page: any;
let olderPage: any;
let entry: any;
let lastError: string | null = null;
let deleteOk = true;

const navigate = vi.fn();
const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  lastError = null;
  if (q.includes("query ReflectPastEntries")) {
    return opts.variables?.before ? { reflectPastEntries: olderPage } : { reflectPastEntries: page };
  }
  if (q.includes("query ReflectPastEntry")) {
    if (entry == null) {
      lastError = "Not found";
      return null;
    }
    if (entry === "broken") {
      lastError = "Network error";
      return null;
    }
    return { reflectPastEntry: entry };
  }
  if (q.includes("mutation DeleteReflectEntry")) return deleteOk ? { deleteReflectEntry: true } : null;
  return {};
});

// Stable between renders, as the real hook's are: the pages' loaders depend on them.
const getLastError = () => lastError;
const api = { call: mockCall, getLastError };
vi.mock("~/api/useApi", () => ({ useApi: () => api }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", dir: () => "ltr" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: "e1" }),
  Link: ({ to, children, className }: any) => (
    <a href={typeof to === "string" ? to : "#"} className={className}>
      {children}
    </a>
  ),
}));

const row = (id: string, firstWriting: string) => ({ id, createdAt: "2031-03-04T10:00:00.000Z", firstWriting });

function entryWith(partial: Partial<any> = {}) {
  return {
    id: "e1",
    scene: null,
    story: null,
    close: null,
    createdAt: "2031-03-04T10:00:00.000Z",
    moments: [],
    readings: [],
    ...partial,
  };
}

beforeEach(() => {
  page = { rows: [row("a", "Argument at the bus stop"), row("b", "")], hasOlder: false };
  olderPage = { rows: [row("c", "An older one")], hasOlder: false };
  entry = entryWith({ scene: "the bus stop" });
  lastError = null;
  deleteOk = true;
  navigate.mockClear();
  mockCall.mockClear();
});

describe("Past entries list", () => {
  it("shows placeholders while loading, then a row that is one link and nothing else", async () => {
    render(<ReflectPastListPage />);
    expect(screen.getByTestId("reflect-past-loading")).toBeTruthy();
    const label = await screen.findByText("Argument at the bus stop");
    expect(screen.queryByTestId("reflect-past-loading")).toBeNull();
    const link = label.closest("a")!;
    expect(link.getAttribute("href")).toBe("/tools/reflect/past/a");
    expect(link.querySelector("button, input, a")).toBeNull();
    expect(label.getAttribute("dir")).toBe("auto");
    // Nothing else is a control: two rows, two links, and no Show older.
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the empty list is one plain line with no digit, and a way back to Reflect (AC-62)", async () => {
    page = { rows: [], hasOlder: false };
    render(<ReflectPastListPage />);
    const line = await screen.findByText("reflect.past.empty");
    expect(line.textContent).not.toMatch(/\d/);
    expect(screen.getByText("reflect.past.backToReflect").closest("a")!.getAttribute("href")).toBe("/tools/reflect");
  });

  it("Show older passes the last row's id as before and appends", async () => {
    page = { rows: [row("a", "first"), row("b", "second")], hasOlder: true };
    render(<ReflectPastListPage />);
    fireEvent.click(await screen.findByText("reflect.past.showOlder"));
    expect(await screen.findByText("An older one")).toBeTruthy();
    const older = mockCall.mock.calls.find((c) => c[0]?.variables?.before)!;
    expect(older[0].variables).toEqual({ before: "b" });
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.queryByText("reflect.past.showOlder")).toBeNull();
  });

  it("a failed load says so plainly, with Try again", async () => {
    page = undefined;
    render(<ReflectPastListPage />);
    expect(await screen.findByText("reflect.errors.couldNotLoad")).toBeTruthy();
    expect(screen.getByText("reflect.tryAgain")).toBeTruthy();
  });
});

describe("One past entry", () => {
  it("leaves out the parts never written, marks nothing as stopped, and shows no pre-check or answer", async () => {
    entry = entryWith({
      scene: "the bus stop",
      moments: [
        { id: "m1", position: 0, whenText: "when he turned away", feeling: null, feelingSource: null, need: null, needSource: null, met: null },
        { id: "m2", position: 1, whenText: null, feeling: null, feelingSource: null, need: null, needSource: null, met: null },
      ],
    });
    render(<ReflectPastEntryPage />);
    expect(await screen.findByText("the bus stop")).toBeTruthy();
    expect(screen.getByText("reflect.past.scene")).toBeTruthy();
    expect(screen.getByText("when he turned away").getAttribute("dir")).toBe("auto");
    expect(screen.getByText("reflect.past.moments")).toBeTruthy();
    for (const left of ["story", "readings", "close"]) {
      expect(screen.queryByText(`reflect.past.${left}`)).toBeNull();
    }
    expect(document.body.textContent).not.toMatch(/stopped|incomplete|unfinished/i);
    const sent = String(mockCall.mock.calls[0][0].query);
    for (const hidden of ["step", "outcome", "precheck", "afterAnswer"]) expect(sent).not.toMatch(new RegExp(`\\b${hidden}`));
  });

  it("a moment's feeling, need and Met are kept apart by a dot, as plate 11 draws them", async () => {
    entry = entryWith({
      moments: [
        { id: "m1", position: 0, whenText: null, feeling: "hurt", feelingSource: "own", need: "to be seen", needSource: "own", met: "UNMET" },
        { id: "m2", position: 1, whenText: null, feeling: "tired", feelingSource: "own", need: null, needSource: null, met: null },
      ],
    });
    render(<ReflectPastEntryPage />);
    const line = (await screen.findByText("hurt")).parentElement!;
    // Without the dots, "hurt to be seen" reads as one phrase.
    expect(line.textContent).toBe("hurt·to be seen·reflect.past.met.unmet");
    expect(screen.getByText("tired").parentElement!.textContent).toBe("tired");
  });

  it("Delete asks first, then removes the entry and lands on the list, replacing history", async () => {
    render(<ReflectPastEntryPage />);
    fireEvent.click(await screen.findByText("reflect.past.delete"));
    expect(screen.getByText("reflect.past.confirmBody")).toBeTruthy();
    expect(mockCall.mock.calls.some((c) => String(c[0]?.query).includes("DeleteReflectEntry"))).toBe(false);
    fireEvent.click(screen.getByText("common.delete"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/tools/reflect/past", { replace: true }));
    const del = mockCall.mock.calls.find((c) => String(c[0]?.query).includes("DeleteReflectEntry"))!;
    expect(del[0].variables).toEqual({ entryId: "e1" });
  });

  it("a delete that fails says so and stays", async () => {
    deleteOk = false;
    render(<ReflectPastEntryPage />);
    fireEvent.click(await screen.findByText("reflect.past.delete"));
    fireEvent.click(screen.getByText("common.delete"));
    expect(await screen.findByText("reflect.errors.delete")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("not found is one line and Back to Reflect, the same whatever the cause (AC-61)", async () => {
    entry = null;
    render(<ReflectPastEntryPage />);
    expect(await screen.findByText("reflect.past.notFound")).toBeTruthy();
    expect(screen.getByText("reflect.past.backToReflect").closest("a")!.getAttribute("href")).toBe("/tools/reflect");
    expect(screen.queryByText("reflect.past.delete")).toBeNull();
  });

  it("any other error is a plain couldn't-load line, not the not-found one", async () => {
    entry = "broken";
    render(<ReflectPastEntryPage />);
    expect(await screen.findByText("reflect.errors.couldNotLoad")).toBeTruthy();
    expect(screen.queryByText("reflect.past.notFound")).toBeNull();
  });
});
