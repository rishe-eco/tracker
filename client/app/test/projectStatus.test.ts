import { describe, it, expect } from "vitest";
import { getProjectStatus } from "~/components/projects/ProjectPreview";
import type { ProjectPreviewProps } from "~/components/projects/ProjectPreview";

const PAST_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
// Yesterday at midnight — clearly in the past calendar day
const YESTERDAY = new Date();
YESTERDAY.setDate(YESTERDAY.getDate() - 1);
YESTERDAY.setHours(0, 0, 0, 0);

function makeProject(overrides: Partial<ProjectPreviewProps> = {}): ProjectPreviewProps {
  return {
    id: "p1",
    title: "Test Project",
    actions: [],
    ...overrides,
  };
}

describe("getProjectStatus", () => {
  it("returns Backlog when actions array is empty", () => {
    expect(getProjectStatus(makeProject({ actions: [] }))).toBe("Backlog");
  });

  it("returns Done when all actions are done", () => {
    const project = makeProject({
      actions: [
        { id: "a1", title: "A", done: true },
        { id: "a2", title: "B", done: true },
      ],
    });
    expect(getProjectStatus(project)).toBe("Done");
  });

  it("returns Ignored when all incomplete actions have past tbd dates", () => {
    const project = makeProject({
      actions: [
        { id: "a1", title: "A", done: false, tbd: YESTERDAY },
        { id: "a2", title: "B", done: true },
      ],
    });
    expect(getProjectStatus(project)).toBe("Ignored");
  });

  it("returns Backlog when there are incomplete non-past actions but no startDate", () => {
    const project = makeProject({
      startDate: null,
      actions: [{ id: "a1", title: "A", done: false, tbd: FUTURE_DATE }],
    });
    expect(getProjectStatus(project)).toBe("Backlog");
  });

  it("returns TBD when startDate is in the future", () => {
    const project = makeProject({
      startDate: FUTURE_DATE,
      actions: [{ id: "a1", title: "A", done: false, tbd: FUTURE_DATE }],
    });
    expect(getProjectStatus(project)).toBe("TBD");
  });

  it("returns In Progress when startDate is in the past and there are active actions", () => {
    const project = makeProject({
      startDate: PAST_DATE,
      actions: [{ id: "a1", title: "A", done: false, tbd: FUTURE_DATE }],
    });
    expect(getProjectStatus(project)).toBe("In Progress");
  });

  it("is not Done when only some actions are done", () => {
    const project = makeProject({
      startDate: PAST_DATE,
      actions: [
        { id: "a1", title: "A", done: true },
        { id: "a2", title: "B", done: false, tbd: FUTURE_DATE },
      ],
    });
    expect(getProjectStatus(project)).not.toBe("Done");
  });
});
