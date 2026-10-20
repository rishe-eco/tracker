import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FocusPage from "~/components/focus/FocusPage";
import { toLocalDateString, addDaysToDateKey } from "~/utils/dateUtils";

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
  return {};
});

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
