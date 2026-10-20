import { describe, it, expect } from "vitest";
import {
  daysBetween,
  daysLeft,
  deriveState,
  findOverlap,
  groupForPicker,
  isProjectDone,
  openActions,
  projectContext,
  projectProgress,
  type FocusAction,
  type FocusPeriod,
  type FocusProject,
} from "~/components/focus/focusLogic";

function action(overrides: Partial<FocusAction> = {}): FocusAction {
  return { id: Math.random().toString(36).slice(2), title: "a", done: false, ...overrides };
}

function project(overrides: Partial<FocusProject> = {}): FocusProject {
  return { id: "p1", title: "Beta launch", actions: [], ...overrides };
}

const PERIOD: FocusPeriod = { id: "f1", title: "Autumn push", startDate: "2026-10-05", endDate: "2026-10-31", projects: [] };

describe("days", () => {
  it("counts whole calendar days across a month boundary", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("2026-11-02", "2026-10-30")).toBe(-3);
  });

  it("counts today in days left, so the last day is 1", () => {
    expect(daysLeft("2026-10-31", "2026-10-20")).toBe(12);
    expect(daysLeft("2026-10-31", "2026-10-31")).toBe(1);
  });
});

describe("deriveState", () => {
  it("is empty with no overview or nothing in it", () => {
    expect(deriveState(null)).toBe("empty");
    expect(deriveState({ lookback: null, active: null, upcoming: null })).toBe("empty");
  });

  it("puts an unseen look-back before an active period", () => {
    expect(deriveState({ lookback: PERIOD, active: PERIOD, upcoming: null })).toBe("lookback");
  });

  it("shows upcoming only when nothing is active", () => {
    expect(deriveState({ lookback: null, active: PERIOD, upcoming: PERIOD })).toBe("active");
    expect(deriveState({ lookback: null, active: null, upcoming: PERIOD })).toBe("upcoming");
  });
});

describe("progress and done-ness", () => {
  it("counts done out of all actions", () => {
    const p = project({ actions: [action({ done: true }), action(), action({ done: true, actionFate: "Backlog" })] });
    expect(projectProgress(p)).toEqual({ done: 2, total: 3, isDone: false });
  });

  it("is done only with at least one action, all done", () => {
    expect(isProjectDone(project())).toBe(false);
    expect(isProjectDone(project({ actions: [action({ done: true })] }))).toBe(true);
    expect(isProjectDone(project({ actions: [action({ done: true }), action()] }))).toBe(false);
  });
});

describe("openActions (plan PD-6)", () => {
  it("puts scheduled first by day, overdue included, then unscheduled oldest first", () => {
    const list = openActions([
      action({ id: "noday-new", createdAt: "2026-10-10T09:00:00.000Z" }),
      action({ id: "thu", tbd: "2026-10-22T00:00:00.000Z" }),
      action({ id: "overdue", tbd: "2026-10-19T00:00:00.000Z" }),
      action({ id: "noday-old", createdAt: "2026-10-01T09:00:00.000Z" }),
    ]);
    expect(list.map((a) => a.id)).toEqual(["overdue", "thu", "noday-old", "noday-new"]);
  });

  it("drops done actions and any action with a fate", () => {
    const list = openActions([
      action({ id: "done", done: true }),
      action({ id: "backlog", actionFate: "Backlog" }),
      action({ id: "bucket", actionFate: "BucketList" }),
      action({ id: "live" }),
    ]);
    expect(list.map((a) => a.id)).toEqual(["live"]);
  });

  it("leaves a not-done project with no open actions when its rest are all disposed (plan D-7)", () => {
    const p = project({ actions: [action({ done: true }), action({ actionFate: "Backlog" })] });
    expect(projectProgress(p).isDone).toBe(false);
    expect(openActions(p.actions)).toEqual([]);
  });
});

describe("projectContext", () => {
  it("reaches a milestone project's goal through the milestone (plan D-5)", () => {
    const p = project({ goal: null, milestone: { id: "m1", title: "Beta with 5 users", goal: { id: "g1", title: "Ship Tracker v1" } } });
    expect(projectContext(p)).toEqual({ goal: "Ship Tracker v1", milestone: "Beta with 5 users" });
  });

  it("gives the goal alone, or nothing for a standalone project", () => {
    expect(projectContext(project({ goal: { id: "g2", title: "Run a half marathon" } }))).toEqual({ goal: "Run a half marathon", milestone: null });
    expect(projectContext(project())).toEqual({ goal: null, milestone: null });
  });
});

describe("groupForPicker", () => {
  const inRange = project({ id: "in", title: "Beta launch", actions: [action({ tbd: "2026-10-31T00:00:00.000Z" })] });
  const edgeBefore = project({ id: "before", title: "Tax return", actions: [action({ tbd: "2026-10-04T00:00:00.000Z" })] });
  const doneOne = project({ id: "done", title: "Reading list", actions: [action({ done: true, tbd: "2026-10-10T00:00:00.000Z" })] });
  const noActions = project({ id: "empty", title: "Balcony plan" });

  it("groups by an undone action inside the inclusive range", () => {
    const g = groupForPicker([inRange, edgeBefore, noActions], "2026-10-05", "2026-10-31", "");
    expect(g.scheduled.map((p) => p.id)).toEqual(["in"]);
    expect(g.other.map((p) => p.id)).toEqual(["before", "empty"]);
  });

  it("leaves out finished projects unless they're already in the period", () => {
    expect(groupForPicker([doneOne], "2026-10-05", "2026-10-31", "").other).toEqual([]);
    const kept = groupForPicker([doneOne], "2026-10-05", "2026-10-31", "", new Set(["done"]));
    expect(kept.other.map((p) => p.id)).toEqual(["done"]);
  });

  it("filters by title, case-insensitively", () => {
    const g = groupForPicker([inRange, edgeBefore, noActions], "2026-10-05", "2026-10-31", "BETA");
    expect([...g.scheduled, ...g.other].map((p) => p.id)).toEqual(["in"]);
  });

  it("puts everything in Other when the range isn't valid yet", () => {
    const g = groupForPicker([inRange], "2026-10-05", "", "");
    expect(g.scheduled).toEqual([]);
    expect(g.other.map((p) => p.id)).toEqual(["in"]);
  });
});

describe("findOverlap", () => {
  const ranges = [{ id: "f1", title: "Autumn push", startDate: "2026-10-05", endDate: "2026-10-31" }];

  it("finds a period sharing even one day", () => {
    expect(findOverlap(ranges, "2026-10-31", "2026-11-30")?.id).toBe("f1");
    expect(findOverlap(ranges, "2026-09-01", "2026-10-05")?.id).toBe("f1");
  });

  it("allows the day after the end, and ignores the period being edited", () => {
    expect(findOverlap(ranges, "2026-11-01", "2026-11-30")).toBeNull();
    expect(findOverlap(ranges, "2026-10-01", "2026-10-31", "f1")).toBeNull();
  });
});
