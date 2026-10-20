import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FocusPage from "~/components/focus/FocusPage";
import { toLocalDateString, addDaysToDateKey } from "~/utils/dateUtils";

const TODAY = toLocalDateString(new Date());
const day = (n: number) => addDaysToDateKey(TODAY, n);

let overview: any = { lookback: null, active: null, upcoming: null };
let pickerProjects: any[] = [];

const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("GetFocusOverview")) return { focusOverview: overview };
  if (q.includes("GetFocusPeriodRanges")) return { focusPeriodRanges: [] };
  if (q.includes("GetFocusPickerProjects")) return { projects: pickerProjects };
  if (q.includes("CreateFocusPeriod")) return { createFocusPeriod: { id: "new" } };
  if (q.includes("RecordFocusLookback")) {
    // Like the server: once recorded, the overview no longer carries the look-back.
    overview = { ...overview, lookback: null };
    return { recordFocusLookback: { id: opts.variables.id } };
  }
  return {};
});
const callsTo = (name: string) => mockCall.mock.calls.filter((c) => String(c[0]?.query).includes(name));

vi.mock("~/api/useApi", () => ({ useApi: () => ({ call: mockCall }) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && Object.keys(opts).length ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "en", dir: () => "ltr" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, className }: any) => (
    <a href={typeof to === "string" ? to : "#"} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("~/components/ui/confirm-dialog", () => ({ ConfirmDialog: () => null }));
vi.mock("~/components/ui/date-field", () => ({
  DateField: ({ id, value, onChange, min }: any) => (
    <input id={id} type="date" value={value} min={min} onChange={(e) => onChange?.({ target: { value: e.target.value } })} />
  ),
}));

function project(id: string, title: string, actions: any[]) {
  return { id, title, startDate: null, endDate: null, actions, goal: null, milestone: null };
}

const finishedProject = project("fin", "Design reading list", [{ id: "x", title: "Read", done: true }]);
const beta = project("beta", "Beta launch", [
  { id: "b1", title: "One", done: true },
  { id: "b2", title: "Two", done: false },
]);
const training = project("train", "Training block 2", [{ id: "t1", title: "Run", done: false }]);

/** An ended period whose look-back hasn't been seen. */
function endedPeriod(endOffset = -5) {
  return {
    id: "old",
    title: "Summer finish",
    startDate: day(endOffset - 29),
    endDate: day(endOffset),
    lookbackAnswer: null,
    lookbackSeenAt: null,
    projects: [finishedProject, beta, training],
  };
}

beforeEach(() => {
  mockCall.mockClear();
  overview = { lookback: endedPeriod(), active: null, upcoming: null };
  pickerProjects = [beta, training];
});

describe("FocusLookback (spec §4.5)", () => {
  it("lists finished and not-finished projects, with progress, and no count sentence (AC-10, AC-22)", async () => {
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByTestId("focus-lookback")).not.toBeNull());
    expect(screen.getByText('focus.lookbackEnded {"title":"Summer finish"}')).not.toBeNull();

    const fin = within(screen.getByTestId("focus-lookback-finished"));
    expect(fin.getByText("Design reading list")).not.toBeNull();
    expect(fin.queryByText("Beta launch")).toBeNull();

    const unfin = within(screen.getByTestId("focus-lookback-unfinished"));
    expect(unfin.getByText("Beta launch")).not.toBeNull();
    expect(unfin.getByText('focus.actionsDone {"done":1,"total":2}')).not.toBeNull();
    expect(unfin.getByText("Training block 2")).not.toBeNull();
    expect(unfin.getByText('focus.actionsDone {"done":0,"total":1}')).not.toBeNull();

    // The lists are the whole report: nothing numeric beyond each project's own progress.
    const text = screen.getByTestId("focus-lookback").textContent ?? "";
    expect(text).not.toContain("%");
    expect(text).not.toMatch(/score|grade|youFinished/i);
    expect(screen.queryByText(/focus\.lookbackSummary/)).toBeNull();
  });

  it("Done works without an answer: RecordFocusLookback with answer null, then the page moves on (AC-10, AC-23)", async () => {
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByTestId("focus-lookback")).not.toBeNull());
    // Neither answer starts selected.
    expect(screen.getByText("focus.lookbackOriented").closest("button")!.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("focus.lookbackBehind").closest("button")!.getAttribute("aria-pressed")).toBe("false");

    // With an active period waiting, Done falls through to it.
    overview.active = { ...endedPeriod(), id: "f2", title: "Autumn push", startDate: day(-1), endDate: day(20), projects: [] };
    fireEvent.click(screen.getByText("focus.lookbackDone"));
    await waitFor(() => expect(callsTo("RecordFocusLookback")).toHaveLength(1));
    expect(callsTo("RecordFocusLookback")[0][0].variables).toEqual({ id: "old", answer: null, dateKey: TODAY });
    await waitFor(() => expect(screen.getByText("Autumn push")).not.toBeNull());
    expect(screen.queryByTestId("focus-lookback")).toBeNull();
  });

  it("saves the answer when one is picked (AC-23)", async () => {
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByTestId("focus-lookback")).not.toBeNull());
    fireEvent.click(screen.getByText("focus.lookbackBehind"));
    expect(screen.getByText("focus.lookbackBehind").closest("button")!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText("focus.lookbackDone"));
    await waitFor(() => expect(callsTo("RecordFocusLookback")).toHaveLength(1));
    expect(callsTo("RecordFocusLookback")[0][0].variables).toEqual({ id: "old", answer: "behind", dateKey: TODAY });
  });

  it("carry-over opens the form with the unfinished projects ticked and today as the start (AC-24, AC-25)", async () => {
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByTestId("focus-lookback")).not.toBeNull());
    fireEvent.click(screen.getByText("focus.lookbackOriented"));
    fireEvent.click(screen.getByText("focus.startNewWithThese"));

    // The old period ended 5 days ago, so the day after has passed: the start is today.
    await waitFor(() => expect(screen.getByText("focus.startPeriod")).not.toBeNull());
    expect((document.getElementById("focus-start") as HTMLInputElement).value).toBe(TODAY);
    await waitFor(() => expect(screen.getByText("Beta launch")).not.toBeNull());
    const tick = (title: string) => screen.getByRole("checkbox", { name: title });
    expect(tick("Beta launch").getAttribute("aria-checked")).toBe("true");
    expect(tick("Training block 2").getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByText("focus.carriedOver")).toHaveLength(2);
    expect(screen.queryByText("Design reading list")).toBeNull(); // finished: not carried

    // Each one can be unticked.
    fireEvent.click(tick("Training block 2"));
    expect(tick("Training block 2").getAttribute("aria-checked")).toBe("false");

    fireEvent.change(screen.getByPlaceholderText("focus.namePlaceholder"), { target: { value: "Autumn push" } });
    fireEvent.change(document.getElementById("focus-end")!, { target: { value: day(20) } });
    fireEvent.click(screen.getByText("focus.startPeriod"));
    await waitFor(() => expect(callsTo("CreateFocusPeriod")).toHaveLength(1));
    expect(callsTo("CreateFocusPeriod")[0][0].variables.input).toEqual({
      title: "Autumn push",
      startDate: TODAY,
      endDate: day(20),
      projectIds: ["beta"],
    });

    // Starting the new period also records the look-back, with the answer given, so the page doesn't bounce back to it.
    await waitFor(() => expect(callsTo("RecordFocusLookback")).toHaveLength(1));
    expect(callsTo("RecordFocusLookback")[0][0].variables).toEqual({ id: "old", answer: "oriented", dateKey: TODAY });
  });

  it("Back from the carry-over form returns to the look-back (AC-24)", async () => {
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByTestId("focus-lookback")).not.toBeNull());
    fireEvent.click(screen.getByText("focus.startNewWithThese"));
    await waitFor(() => expect(screen.getByText("focus.startPeriod")).not.toBeNull());
    fireEvent.click(screen.getByText("focus.cancel"));
    expect(screen.getByTestId("focus-lookback")).not.toBeNull();
    expect(callsTo("RecordFocusLookback")).toHaveLength(0);
  });

  it("offers no carry-over when everything finished", async () => {
    overview.lookback = { ...endedPeriod(), projects: [finishedProject] };
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByTestId("focus-lookback")).not.toBeNull());
    expect(screen.queryByText("focus.startNewWithThese")).toBeNull();
    expect(screen.queryByTestId("focus-lookback-unfinished")).toBeNull();
  });
});
