import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { runActionGathering } from "../services/actionGathering";
import { mutationResolvers } from "../graphql/resolvers/mutations";

const TODAY = "2025-06-10";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeActiveInterval(userId: string, overrides?: object) {
  return prisma.interval.create({
    data: {
      title: "Daily standup",
      status: "active",
      estimatedTimeMinutes: 15,
      repeatValue: 1,
      repeatUnit: "day",
      userId,
      // Anchor must be before TODAY so dateMatchesRepeatFromAnchor works
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      ...overrides,
    },
  });
}

describe("runActionGathering", () => {
  it("creates gathered actions for today, today+1, today+2", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(3);
    expect(result.dateKeysProcessed).toEqual(["2025-06-10", "2025-06-11", "2025-06-12"]);
    const actions = await prisma.action.findMany({ where: { userId: user.id, isGathered: true } });
    expect(actions).toHaveLength(3);
  });

  it("is idempotent — re-running does not duplicate actions", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    const second = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(second.actionsCreated).toBe(0);
    const actions = await prisma.action.findMany({ where: { userId: user.id, isGathered: true } });
    expect(actions).toHaveLength(3);
  });

  it("does not duplicate when two runs race concurrently for the same user/date", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    // The TOCTOU this guards against: two overlapping runs (StrictMode
    // double-fire, two tabs, a retry) each read "nothing gathered yet" and both
    // insert. Serialized per user, so between them exactly one set is created.
    const [a, b] = await Promise.all([
      runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false }),
      runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false }),
    ]);
    expect(a.actionsCreated + b.actionsCreated).toBe(3); // 3 total, never 6
    const actions = await prisma.action.findMany({ where: { userId: user.id, isGathered: true } });
    expect(actions).toHaveLength(3);
  });

  it("serializes per user, not globally — two users gather in parallel", async () => {
    const u1 = await createTestUser({ email: "race1@example.com" });
    const u2 = await createTestUser({ email: "race2@example.com" });
    await makeActiveInterval(u1.id);
    await makeActiveInterval(u2.id);
    const [r1, r2] = await Promise.all([
      runActionGathering(prisma, u1.id, { todayDateKey: TODAY, skipCompletedDates: false }),
      runActionGathering(prisma, u2.id, { todayDateKey: TODAY, skipCompletedDates: false }),
    ]);
    expect(r1.actionsCreated).toBe(3);
    expect(r2.actionsCreated).toBe(3);
    expect(await prisma.action.count({ where: { userId: u1.id, isGathered: true } })).toBe(3);
    expect(await prisma.action.count({ where: { userId: u2.id, isGathered: true } })).toBe(3);
  });

  it("gathers a weekly interval on a selected weekday that isn't its creation weekday", async () => {
    // The user's real symptom: a new weekly interval never showed up in linked
    // tasks. The form sends repeatUnit="week" + repeatValue=1 +
    // customRepeatRule.daysOfWeek together, and the occurrence check used to
    // additionally demand the same weekday as createdAt. Anchor 2025-01-01 is a
    // Wednesday; the window is Tue/Wed/Thu 2025-06-10..12, so a Thursday-only
    // interval was silently dropped. It must now materialize on 2025-06-12.
    const user = await createTestUser();
    await makeActiveInterval(user.id, {
      title: "Weekly review",
      repeatUnit: "week",
      repeatValue: 1,
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [4] }), // Thursday
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(1);
    const actions = await prisma.action.findMany({ where: { userId: user.id, isGathered: true } });
    expect(actions).toHaveLength(1);
    expect(actions[0].forDate?.toISOString().slice(0, 10)).toBe("2025-06-12");
  });

  it("skips dates that already have actionGatheringCompletedAt (skipCompletedDates=true)", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    // Pre-mark today as gathered
    await prisma.dayState.create({
      data: { userId: user.id, dateKey: TODAY, actionGatheringCompletedAt: new Date() },
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: true });
    // Only tomorrow and day-after should be gathered
    expect(result.actionsCreated).toBe(2);
    expect(result.dateKeysProcessed).not.toContain(TODAY);
  });

  it("re-opens completed dates for an interval created after gathering ran", async () => {
    const user = await createTestUser();
    // Reproduces the "took two days to show up" bug: opening Today marks the
    // whole window gathered, then the user creates an interval.
    const first = await runActionGathering(prisma, user.id, { todayDateKey: TODAY });
    expect(first.actionsCreated).toBe(0);
    expect(first.dateKeysProcessed).toHaveLength(3);

    await makeActiveInterval(user.id);

    const second = await runActionGathering(prisma, user.id, { todayDateKey: TODAY });
    expect(second.actionsCreated).toBe(3);
    expect(second.dateKeysProcessed).toEqual(["2025-06-10", "2025-06-11", "2025-06-12"]);
  });

  it("stops re-opening once gathering has caught up with the templates", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    await runActionGathering(prisma, user.id, { todayDateKey: TODAY });
    const third = await runActionGathering(prisma, user.id, { todayDateKey: TODAY });
    expect(third.dateKeysProcessed).toEqual([]);
    expect(third.actionsCreated).toBe(0);
  });

  it("re-opens completed dates when an existing interval is edited", async () => {
    const user = await createTestUser();
    const interval = await makeActiveInterval(user.id, { repeatUnit: null });
    await runActionGathering(prisma, user.id, { todayDateKey: TODAY });

    // No repeat rule yet, so nothing was gathered — now give it one.
    await prisma.interval.update({
      where: { id: interval.id },
      data: { repeatUnit: "day", repeatValue: 1 },
    });

    const after = await runActionGathering(prisma, user.id, { todayDateKey: TODAY });
    expect(after.actionsCreated).toBe(3);
  });

  it("respects endTime — does not create actions after interval ends", async () => {
    const user = await createTestUser();
    // endTime is before today+1
    await makeActiveInterval(user.id, {
      endTime: new Date("2025-06-10T23:59:59.000Z"),
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(1); // only today
  });

  it("does not gather from inactive intervals", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id, { status: "inactive" });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(0);
  });

  it("creates one action per time block from customRepeatRule", async () => {
    const user = await createTestUser();
    // repeatUnit governs occurrence; timeOfDayBlocks inside customRepeatRule controls how many actions per occurrence
    await makeActiveInterval(user.id, {
      customRepeatRule: JSON.stringify({ unit: "day", timeOfDayBlocks: ["08:00", "17:00"] }),
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    // 2 blocks × 3 days
    expect(result.actionsCreated).toBe(6);
  });
});

describe("Time Themes: tag inheritance on gather (build-plan.md Phase 3b)", () => {
  it("a gathered action from a tagged interval carries the interval's tags, and is locked", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const interval = await makeActiveInterval(user.id, { tags: { connect: [{ id: tag.id }] } });

    await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    const gathered = await prisma.action.findFirst({
      where: { userId: user.id, isGathered: true, sourceId: interval.id },
      include: { tags: true },
    });
    expect(gathered).not.toBeNull();
    expect(gathered!.tags.map((t) => t.id)).toEqual([tag.id]);

    // Locked: sourceType != null rejects setActionTags (build-plan.md §0 constraint #2).
    await expect(
      mutationResolvers.setActionTags(null, { actionId: gathered!.id, tagIds: [] }, ctx)
    ).rejects.toThrow(/come from its interval or routine/);
  });

  it("retagging the interval after gather does not change an already-gathered action (snapshot, not live)", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tagA = await mutationResolvers.createTag(null, { name: "deep-work", color: "indigo" }, ctx);
    const tagB = await mutationResolvers.createTag(null, { name: "admin", color: "slate" }, ctx);
    const interval = await makeActiveInterval(user.id, { tags: { connect: [{ id: tagA.id }] } });

    await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    const gathered = await prisma.action.findFirst({
      where: { userId: user.id, isGathered: true, sourceId: interval.id, forDate: new Date(TODAY + "T00:00:00.000Z") },
      include: { tags: true },
    });
    expect(gathered!.tags.map((t) => t.id)).toEqual([tagA.id]);

    // Retag the template after the occurrence already exists.
    await mutationResolvers.setIntervalTags(null, { intervalId: interval.id, tagIds: [tagB.id] }, ctx);

    const unchanged = await prisma.action.findUnique({ where: { id: gathered!.id }, include: { tags: true } });
    expect(unchanged!.tags.map((t) => t.id)).toEqual([tagA.id]);

    // A future gather (a new date the template didn't cover yet) picks up the retag.
    const future = await runActionGathering(prisma, user.id, { todayDateKey: "2025-07-01", skipCompletedDates: false });
    expect(future.actionsCreated).toBeGreaterThan(0);
    const futureAction = await prisma.action.findFirst({
      where: { userId: user.id, isGathered: true, sourceId: interval.id, forDate: new Date("2025-07-01T00:00:00.000Z") },
      include: { tags: true },
    });
    expect(futureAction!.tags.map((t) => t.id)).toEqual([tagB.id]);
  });

  it("a routine's tags propagate identically — snapshot-copied and locked", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const tag = await mutationResolvers.createTag(null, { name: "admin", color: "slate" }, ctx);
    const routine = await prisma.routine.create({
      data: {
        title: "Inbox & triage",
        status: "active",
        estimatedTimeMinutes: 20,
        timeOfDayBlocks: JSON.stringify(["09:00"]),
        userId: user.id,
        tags: { connect: [{ id: tag.id }] },
      },
    });

    await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    const gathered = await prisma.action.findFirst({
      where: { userId: user.id, isGathered: true, sourceId: routine.id },
      include: { tags: true },
    });
    expect(gathered).not.toBeNull();
    expect(gathered!.tags.map((t) => t.id)).toEqual([tag.id]);
    await expect(
      mutationResolvers.setActionTags(null, { actionId: gathered!.id, tagIds: [] }, ctx)
    ).rejects.toThrow(/come from its interval or routine/);
  });
});
