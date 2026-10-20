import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import ManageGoal from "~/components/goals/ManageGoal";
import { GET_GOAL } from "~/api/queries";

// B-15: a goal group is a container with no projects of its own, so it has no
// computable status. Its manage page must not show one.

const mockCall = vi.fn();

vi.mock("~/api/useApi", () => ({
  useApi: () => ({ call: mockCall, getLastError: () => null }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", dir: () => "ltr" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "g1" }),
}));

vi.mock("~/layout/InternalPageLayout", () => ({
  default: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
    <main>
      {title}
      {children}
    </main>
  ),
}));

vi.mock("~/components/onboarding/ModuleIntroOverlay", () => ({ default: () => null }));
vi.mock("~/components/notes/NotesModal", () => ({ default: () => null }));

const STATUS_KEYS = [
  "goalManage.statusBacklog",
  "goalManage.statusTbd",
  "goalManage.statusInProgress",
  "goalManage.statusIgnored",
  "goalManage.statusDone",
];

function goal(overrides: Record<string, unknown>) {
  return {
    id: "g1",
    title: "Health",
    dod: "",
    startDate: null,
    endDate: null,
    projects: [],
    milestones: [],
    childGoals: [],
    intervals: [],
    ...overrides,
  };
}

function serve(data: Record<string, unknown>) {
  // Some children call `call()` with no arguments (useApi's own default query).
  mockCall.mockImplementation((args?: { query?: string }) =>
    Promise.resolve(args?.query === GET_GOAL ? { goal: data } : {})
  );
}

beforeEach(() => mockCall.mockReset());

describe("ManageGoal status badge", () => {
  it("shows no status for a goal group", async () => {
    serve(goal({ isGoalGroup: true, childGoals: [{ id: "c1", title: "Run", isGoalGroup: false }] }));
    render(<ManageGoal />);
    await screen.findByText("Health");
    for (const key of STATUS_KEYS) expect(screen.queryByText(key)).not.toBeInTheDocument();
    expect(screen.getByText("goalsList.goalGroup")).toBeInTheDocument();
  });

  it("still shows a status for an ordinary goal", async () => {
    serve(goal({ isGoalGroup: false }));
    render(<ManageGoal />);
    await screen.findByText("Health");
    expect(screen.getByText("goalManage.statusBacklog")).toBeInTheDocument();
  });
});
