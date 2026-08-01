import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const serve = (ctx: any, moduleKey?: string) =>
  mutationResolvers.startSkillItem(
    null,
    { skillKey: "evidence", mode: "calibrated_practice", moduleKey },
    ctx
  );

describe("first visit", () => {
  it("loads modules and progress together on a brand-new account", async () => {
    // The Evidence Lab page asks for both in parallel and both create the
    // profile on first contact. Before the fix, the loser of that race hit the
    // (userId, skillKey) unique constraint, its query returned null, and the
    // page sat on a spinner until the learner reloaded — once per account, so
    // exactly the kind of bug that survives a demo.
    const ctx = makeCtx(await createTestUser());
    const [modules, progress] = await Promise.all([
      queryResolvers.skillModules(null, { skillKey: "evidence" }, ctx),
      queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx),
    ]);

    expect(modules).toHaveLength(6);
    expect(progress).not.toBeNull();
    expect(await prisma.skillProfile.count()).toBe(1);
  });

  it("survives several concurrent first requests, not just two", async () => {
    const ctx = makeCtx(await createTestUser());
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx)
      )
    );
    expect(results.every((r) => r != null)).toBe(true);
    expect(await prisma.skillProfile.count()).toBe(1);
  });
});

describe("startSkillItem", () => {
  it("serves an item without leaking anything that answers it", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx);
    expect(served).not.toBeNull();

    // The assertion that matters most in this file. A leaked key breaks nothing
    // visibly — it just makes every score meaningless.
    const payload = JSON.stringify(served);
    expect(served!.item).not.toHaveProperty("key");
    expect(served!.item).not.toHaveProperty("faultTarget");
    expect(served!.item).not.toHaveProperty("nonIndependentHosts");
    expect(served!.item).not.toHaveProperty("profile");
    expect(payload).not.toContain("keyNote");
    expect(payload).not.toContain("reveal");
  });

  it("withholds frozen snapshots outside assessment mode", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx);
    // Practice runs on live search in a new tab; the in-app panel is an
    // assessment affordance, where reproducibility is the point.
    expect(served!.item.snapshotQueries).toBeNull();
  });

  it("opens an attempt row when the item is served, not at submission", async () => {
    const user = await createTestUser();
    const served = await serve(makeCtx(user));
    const attempt = await prisma.skillAttempt.findUnique({ where: { id: served!.attemptId } });
    expect(attempt).not.toBeNull();
    expect(attempt!.userId).toBe(user.id);
    expect(attempt!.scores).toBe("{}");
  });

  it("never serves the same item to a learner twice", async () => {
    const ctx = makeCtx(await createTestUser());
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const served = await serve(ctx);
      if (!served) break;
      expect(seen.has(served.item.itemId)).toBe(false);
      seen.add(served.item.itemId);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it("refuses a scored baseline while any item key is unverified", async () => {
    // The gate doing its job. Practice works today; the baseline unlocks when a
    // human has re-checked the keys and frozen the results.
    const ctx = makeCtx(await createTestUser());
    await expect(
      mutationResolvers.startSkillItem(null, { skillKey: "evidence", mode: "assessment" }, ctx)
    ).rejects.toThrow(/verify the answer key/i);
  });

  it("rejects a skill that is not built yet", async () => {
    const ctx = makeCtx(await createTestUser());
    await expect(
      mutationResolvers.startSkillItem(null, { skillKey: "clarity", mode: "module" }, ctx)
    ).rejects.toThrow(/not built yet/i);
  });
});

describe("logSkillCheckEvent", () => {
  it("timestamps events server-side and refuses another user's attempt", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const other = await createTestUser({ email: "other@example.com" });
    const served = await serve(makeCtx(owner));

    await mutationResolvers.logSkillCheckEvent(
      null,
      { attemptId: served!.attemptId, kind: "opened_sideways" },
      makeCtx(owner)
    );

    const events = await prisma.skillCheckEvent.findMany({ where: { attemptId: served!.attemptId } });
    expect(events).toHaveLength(1);
    expect(events[0].offsetMs).toBeGreaterThanOrEqual(0);

    await expect(
      mutationResolvers.logSkillCheckEvent(
        null,
        { attemptId: served!.attemptId, kind: "opened_sideways" },
        makeCtx(other)
      )
    ).rejects.toThrow("Not found");
  });

  it("rejects an unknown event kind", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx);
    await expect(
      mutationResolvers.logSkillCheckEvent(null, { attemptId: served!.attemptId, kind: "peeked" }, ctx)
    ).rejects.toThrow(/Unknown check event/);
  });
});

describe("submitSkillAttempt", () => {
  async function runChecked(ctx: any) {
    const served = await serve(ctx);
    const id = served!.attemptId;
    await mutationResolvers.logSkillCheckEvent(null, { attemptId: id, kind: "opened_sideways" }, ctx);
    await mutationResolvers.logSkillCheckEvent(
      null,
      { attemptId: id, kind: "source_submitted", payload: "https://tc39.es/ecma262/" },
      ctx
    );
    return { served, id };
  }

  it("reveals the key only after a verdict is committed", async () => {
    const ctx = makeCtx(await createTestUser());
    const { id } = await runChecked(ctx);

    const result = await mutationResolvers.submitSkillAttempt(
      null,
      {
        attemptId: id,
        verdict: "unsupported",
        confidence: 70,
        faultTag: "citation",
        sources: [{ url: "https://www.rfc-editor.org/rfc/rfc7519" }],
      },
      ctx
    );

    expect(result.correctVerdict).toBeTruthy();
    expect(result.reveal.length).toBeGreaterThan(0);
    expect(result.lateral).toBe(1);
    expect(result.strict === 0 || result.strict === 1).toBe(true);
  });

  it("persists the score and refuses a second submission", async () => {
    const ctx = makeCtx(await createTestUser());
    const { id } = await runChecked(ctx);
    const args = {
      attemptId: id,
      verdict: "unsupported",
      confidence: 60,
      faultTag: "citation",
      sources: [{ url: "https://www.rfc-editor.org/rfc/rfc7519" }],
    };

    await mutationResolvers.submitSkillAttempt(null, args, ctx);
    const stored = await prisma.skillAttempt.findUnique({ where: { id } });
    expect(JSON.parse(stored!.scores).strict).toBeDefined();

    await expect(mutationResolvers.submitSkillAttempt(null, args, ctx)).rejects.toThrow(
      /already submitted/i
    );
  });

  it("rejects an out-of-range confidence", async () => {
    const ctx = makeCtx(await createTestUser());
    const { id } = await runChecked(ctx);
    await expect(
      mutationResolvers.submitSkillAttempt(
        null,
        { attemptId: id, verdict: "unsupported", confidence: 140, faultTag: "citation", sources: [] },
        ctx
      )
    ).rejects.toThrow(/between 0 and 100/);
  });

  it("does not credit a check opened after the verdict was committed", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx);
    const id = served!.attemptId;

    // Verdict first, check afterwards — rationalisation, not verification.
    await mutationResolvers.logSkillCheckEvent(null, { attemptId: id, kind: "verdict_set" }, ctx);
    await mutationResolvers.logSkillCheckEvent(null, { attemptId: id, kind: "opened_sideways" }, ctx);
    await mutationResolvers.logSkillCheckEvent(
      null,
      { attemptId: id, kind: "source_submitted", payload: "https://example.com" },
      ctx
    );

    const result = await mutationResolvers.submitSkillAttempt(
      null,
      {
        attemptId: id,
        verdict: "unsupported",
        confidence: 50,
        faultTag: "citation",
        sources: [{ url: "https://example.com" }],
      },
      ctx
    );
    expect(result.lateral).toBe(0);
    expect(result.strict).toBe(0);
  });

  it("refuses to score another user's attempt", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const other = await createTestUser({ email: "other@example.com" });
    const served = await serve(makeCtx(owner));
    await expect(
      mutationResolvers.submitSkillAttempt(
        null,
        { attemptId: served!.attemptId, verdict: "supported", confidence: 50, faultTag: "none", sources: [] },
        makeCtx(other)
      )
    ).rejects.toThrow("Not found");
  });
});

describe("skillModules / skillProgress", () => {
  it("returns the six modules with a starting state", async () => {
    const ctx = makeCtx(await createTestUser());
    const modules = await queryResolvers.skillModules(null, { skillKey: "evidence" }, ctx);
    expect(modules).toHaveLength(6);
    expect(modules[0].state).toBe("not_started");
    expect(modules[0].concept.length).toBeGreaterThan(0);
  });

  it("reports no baseline and why probes are blocked", async () => {
    const ctx = makeCtx(await createTestUser());
    const progress = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx);
    expect(progress.hasBaseline).toBe(false);
    expect(progress.probeReady).toBe(false);
    expect(progress.probeBlockers.length).toBeGreaterThan(0);
    // The Persian pack is machine-drafted until reviewed, and says so.
    expect(["draft", "reviewed"]).toContain(progress.reviewStatus);
  });

  it("keeps one learner's progress out of another's", async () => {
    const a = await createTestUser({ email: "a@example.com" });
    const b = await createTestUser({ email: "b@example.com" });
    const ctxA = makeCtx(a);
    const { id } = await (async () => {
      const served = await serve(ctxA);
      return { id: served!.attemptId };
    })();
    await mutationResolvers.submitSkillAttempt(
      null,
      { attemptId: id, verdict: "unsupported", confidence: 50, faultTag: "citation", sources: [] },
      ctxA
    );

    const progressA = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctxA);
    const progressB = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, makeCtx(b));
    expect(progressA.totalAttempts).toBe(1);
    expect(progressB.totalAttempts).toBe(0);
  });

  it("reports whether calendar planning is on", async () => {
    const ctx = makeCtx(await createTestUser());
    const before = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx);
    expect(before.calendarPlanningEnabled).toBe(false);
  });

  it("records skipping the baseline as a stated absence, not a silent one", async () => {
    const ctx = makeCtx(await createTestUser());
    await mutationResolvers.skipSkillAssessment(null, { skillKey: "evidence" }, ctx);
    const progress = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx);
    expect(progress.assessmentSkipped).toBe(true);
    expect(progress.hasBaseline).toBe(false);
  });
});

describe("calendar planning", () => {
  const plan = (ctx: any, over: Record<string, any> = {}) =>
    mutationResolvers.planSkillSchedule(
      null,
      { skillKey: "evidence", startDate: "2026-08-03", sessionsPerWeek: 3, timeOfDay: "09:00", ...over },
      ctx
    );

  it("writes two sittings per module as ordinary scheduled actions", async () => {
    const user = await createTestUser();
    const result = await plan(makeCtx(user));
    expect(result.created).toBe(12);
    expect(result.warnings).toEqual([]);

    const actions = await prisma.action.findMany({ where: { userId: user.id } });
    expect(actions).toHaveLength(12);
    // Not gathered: the daily-cycle branching only walks gathered actions, so
    // these stay ordinary scheduled work and cannot disturb Pre-day/After-day.
    expect(actions.every((a) => a.isGathered === false)).toBe(true);
    expect(actions.every((a) => a.sourceType === "skill")).toBe(true);
    expect(actions.every((a) => a.sourceId?.startsWith("evidence:"))).toBe(true);
    // Important, not urgent — deliberate practice is the S quadrant.
    expect(actions.every((a) => a.priority === "S")).toBe(true);
    expect(actions.every((a) => a.estimatedTimeMinutes && a.estimatedTimeMinutes > 0)).toBe(true);
  });

  it("replaces the future plan on re-run instead of stacking a second one", async () => {
    const user = await createTestUser();
    await plan(makeCtx(user));
    const second = await plan(makeCtx(user), { sessionsPerWeek: 2 });
    expect(second.removed).toBe(12);
    const actions = await prisma.action.findMany({ where: { userId: user.id } });
    expect(actions).toHaveLength(12);
  });

  it("never rewrites history: completed and past sittings survive re-planning", async () => {
    const user = await createTestUser();
    await plan(makeCtx(user));

    const [first, ...rest] = await prisma.action.findMany({
      where: { userId: user.id },
      orderBy: { tbd: "asc" },
    });
    await prisma.action.update({ where: { id: first.id }, data: { done: true } });
    // A sitting that already happened, still not done.
    await prisma.action.update({
      where: { id: rest[0].id },
      data: { tbd: new Date("2020-01-01T09:00:00.000Z") },
    });

    await plan(makeCtx(user));
    const survivors = await prisma.action.findMany({ where: { userId: user.id } });
    expect(survivors.some((a) => a.id === first.id)).toBe(true);
    expect(survivors.some((a) => a.id === rest[0].id)).toBe(true);
  });

  it("clears the future plan and stops generating, keeping what was done", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await plan(ctx);
    const [first] = await prisma.action.findMany({ where: { userId: user.id }, orderBy: { tbd: "asc" } });
    await prisma.action.update({ where: { id: first.id }, data: { done: true } });

    const removed = await mutationResolvers.clearSkillSchedule(null, { skillKey: "evidence" }, ctx);
    expect(removed).toBe(11);
    const left = await prisma.action.findMany({ where: { userId: user.id } });
    expect(left).toHaveLength(1);
    expect(left[0].done).toBe(true);

    const progress = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx);
    expect(progress.calendarPlanningEnabled).toBe(false);
  });

  it("exposes the plan through skillPlan, scoped to its owner", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const other = await createTestUser({ email: "other@example.com" });
    await plan(makeCtx(owner));

    const ownerPlan = await queryResolvers.skillPlan(null, { skillKey: "evidence" }, makeCtx(owner));
    expect(ownerPlan).toHaveLength(12);
    expect(ownerPlan[0].moduleKey).toBeTruthy();
    expect(ownerPlan[0].title.length).toBeGreaterThan(0);

    const otherPlan = await queryResolvers.skillPlan(null, { skillKey: "evidence" }, makeCtx(other));
    expect(otherPlan).toHaveLength(0);
  });

  it("warns when asked for a single sitting per module", async () => {
    const ctx = makeCtx(await createTestUser());
    const result = await plan(ctx, { sessionsPerModule: 1 });
    expect(result.created).toBe(6);
    expect(result.warnings.join(" ")).toMatch(/two distinct calendar days/i);
  });

  it("rejects an impossible cadence", async () => {
    const ctx = makeCtx(await createTestUser());
    await expect(plan(ctx, { sessionsPerWeek: 0 })).rejects.toThrow(/between 1 and 7/);
    await expect(plan(ctx, { sessionsPerWeek: 9 })).rejects.toThrow(/between 1 and 7/);
    await expect(plan(ctx, { sessionsPerModule: 0 })).rejects.toThrow(/between 1 and 5/);
  });

  it("turns planning on, which is what lets reviews reach the calendar", async () => {
    const ctx = makeCtx(await createTestUser());
    await plan(ctx);
    const progress = await queryResolvers.skillProgress(null, { skillKey: "evidence" }, ctx);
    expect(progress.calendarPlanningEnabled).toBe(true);
  });
});
