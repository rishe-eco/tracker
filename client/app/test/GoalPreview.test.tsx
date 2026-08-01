import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GoalPreview, { type GoalPreviewProps } from "~/components/goals/GoalPreview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("~/components/notes/NotesModal", () => ({
  default: () => null,
}));

const PAST = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

function renderGoal(props: Partial<GoalPreviewProps> = {}) {
  return render(
    <GoalPreview
      id="g1"
      title="Launch product"
      projects={[]}
      {...props}
    />
  );
}

describe("GoalPreview rendering", () => {
  it("renders the goal title", () => {
    renderGoal({ title: "My Goal" });
    expect(screen.getByText("My Goal")).toBeInTheDocument();
  });

  it("shows Backlog status badge when no startDate", () => {
    renderGoal({ projects: [{ id: "p1", title: "P", done: false }] });
    expect(screen.getByText("goalManage.statusBacklog")).toBeInTheDocument();
  });

  it("shows GoalGroup badge for goal groups and no status badge", () => {
    renderGoal({ isGoalGroup: true });
    expect(screen.getByText("goalsList.goalGroup")).toBeInTheDocument();
    // Status badge should not be rendered for goal groups
    expect(screen.queryByText("goalManage.statusBacklog")).not.toBeInTheDocument();
  });

  it("shows date range when startDate and endDate are provided", () => {
    renderGoal({
      startDate: new Date(2025, 2, 1), // Mar 1
      endDate: new Date(2025, 5, 30),  // Jun 30
      projects: [{ id: "p1", title: "P", done: false }],
    });
    // date-fns format("MMM d") → "Mar 1" and "Jun 30, 2025"
    expect(screen.getByText(/Mar 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 30/)).toBeInTheDocument();
  });

  it("shows green dodClarity indicator when dodClarityStatus is green", () => {
    renderGoal({ dodClarityStatus: "green" });
    expect(screen.getByText("dodClarity.clarityGreen")).toBeInTheDocument();
  });

  it("shows amber dodClarity indicator when dodClarityStatus is amber", () => {
    renderGoal({ dodClarityStatus: "amber" });
    expect(screen.getByText("dodClarity.clarityAmber")).toBeInTheDocument();
  });

  it("shows In Progress status when today is within the date range", () => {
    renderGoal({
      startDate: PAST,
      endDate: FUTURE,
      projects: [{ id: "p1", title: "P", done: false }],
    });
    expect(screen.getByText("goalManage.statusInProgress")).toBeInTheDocument();
  });
});
