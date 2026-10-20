import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FocusPage from "~/components/focus/FocusPage";
import UndoToast from "~/components/focus/UndoToast";
import { toLocalDateString, addDaysToDateKey, parseDateOnly } from "~/utils/dateUtils";

// Dates are built relative to the real today so the page's own
// `toLocalDateString(new Date())` lines up with the fixtures.
const TODAY = toLocalDateString(new Date());
const day = (n: number) => addDaysToDateKey(TODAY, n);

let overview: any = { lookback: null, active: null, upcoming: null };
let ranges: any[] = [];
let pickerProjects: any[] = [];

const mockCall = vi.fn(async (opts?: any) => {
  const q = String(opts?.query ?? "");
  if (q.includes("GetFocusOverview")) return { focusOverview: overview };
  if (q.includes("GetFocusPeriodRanges")) return { focusPeriodRanges: ranges };
  if (q.includes("GetFocusPickerProjects")) return { projects: pickerProjects };
  if (q.includes("CreateFocusPeriod")) return { createFocusPeriod: { id: "new" } };
  if (q.includes("UpdateFocusPeriod")) return { updateFocusPeriod: { id: "f1" } };
  // Like the server, ToggleAction changes what the next overview returns.
  if (q.includes("ToggleAction")) {
    for (const p of overview.active?.projects ?? []) {
      for (const a of p.actions) if (a.id === opts.variables.id) a.done = !a.done;
    }
    return { toggleAction: { id: opts.variables.id } };
  }
  if (q.includes("UpdateAction")) return { updateAction: { id: opts.variables.id } };
  if (q.includes("AddAction")) return { addAction: { id: "new-action" } };
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

vi.mock("~/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ open, onConfirm, confirmLabel }: any) =>
    open ? <button onClick={() => onConfirm()}>{confirmLabel}</button> : null,
}));
// The real grid is a month of buttons; one button that picks a fixed day is enough here.
vi.mock("~/components/ui/date-picker-grid", () => ({
  DatePickerGrid: ({ onSelect }: any) => (
    <button
      type="button"
      data-testid="pick-day"
      onClick={() => onSelect(parseDateOnly(addDaysToDateKey(toLocalDateString(new Date()), 3)))}
    >
      pick
    </button>
  ),
}));
vi.mock("~/components/ui/date-field", () => ({
  DateField: ({ id, value, onChange, min }: any) => (
    <input id={id} type="date" value={value} min={min} onChange={(e) => onChange?.({ target: { value: e.target.value } })} />
  ),
}));

function project(id: string, title: string, actions: any[], extra: any = {}) {
  return { id, title, startDate: null, endDate: null, actions, goal: null, milestone: null, ...extra };
}

function period(extra: any = {}) {
  return {
    id: "f1",
    title: "Autumn push",
    startDate: day(-15),
    endDate: day(11),
    lookbackAnswer: null,
    lookbackSeenAt: null,
    projects: [],
    ...extra,
  };
}

beforeEach(() => {
  mockCall.mockClear();
  overview = { lookback: null, active: null, upcoming: null };
  ranges = [];
  pickerProjects = [];
});

describe("FocusPage — states (spec §4.1)", () => {
  it("shows the intro and the start form when there's no period (AC-7)", async () => {
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("focus.emptyIntro")).not.toBeNull());
    expect(screen.getByText("focus.startPeriod")).not.toBeNull();
    expect(mockCall.mock.calls[0][0].variables).toEqual({ dateKey: TODAY });
  });

  it("shows an active period's header with days left counting today, and its cards (AC-8)", async () => {
    overview.active = period({ projects: [project("p1", "Beta launch", [{ id: "a1", title: "Fix login", done: false }])] });
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Autumn push")).not.toBeNull());
    expect(screen.getByTestId("focus-when").textContent).toContain('focus.daysLeft {"count":12}');
    expect(screen.getByText("Beta launch")).not.toBeNull();
    expect(screen.getByText("Fix login")).not.toBeNull();
  });

  it("shows an upcoming period with 'starts in' when nothing is active (AC-9)", async () => {
    overview.upcoming = period({ startDate: day(3), endDate: day(20) });
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Autumn push")).not.toBeNull());
    expect(screen.getByTestId("focus-when").textContent).toContain('focus.startsIn {"count":3}');
  });
});

describe("FocusProjectCard states (spec §4.3)", () => {
  it("shows Done, No actions yet, and No next actions (AC-12, AC-13, plan D-7)", async () => {
    overview.active = period({
      projects: [
        project("done", "Reading list", [{ id: "x", title: "Read", done: true }]),
        project("empty", "Balcony plan", []),
        project("disposed", "Tax return", [
          { id: "y", title: "Collect", done: true },
          { id: "z", title: "Someday", done: false, actionFate: "Backlog" },
        ]),
      ],
    });
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Reading list")).not.toBeNull());
    expect(screen.getByText("focus.done")).not.toBeNull();
    expect(screen.getByText("focus.noActionsYet")).not.toBeNull();
    expect(screen.getByText("focus.noNextActions")).not.toBeNull();
  });

  it("lists at most 3 next actions and links the rest (AC-14)", async () => {
    const actions = ["a", "b", "c", "d", "e"].map((id, i) => ({
      id,
      title: `Action ${id}`,
      done: false,
      createdAt: `2026-01-0${i + 1}T00:00:00.000Z`,
    }));
    overview.active = period({ projects: [project("p1", "Beta launch", actions)] });
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Action a")).not.toBeNull());
    expect(screen.queryByText("Action d")).toBeNull();
    expect(screen.getByText('focus.more {"count":2}')).not.toBeNull();
    expect(screen.getByText('focus.actionsDone {"done":0,"total":5}')).not.toBeNull();
  });

  it("gives a milestone project its goal through the milestone (AC-32)", async () => {
    overview.active = period({
      projects: [
        project("p1", "Beta launch", [], {
          milestone: { id: "m1", title: "Beta with 5 users", goal: { id: "g1", title: "Ship Tracker v1" } },
        }),
      ],
    });
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Ship Tracker v1 › Beta with 5 users")).not.toBeNull());
  });
});

describe("FocusPeriodForm (spec §4.4, plan PD-8)", () => {
  it("names the overlapping period and blocks saving (AC-2, W8)", async () => {
    ranges = [{ id: "f9", title: "Winter base", startDate: day(10), endDate: day(40) }];
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("focus.startPeriod")).not.toBeNull());
    fireEvent.change(screen.getByPlaceholderText("focus.namePlaceholder"), { target: { value: "Push" } });
    fireEvent.change(document.getElementById("focus-end")!, { target: { value: day(15) } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain('"title":"Winter base"'));
    expect((screen.getByText("focus.startPeriod") as HTMLButtonElement).closest("button")!.disabled).toBe(true);
  });

  it("groups the picker by work scheduled in the dates, hides finished projects, and creates the period (AC-33)", async () => {
    pickerProjects = [
      project("in", "Beta launch", [{ id: "a", title: "x", done: false, tbd: `${day(2)}T00:00:00.000Z` }]),
      project("out", "Tax return", []),
      project("fin", "Reading list", [{ id: "b", title: "y", done: true }]),
    ];
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Beta launch")).not.toBeNull());
    fireEvent.change(document.getElementById("focus-end")!, { target: { value: day(10) } });
    await waitFor(() => expect(screen.getByText("focus.scheduledInDates")).not.toBeNull());
    expect(screen.queryByText("Reading list")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("focus.namePlaceholder"), { target: { value: "  Push  " } });
    fireEvent.click(screen.getByText("Beta launch").closest("label")!.querySelector("button")!);
    fireEvent.click(screen.getByText("focus.startPeriod"));
    await waitFor(() => expect(mockCall.mock.calls.some((c) => String(c[0]?.query).includes("CreateFocusPeriod"))).toBe(true));
    const create = mockCall.mock.calls.find((c) => String(c[0]?.query).includes("CreateFocusPeriod"))!;
    expect(create[0].variables.input).toEqual({ title: "Push", startDate: TODAY, endDate: day(10), projectIds: ["in"] });
  });
});

const dayText = (n: number) => `${day(n)}T00:00:00.000Z`;

/** The one button in an action's row: its day button. */
const dayButtonOf = (title: string) => within(screen.getByText(title).closest("li")!).getByRole("button");

describe("Row actions (spec §4.4)", () => {
  const four = () => [
    { id: "a1", title: "Fix login", done: false, tbd: dayText(1), estimatedTimeMinutes: 20 },
    { id: "a2", title: "Draft invite", done: false, createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "a3", title: "Pick users", done: false, createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "a4", title: "Write FAQ", done: false, createdAt: "2026-01-03T00:00:00.000Z" },
  ];
  const activeWith = (projects: any[]) => {
    overview.active = period({ projects });
  };

  it("keeps the checkbox and day button out of the title's link, and the day button only opens the popover (AC-16)", async () => {
    activeWith([project("p1", "Beta launch", four())]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Fix login")).not.toBeNull());
    expect(screen.getByRole("checkbox", { name: "Fix login" }).closest("a")).toBeNull();
    const day2 = dayButtonOf("Draft invite");
    expect(day2.closest("a")).toBeNull();
    fireEvent.click(day2);
    expect(screen.getByTestId("focus-reschedule-a2")).not.toBeNull();
    expect(callsTo("mutation")).toHaveLength(0);
  });

  it("completes through ToggleAction, refetches, shows Undo, and Undo toggles again (AC-17)", async () => {
    activeWith([project("p1", "Beta launch", four())]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Fix login")).not.toBeNull());
    expect(screen.queryByText("Write FAQ")).toBeNull();
    expect(screen.getByText('focus.actionsDone {"done":0,"total":4}')).not.toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Fix login" }));
    await waitFor(() => expect(screen.queryByText("Fix login")).toBeNull());
    expect(callsTo("ToggleAction")[0][0].variables).toEqual({ id: "a1" });
    expect(screen.getByText("Write FAQ")).not.toBeNull(); // the next one moved up
    expect(screen.getByText('focus.actionsDone {"done":1,"total":4}')).not.toBeNull();
    expect(callsTo("GetFocusOverview")).toHaveLength(2);
    expect(screen.getByTestId("focus-undo-toast").textContent).toContain("Fix login");

    fireEvent.click(screen.getByText("focus.undo"));
    await waitFor(() => expect(screen.getByText("Fix login")).not.toBeNull());
    expect(callsTo("ToggleAction")).toHaveLength(2);
    expect(callsTo("ToggleAction")[1][0].variables).toEqual({ id: "a1" });
    expect(screen.queryByTestId("focus-undo-toast")).toBeNull();
  });

  it("a second completion replaces the toast and leaves the first done (PD-7)", async () => {
    activeWith([project("p1", "Beta launch", four())]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Fix login")).not.toBeNull());
    fireEvent.click(screen.getByRole("checkbox", { name: "Fix login" }));
    await waitFor(() => expect(screen.queryByText("Fix login")).toBeNull());
    fireEvent.click(screen.getByRole("checkbox", { name: "Draft invite" }));
    await waitFor(() => expect(screen.getByTestId("focus-undo-toast").textContent).toContain("Draft invite"));
    expect(screen.getAllByTestId("focus-undo-toast")).toHaveLength(1);
    expect(screen.getByTestId("focus-undo-toast").textContent).not.toContain("Fix login");
  });

  it("the toast expires on its own", async () => {
    const onExpire = vi.fn();
    render(<UndoToast title="x" onUndo={() => {}} onExpire={onExpire} durationMs={20} />);
    await waitFor(() => expect(onExpire).toHaveBeenCalledTimes(1));
  });

  it("asks for minutes when the action has no estimate, and never sends a day without them (AC-18)", async () => {
    activeWith([project("p1", "Beta launch", four())]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Draft invite")).not.toBeNull());
    fireEvent.click(dayButtonOf("Draft invite"));

    const popover = within(screen.getByTestId("focus-reschedule-a2"));
    const save = () => popover.getByText("focus.save").closest("button")!;
    const minutesInput = () => screen.getByTestId("focus-reschedule-a2").querySelector("input");
    expect(save().disabled).toBe(true);
    expect(minutesInput()).toBeNull(); // Minutes appears once a day is picked

    fireEvent.click(popover.getByTestId("pick-day"));
    expect(minutesInput()).not.toBeNull();
    expect(save().disabled).toBe(true);
    for (const bad of ["", "abc", "1.5", "-5", "1441"]) {
      fireEvent.change(minutesInput()!, { target: { value: bad } });
      expect(save().disabled).toBe(true);
    }
    fireEvent.click(save());
    expect(callsTo("UpdateAction")).toHaveLength(0);

    fireEvent.change(minutesInput()!, { target: { value: "30" } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    await waitFor(() => expect(callsTo("UpdateAction")).toHaveLength(1));
    expect(callsTo("UpdateAction")[0][0].variables).toEqual({ id: "a2", tbd: day(3), estimatedTimeMinutes: 30 });
    await waitFor(() => expect(callsTo("GetFocusOverview")).toHaveLength(2));
    for (const c of callsTo("UpdateAction")) {
      const v = c[0].variables;
      if (v.tbd) expect(v.estimatedTimeMinutes).not.toBeUndefined();
    }
  });

  it("sends the existing estimate with the day, and Clear day sends tbd null (AC-18)", async () => {
    activeWith([project("p1", "Beta launch", four())]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Fix login")).not.toBeNull());
    fireEvent.click(dayButtonOf("Fix login"));
    expect(screen.getByTestId("focus-reschedule-a1").querySelector("input")).toBeNull(); // no minutes asked
    fireEvent.click(screen.getByTestId("pick-day"));
    fireEvent.click(screen.getByText("focus.save"));
    await waitFor(() => expect(callsTo("UpdateAction")).toHaveLength(1));
    expect(callsTo("UpdateAction")[0][0].variables).toEqual({ id: "a1", tbd: day(3), estimatedTimeMinutes: 20 });

    // The popover closes on save; reopen it and clear the day.
    await waitFor(() => expect(screen.queryByTestId("focus-reschedule-a1")).toBeNull());
    fireEvent.click(dayButtonOf("Fix login"));
    fireEvent.click(screen.getByText("focus.clearDay"));
    await waitFor(() => expect(callsTo("UpdateAction")).toHaveLength(2));
    expect(callsTo("UpdateAction")[1][0].variables).toEqual({ id: "a1", tbd: null });
  });

  it("adds an action under the card's project, and a day needs minutes (AC-19)", async () => {
    activeWith([project("p1", "Beta launch", four()), project("p2", "Training", [])]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Training")).not.toBeNull());
    const card = within(screen.getByTestId("focus-card-p2"));
    fireEvent.click(card.getByText("focus.addAction"));

    const add = () => card.getByText("focus.add").closest("button")!;
    expect(add().disabled).toBe(true);
    fireEvent.change(card.getByPlaceholderText("focus.newActionPlaceholder"), { target: { value: "  Buy shoes " } });
    expect(add().disabled).toBe(false);
    expect(document.getElementById("focus-add-minutes-p2")).toBeNull();

    fireEvent.change(document.getElementById("focus-add-day-p2")!, { target: { value: day(2) } });
    const minutes = document.getElementById("focus-add-minutes-p2") as HTMLInputElement;
    expect(minutes).not.toBeNull();
    expect(add().disabled).toBe(true);
    fireEvent.change(minutes, { target: { value: "45" } });
    fireEvent.click(add());
    await waitFor(() => expect(callsTo("AddAction")).toHaveLength(1));
    expect(callsTo("AddAction")[0][0].variables).toEqual({
      title: "Buy shoes",
      projectId: "p2",
      tbd: day(2),
      estimatedTimeMinutes: 45,
    });
    await waitFor(() => expect(callsTo("GetFocusOverview")).toHaveLength(2));
    expect(card.queryByText("focus.add")).toBeNull(); // the form closed
  });

  it("adds without a day: no tbd, no minutes (AC-19)", async () => {
    activeWith([project("p1", "Beta launch", four())]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Fix login")).not.toBeNull());
    fireEvent.click(screen.getByText("focus.addAction"));
    fireEvent.change(screen.getByPlaceholderText("focus.newActionPlaceholder"), { target: { value: "Call Sam" } });
    fireEvent.click(screen.getByText("focus.add"));
    await waitFor(() => expect(callsTo("AddAction")).toHaveLength(1));
    expect(callsTo("AddAction")[0][0].variables).toEqual({ title: "Call Sam", projectId: "p1" });
  });

  it("removes a project from the period with the other ids, after one confirmation (AC-21)", async () => {
    activeWith([project("p1", "Beta launch", four()), project("p2", "Training", [])]);
    render(<FocusPage />);
    await waitFor(() => expect(screen.getByText("Training")).not.toBeNull());
    const card = within(screen.getByTestId("focus-card-p1"));
    expect(card.queryByText("focus.removeFromPeriod")).toBeNull(); // closed until opened
    fireEvent.click(card.getByLabelText("focus.cardMenu"));
    expect(card.getByText("focus.openProject").closest("a")!.getAttribute("href")).toBe("/activities/project/p1");
    fireEvent.click(card.getByText("focus.removeFromPeriod"));
    expect(callsTo("UpdateFocusPeriod")).toHaveLength(0); // asks first
    fireEvent.click(screen.getByText("focus.remove"));
    await waitFor(() => expect(callsTo("UpdateFocusPeriod")).toHaveLength(1));
    expect(callsTo("UpdateFocusPeriod")[0][0].variables).toEqual({
      id: "f1",
      input: { title: "Autumn push", startDate: day(-15), endDate: day(11), projectIds: ["p2"] },
    });
    await waitFor(() => expect(callsTo("GetFocusOverview")).toHaveLength(2));
  });
});
