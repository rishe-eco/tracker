import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";
import { typeResolvers } from "../graphql/resolvers/typeResolvers";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

type U = { id: string };

/** A project owned by `user` with one action per entry of `done`. */
async function makeProject(user: U, title: string, done: boolean[] = [false]) {
  return prisma.project.create({
    data: {
      title,
      userId: user.id,
      actions: { create: done.map((d, i) => ({ title: `${title} ${i + 1}`, done: d, userId: user.id })) },
    },
  });
}

function input(overrides: Partial<{ title: string; startDate: string; endDate: string; projectIds: string[] }> = {}) {
  return {
    title: "Spring push",
    startDate: "2026-03-01",
    endDate: "2026-03-14",
    projectIds: [] as string[],
    ...overrides,
  };
}

async function create(user: U, overrides: Parameters<typeof input>[0] = {}) {
  return mutationResolvers.createFocusPeriod(null, { input: input(overrides) }, makeCtx(user));
}

/** What the `FocusPeriod.projects` field returns, as titles in order. */
async function projectTitles(user: U, periodId: string) {
  const projects = await typeResolvers.FocusPeriod.projects({ id: periodId }, null, makeCtx(user));
  return projects.map((p: any) => p.title);
}

describe("create, update and delete (AC-1)", () => {
  it("creates a period with its projects, as date keys on the wire and UTC midnight in storage", async () => {
    const user = await createTestUser();
    const p1 = await makeProject(user, "P1");
    const period = await create(user, { title: "  Spring push  ", projectIds: [p1.id] });

    expect(period.title).toBe("Spring push");
    expect(period.userId).toBe(user.id);
    expect(period.startDate.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(period.endDate.toISOString()).toBe("2026-03-14T00:00:00.000Z");
    expect(typeResolvers.FocusPeriod.startDate(period)).toBe("2026-03-01");
    expect(typeResolvers.FocusPeriod.endDate(period)).toBe("2026-03-14");
    expect(period.lookbackAnswer).toBeNull();
    expect(typeResolvers.FocusPeriod.lookbackSeenAt(period)).toBeNull();
    expect(await projectTitles(user, period.id)).toEqual(["P1"]);
  });

  it("allows a same-day start and end", async () => {
    const user = await createTestUser();
    const period = await create(user, { startDate: "2026-03-05", endDate: "2026-03-05" });
    expect(typeResolvers.FocusPeriod.startDate(period)).toBe("2026-03-05");
    expect(typeResolvers.FocusPeriod.endDate(period)).toBe("2026-03-05");
  });

  it("updates title, dates and projects in one call, and deletes", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const p1 = await makeProject(user, "P1");
    const p2 = await makeProject(user, "P2");
    const period = await create(user, { projectIds: [p1.id] });

    const updated = await mutationResolvers.updateFocusPeriod(
      null,
      {
        id: period.id,
        input: input({ title: "Renamed", startDate: "2026-03-02", endDate: "2026-03-20", projectIds: [p2.id] }),
      },
      ctx
    );
    expect(updated.id).toBe(period.id);
    expect(updated.title).toBe("Renamed");
    expect(typeResolvers.FocusPeriod.endDate(updated)).toBe("2026-03-20");
    expect(await projectTitles(user, period.id)).toEqual(["P2"]);

    expect(await mutationResolvers.deleteFocusPeriod(null, { id: period.id }, ctx)).toBe(true);
    expect(await prisma.focusPeriod.count()).toBe(0);
  });

  it("lists projects in the order they were added, keeping addedAt for those that stay", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const a = await makeProject(user, "A");
    const b = await makeProject(user, "B");
    const c = await makeProject(user, "C");
    const period = await create(user, { projectIds: [b.id, a.id] });
    expect(await projectTitles(user, period.id)).toEqual(["B", "A"]);

    const before = await prisma.focusPeriodProject.findUnique({
      where: { focusPeriodId_projectId: { focusPeriodId: period.id, projectId: a.id } },
    });
    // Re-save with the ids in a different order and one more: A and B keep their places, C goes last.
    await mutationResolvers.updateFocusPeriod(
      null,
      { id: period.id, input: input({ projectIds: [a.id, c.id, b.id] }) },
      ctx
    );
    expect(await projectTitles(user, period.id)).toEqual(["B", "A", "C"]);
    const after = await prisma.focusPeriodProject.findUnique({
      where: { focusPeriodId_projectId: { focusPeriodId: period.id, projectId: a.id } },
    });
    expect(after!.addedAt.getTime()).toBe(before!.addedAt.getTime());

    // Remove B and add it back: it is newly added, so it goes to the end.
    await mutationResolvers.updateFocusPeriod(null, { id: period.id, input: input({ projectIds: [a.id, c.id] }) }, ctx);
    await mutationResolvers.updateFocusPeriod(
      null,
      { id: period.id, input: input({ projectIds: [a.id, c.id, b.id] }) },
      ctx
    );
    expect(await projectTitles(user, period.id)).toEqual(["A", "C", "B"]);
  });

  it("ignores a repeated id", async () => {
    const user = await createTestUser();
    const a = await makeProject(user, "A");
    const period = await create(user, { projectIds: [a.id, a.id] });
    expect(await projectTitles(user, period.id)).toEqual(["A"]);
  });

  it("rejects a blank or over-long title, and requires the caller to be signed in", async () => {
    const user = await createTestUser();
    await expect(create(user, { title: "   " })).rejects.toThrow("Title is required.");
    await expect(create(user, { title: "x".repeat(121) })).rejects.toThrow("at most 120 characters");
    await expect(
      mutationResolvers.createFocusPeriod(null, { input: input() }, { user: null, prisma })
    ).rejects.toThrow("Unauthorized");
    await expect(queryResolvers.focusOverview(null, { dateKey: "2026-03-01" }, { user: null, prisma })).rejects.toThrow(
      "Unauthorized"
    );
    await expect(queryResolvers.focusPeriodRanges(null, {}, { user: null, prisma })).rejects.toThrow("Unauthorized");
  });
});

describe("dates (AC-2)", () => {
  it("rejects an end before the start, on create and on update", async () => {
    const user = await createTestUser();
    await expect(create(user, { startDate: "2026-03-10", endDate: "2026-03-09" })).rejects.toThrow(
      "End date must be on or after the start date."
    );
    const period = await create(user);
    await expect(
      mutationResolvers.updateFocusPeriod(
        null,
        { id: period.id, input: input({ startDate: "2026-03-10", endDate: "2026-03-09" }) },
        makeCtx(user)
      )
    ).rejects.toThrow("End date must be on or after the start date.");
  });

  it("rejects a key that isn't a real day, in every operation that takes one", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await expect(create(user, { startDate: "2026-02-30" })).rejects.toThrow("Invalid date: 2026-02-30.");
    await expect(create(user, { endDate: "14 March" })).rejects.toThrow("Invalid date: 14 March.");
    await expect(queryResolvers.focusOverview(null, { dateKey: "2026-13-01" }, ctx)).rejects.toThrow(
      "Invalid date: 2026-13-01."
    );
    const period = await create(user);
    await expect(
      mutationResolvers.recordFocusLookback(null, { id: period.id, answer: null, dateKey: "tomorrow" }, ctx)
    ).rejects.toThrow("Invalid date: tomorrow.");
  });

  it("rejects touching on one shared day, allows the day after, and allows a period against itself", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const period = await create(user, { startDate: "2026-03-01", endDate: "2026-03-14" });

    // Shares 2026-03-14 only (either end), and a range that contains it, and one inside it.
    await expect(create(user, { startDate: "2026-03-14", endDate: "2026-03-20" })).rejects.toThrow(
      "These dates overlap another focus period."
    );
    await expect(create(user, { startDate: "2026-02-20", endDate: "2026-03-01" })).rejects.toThrow(
      "These dates overlap another focus period."
    );
    await expect(create(user, { startDate: "2026-02-01", endDate: "2026-04-01" })).rejects.toThrow(
      "These dates overlap another focus period."
    );
    await expect(create(user, { startDate: "2026-03-05", endDate: "2026-03-05" })).rejects.toThrow(
      "These dates overlap another focus period."
    );

    // The day after the end, and the day before the start, are free.
    await create(user, { title: "After", startDate: "2026-03-15", endDate: "2026-03-20" });
    await create(user, { title: "Before", startDate: "2026-02-20", endDate: "2026-02-28" });

    // Updating a period against itself is fine, including keeping its own dates.
    await mutationResolvers.updateFocusPeriod(
      null,
      { id: period.id, input: input({ title: "Same dates", startDate: "2026-03-01", endDate: "2026-03-14" }) },
      ctx
    );
    // But stretching it into a neighbour is not.
    await expect(
      mutationResolvers.updateFocusPeriod(
        null,
        { id: period.id, input: input({ startDate: "2026-03-01", endDate: "2026-03-15" }) },
        ctx
      )
    ).rejects.toThrow("These dates overlap another focus period.");
  });

  it("doesn't count another user's periods as overlapping", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    await create(user1);
    await expect(create(user2)).resolves.toBeTruthy();
  });

  it("lists every period's range, oldest first, as date keys, for the caller only", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    await create(user1, { title: "Later", startDate: "2026-05-01", endDate: "2026-05-10" });
    await create(user1, { title: "Earlier", startDate: "2026-03-01", endDate: "2026-03-10" });
    await create(user2, { title: "Not mine" });

    const rows = await queryResolvers.focusPeriodRanges(null, {}, makeCtx(user1));
    expect(rows.map((r: any) => r.title)).toEqual(["Earlier", "Later"]);
    expect(typeResolvers.FocusPeriodRange.startDate(rows[0])).toBe("2026-03-01");
    expect(typeResolvers.FocusPeriodRange.endDate(rows[0])).toBe("2026-03-10");
  });
});

describe("projects (AC-3)", () => {
  it("rejects a done project when added, but keeps it on re-save (D-4)", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const done = await makeProject(user, "Finished", [true, true]);
    const open = await makeProject(user, "Open", [false]);
    const empty = await makeProject(user, "No actions", []);

    await expect(create(user, { projectIds: [done.id] })).rejects.toThrow(
      "A finished project can't be added to a focus period."
    );
    // A project with no actions isn't done (the client's rule), so it can be added.
    const period = await create(user, { projectIds: [open.id, empty.id] });

    // The project finishes while in the period.
    await prisma.action.updateMany({ where: { projectId: open.id }, data: { done: true } });
    const resaved = await mutationResolvers.updateFocusPeriod(
      null,
      { id: period.id, input: input({ title: "Edited", projectIds: [open.id, empty.id] }) },
      ctx
    );
    expect(resaved.title).toBe("Edited");
    expect(await projectTitles(user, period.id)).toEqual(["Open", "No actions"]);

    // But a finished project can't be newly added on an update either.
    await expect(
      mutationResolvers.updateFocusPeriod(
        null,
        { id: period.id, input: input({ projectIds: [open.id, empty.id, done.id] }) },
        ctx
      )
    ).rejects.toThrow("A finished project can't be added to a focus period.");
    // And the failed save changed nothing.
    expect(await projectTitles(user, period.id)).toEqual(["Open", "No actions"]);
  });

  it("rolls back the whole create when a project is refused", async () => {
    const user = await createTestUser();
    const done = await makeProject(user, "Finished", [true]);
    await expect(create(user, { projectIds: [done.id] })).rejects.toThrow("finished project");
    expect(await prisma.focusPeriod.count()).toBe(0);
  });

  it("gives Not found for another user's project or an unknown id, on create and update", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const foreign = await makeProject(user1, "Theirs");
    const mine = await makeProject(user2, "Mine");

    await expect(create(user2, { projectIds: [foreign.id] })).rejects.toThrow("Not found");
    await expect(create(user2, { projectIds: [mine.id, "no-such-project"] })).rejects.toThrow("Not found");
    const period = await create(user2, { projectIds: [mine.id] });
    await expect(
      mutationResolvers.updateFocusPeriod(
        null,
        { id: period.id, input: input({ projectIds: [mine.id, foreign.id] }) },
        makeCtx(user2)
      )
    ).rejects.toThrow("Not found");
  });

  it("refuses 31 ids, and accepts 30 (which here then fail on ownership, not on the limit)", async () => {
    const user = await createTestUser();
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `p-${i}`);
    await expect(create(user, { projectIds: ids(31) })).rejects.toThrow(
      "A focus period can hold at most 30 projects."
    );
    await expect(create(user, { projectIds: ids(30) })).rejects.toThrow("Not found");

    // The same on update, and a repeated id counts once.
    const period = await create(user);
    await expect(
      mutationResolvers.updateFocusPeriod(null, { id: period.id, input: input({ projectIds: ids(31) }) }, makeCtx(user))
    ).rejects.toThrow("A focus period can hold at most 30 projects.");
    expect(await prisma.focusPeriod.count()).toBe(1);
  });

  it("gives Not found for another user's period, on update, delete and look-back", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const period = await create(user1);
    const ctx2 = makeCtx(user2);
    await expect(
      mutationResolvers.updateFocusPeriod(null, { id: period.id, input: input() }, ctx2)
    ).rejects.toThrow("Not found");
    await expect(mutationResolvers.deleteFocusPeriod(null, { id: period.id }, ctx2)).rejects.toThrow("Not found");
    await expect(
      mutationResolvers.recordFocusLookback(null, { id: period.id, answer: null, dateKey: "2026-06-01" }, ctx2)
    ).rejects.toThrow("Not found");
    await expect(
      mutationResolvers.deleteFocusPeriod(null, { id: "no-such-period" }, makeCtx(user1))
    ).rejects.toThrow("Not found");
    expect(await prisma.focusPeriod.count()).toBe(1);
  });
});

describe("removing and deleting (AC-5)", () => {
  it("deleting a period, or leaving a project out of it, leaves the project and its actions alone", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const a = await makeProject(user, "A", [false, true]);
    const b = await makeProject(user, "B", [false]);
    const period = await create(user, { projectIds: [a.id, b.id] });

    await mutationResolvers.updateFocusPeriod(null, { id: period.id, input: input({ projectIds: [b.id] }) }, ctx);
    expect(await projectTitles(user, period.id)).toEqual(["B"]);
    expect(await prisma.project.count()).toBe(2);
    expect(await prisma.action.count()).toBe(3);

    await mutationResolvers.deleteFocusPeriod(null, { id: period.id }, ctx);
    expect(await prisma.focusPeriodProject.count()).toBe(0);
    expect(await prisma.project.count()).toBe(2);
    expect(await prisma.action.count()).toBe(3);
  });

  it("deleting a project drops it from its periods, and leaves the periods", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const a = await makeProject(user, "A");
    const b = await makeProject(user, "B");
    const period = await create(user, { projectIds: [a.id, b.id] });

    await mutationResolvers.deleteProject(null, { id: a.id }, ctx);
    expect(await projectTitles(user, period.id)).toEqual(["B"]);
    expect(await prisma.focusPeriod.count()).toBe(1);
  });

  it("deleting a user removes their periods and join rows", async () => {
    const user = await createTestUser();
    const a = await makeProject(user, "A");
    await create(user, { projectIds: [a.id] });
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.focusPeriod.count()).toBe(0);
    expect(await prisma.focusPeriodProject.count()).toBe(0);
  });
});

describe("focusOverview (AC-4)", () => {
  async function overview(user: U, dateKey: string) {
    return queryResolvers.focusOverview(null, { dateKey }, makeCtx(user));
  }
  const titleOf = (p: any) => (p ? p.title : null);

  async function fourPeriods(user: U) {
    await create(user, { title: "Ended", startDate: "2026-01-01", endDate: "2026-01-10" });
    await create(user, { title: "Active", startDate: "2026-01-20", endDate: "2026-01-31" });
    await create(user, { title: "Next", startDate: "2026-02-10", endDate: "2026-02-20" });
    await create(user, { title: "Later", startDate: "2026-03-01", endDate: "2026-03-05" });
  }

  it("picks the look-back, the active period and the next upcoming one around dateKey", async () => {
    const user = await createTestUser();
    await fourPeriods(user);
    const o = await overview(user, "2026-01-25");
    expect(titleOf(o.lookback)).toBe("Ended");
    expect(titleOf(o.active)).toBe("Active");
    expect(titleOf(o.upcoming)).toBe("Next");
  });

  it("treats both ends as inclusive and the gap between periods as no active period", async () => {
    const user = await createTestUser();
    await fourPeriods(user);
    expect(titleOf((await overview(user, "2026-01-20")).active)).toBe("Active");
    expect(titleOf((await overview(user, "2026-01-31")).active)).toBe("Active");

    const gap = await overview(user, "2026-02-01");
    expect(gap.active).toBeNull();
    expect(titleOf(gap.lookback)).toBe("Active");
    expect(titleOf(gap.upcoming)).toBe("Next");
  });

  it("returns nulls when nothing is before, during or after", async () => {
    const user = await createTestUser();
    expect(await overview(user, "2026-01-25")).toEqual({ lookback: null, active: null, upcoming: null });
    await create(user, { title: "Only", startDate: "2026-01-20", endDate: "2026-01-31" });
    const before = await overview(user, "2026-01-01");
    expect(before.lookback).toBeNull();
    expect(before.active).toBeNull();
    expect(titleOf(before.upcoming)).toBe("Only");
    const after = await overview(user, "2026-06-01");
    expect(titleOf(after.lookback)).toBe("Only");
    expect(after.active).toBeNull();
    expect(after.upcoming).toBeNull();
  });

  it("offers a look-back only for the most recent ended period, and not once it is seen (PD-9)", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await fourPeriods(user);
    const ended = await prisma.focusPeriod.findFirstOrThrow({ where: { title: "Ended" } });
    const active = await prisma.focusPeriod.findFirstOrThrow({ where: { title: "Active" } });

    // On 2026-02-05 "Active" is the latest ended; "Ended" is older and also unseen, but never appears.
    expect(titleOf((await overview(user, "2026-02-05")).lookback)).toBe("Active");
    await mutationResolvers.recordFocusLookback(null, { id: active.id, answer: "behind", dateKey: "2026-02-05" }, ctx);
    const after = await overview(user, "2026-02-05");
    expect(after.lookback).toBeNull();
    expect(after.active).toBeNull();
    expect(titleOf(after.upcoming)).toBe("Next");
    // The older, still-unseen one never takes its place.
    const older = await prisma.focusPeriod.findUniqueOrThrow({ where: { id: ended.id } });
    expect(older.lookbackSeenAt).toBeNull();
  });

  it("only returns the caller's periods", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    await create(user1, { title: "Mine", startDate: "2026-01-20", endDate: "2026-01-31" });
    expect(await overview(user2, "2026-01-25")).toEqual({ lookback: null, active: null, upcoming: null });
  });

  it("brings each period's projects with their actions, goal and milestone", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "Ship the book" }, ctx);
    const project = await mutationResolvers.addProject(
      null,
      { title: "Draft", goalId: goal.id, actions: [{ title: "Outline" }, { title: "Chapter 1" }] },
      ctx
    );
    await create(user, { startDate: "2026-01-20", endDate: "2026-01-31", projectIds: [project.id] });

    const o = await overview(user, "2026-01-25");
    const projects = await typeResolvers.FocusPeriod.projects(o.active, null, ctx);
    expect(projects).toHaveLength(1);
    expect(projects[0].actions.map((a: any) => a.title).sort()).toEqual(["Chapter 1", "Outline"]);
    expect(projects[0].goal.title).toBe("Ship the book");
  });
});

describe("Milestone.goal (D-2)", () => {
  it("resolves a project's milestone's goal through the Project resolvers' path", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "Ship the book" }, ctx);
    const milestone = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "First draft" }, ctx);
    const project = await mutationResolvers.addProject(
      null,
      { title: "Draft", milestoneId: milestone.id, actions: [{ title: "Outline" }] },
      ctx
    );
    expect(project.goalId).toBeNull(); // Convention 3: under a milestone, the goal is only via the milestone
    const period = await create(user, { projectIds: [project.id] });

    // FocusPeriod.projects -> Project.milestone -> Milestone.goal, as `milestone { goal { title } }` would.
    const [loaded] = await typeResolvers.FocusPeriod.projects(period, null, ctx);
    const viaProject = await typeResolvers.Project.milestone(loaded, null, ctx);
    expect(viaProject.title).toBe("First draft");
    const viaMilestone = await typeResolvers.Milestone.goal(viaProject, null, ctx);
    expect(viaMilestone.title).toBe("Ship the book");
  });

  it("falls back to a lookup when the milestone arrives without its goal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "Ship the book" }, ctx);
    const milestone = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "First draft" }, ctx);
    const bare = await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } });
    expect((bare as any).goal).toBeUndefined();
    const resolved = await typeResolvers.Milestone.goal(bare, null, ctx);
    expect(resolved.title).toBe("Ship the book");
  });
});

describe("recordFocusLookback (AC-6)", () => {
  async function ended(user: U) {
    return create(user, { startDate: "2026-03-01", endDate: "2026-03-14" });
  }
  const record = (user: U, id: string, answer: string | null | undefined, dateKey: string) =>
    mutationResolvers.recordFocusLookback(null, { id, answer, dateKey }, makeCtx(user));

  it("is refused until the day after the period ends", async () => {
    const user = await createTestUser();
    const period = await ended(user);
    const message = "The look-back opens after the period ends.";
    await expect(record(user, period.id, "oriented", "2026-03-01")).rejects.toThrow(message);
    await expect(record(user, period.id, "oriented", "2026-03-14")).rejects.toThrow(message);
    await expect(record(user, period.id, "oriented", "2026-02-01")).rejects.toThrow(message);
    const fresh = await prisma.focusPeriod.findUniqueOrThrow({ where: { id: period.id } });
    expect(fresh.lookbackAnswer).toBeNull();
    expect(fresh.lookbackSeenAt).toBeNull();

    const ok = await record(user, period.id, "oriented", "2026-03-15");
    expect(ok.lookbackAnswer).toBe("oriented");
  });

  it("stores each answer, and null, and marks the look-back seen every time", async () => {
    const user = await createTestUser();
    const period = await ended(user);

    const oriented = await record(user, period.id, "oriented", "2026-04-01");
    expect(oriented.lookbackAnswer).toBe("oriented");
    expect(typeResolvers.FocusPeriod.lookbackSeenAt(oriented)).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const behind = await record(user, period.id, "behind", "2026-04-01");
    expect(behind.lookbackAnswer).toBe("behind");

    const dismissed = await record(user, period.id, null, "2026-04-01");
    expect(dismissed.lookbackAnswer).toBeNull();
    expect(dismissed.lookbackSeenAt).not.toBeNull();

    // An omitted answer is the same as null.
    await record(user, period.id, "behind", "2026-04-01");
    const omitted = await record(user, period.id, undefined, "2026-04-01");
    expect(omitted.lookbackAnswer).toBeNull();
    expect(omitted.lookbackSeenAt).not.toBeNull();
  });

  it("refuses any other answer", async () => {
    const user = await createTestUser();
    const period = await ended(user);
    for (const answer of ["maybe", "", "Oriented"]) {
      await expect(record(user, period.id, answer, "2026-04-01")).rejects.toThrow(
        'Answer must be "oriented" or "behind".'
      );
    }
    const fresh = await prisma.focusPeriod.findUniqueOrThrow({ where: { id: period.id } });
    expect(fresh.lookbackSeenAt).toBeNull();
  });
});
