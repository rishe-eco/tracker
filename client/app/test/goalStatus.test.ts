import { describe, it, expect } from "vitest";
import { getGoalStatus, isProjectDoneForGoal } from "~/components/goals/GoalPreview";

const PAST = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);  // 30 days ago
const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

function makeGoal(overrides: Partial<Parameters<typeof getGoalStatus>[0]> = {}) {
  return {
    id: "g1",
    title: "Test goal",
    projects: [],
    isGoalGroup: false,
    ...overrides,
  };
}

describe("getGoalStatus", () => {
  it("returns GoalGroup for goal groups regardless of other fields", () => {
    expect(getGoalStatus(makeGoal({ isGoalGroup: true }))).toBe("GoalGroup");
  });

  it("returns Backlog when no startDate or endDate", () => {
    expect(getGoalStatus(makeGoal({ projects: [{ id: "p1", title: "P", done: false }] }))).toBe("Backlog");
  });

  it("returns Done when all projects are done", () => {
    const goal = makeGoal({
      startDate: PAST,
      endDate: FUTURE,
      projects: [
        { id: "p1", title: "P1", done: true },
        { id: "p2", title: "P2", done: true },
      ],
    });
    expect(getGoalStatus(goal)).toBe("Done");
  });

  it("returns Ignored when endDate is in the past", () => {
    const goal = makeGoal({
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: PAST,
      projects: [{ id: "p1", title: "P", done: false }],
    });
    expect(getGoalStatus(goal)).toBe("Ignored");
  });

  it("returns TBD when startDate is in the future", () => {
    const goal = makeGoal({
      startDate: FUTURE,
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      projects: [{ id: "p1", title: "P", done: false }],
    });
    expect(getGoalStatus(goal)).toBe("TBD");
  });

  it("returns In Progress when today falls within the date range", () => {
    const goal = makeGoal({
      startDate: PAST,
      endDate: FUTURE,
      projects: [{ id: "p1", title: "P", done: false }],
    });
    expect(getGoalStatus(goal)).toBe("In Progress");
  });

  it("returns Backlog when projects array is empty (vacuous-truth guard)", () => {
    // All-done on empty array would be vacuously true — should stay Backlog not Done
    const goal = makeGoal({ startDate: PAST, endDate: FUTURE, projects: [] });
    expect(getGoalStatus(goal)).toBe("In Progress"); // 0 projects → not allDone, has dates → In Progress
  });
});

describe("isProjectDoneForGoal", () => {
  it("returns true when done is true", () => {
    expect(isProjectDoneForGoal({ done: true })).toBe(true);
  });

  it("returns false when done is false", () => {
    expect(isProjectDoneForGoal({ done: false })).toBe(false);
  });

  it("returns false when done is undefined", () => {
    expect(isProjectDoneForGoal({})).toBe(false);
  });
});
