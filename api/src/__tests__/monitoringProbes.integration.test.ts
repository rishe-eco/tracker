import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { validateMonitoringContent } from "../content/skills/monitoring/validate";

// Phase 7 (human key re-derivation) hasn't run yet, so every probe item in
// this pack is genuinely `key-unverified` today — real, correct, and
// asserted below. That gate is content readiness, not the probe container
// this file exists to test, so it's mocked open here the same way
// Delegation's and Verification's probe suites do for their own tools.
vi.mock("../content/skills/monitoring/validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../content/skills/monitoring/validate")>();
  return { ...actual, isProbeReady: () => true };
});

import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const SKILL = "monitoring";

/** Answer one served item well enough to reach a submitted score, whatever its kind (probe forms only ever serve recall, pair, or transcript — build plan §5). */
async function answerItem(ctx: any, served: any): Promise<any> {
  const item = served.item;
  if (item.kind === "recall") {
    await mutationResolvers.commitMonitoringPrediction(null, { attemptId: served.attemptId, level: "confident" }, ctx);
    const outcome = await mutationResolvers.submitMonitoringAnswer(null, { attemptId: served.attemptId, text: "anything" }, ctx);
    return outcome.result;
  }
  if (item.kind === "pair") {
    if (item.pairHalf === "unassisted") {
      await mutationResolvers.commitMonitoringPrediction(null, { attemptId: served.attemptId, level: "confident" }, ctx);
      await mutationResolvers.submitMonitoringAnswer(null, { attemptId: served.attemptId, text: "anything" }, ctx);
    }
    const rated = await mutationResolvers.commitMonitoringRating(null, { attemptId: served.attemptId, phase: "after", value: 5 }, ctx);
    return rated.result;
  }
  if (item.kind === "transcript") {
    return mutationResolvers.markMonitoringInfluence(null, { attemptId: served.attemptId, marks: [] }, ctx);
  }
  throw new Error(`Unexpected kind in a monitoring probe form: ${item.kind}`);
}

/** Serve and answer every row of a probe's form — 9 physical rows (6 recall + 2 pair + 1 transcript, build plan §5's resolution). */
async function runProbeForm(ctx: any, probeId: string): Promise<number> {
  let count = 0;
  for (;;) {
    const served = await mutationResolvers.startMonitoringItem(null, { mode: "assessment", moduleKey: null, probeId }, ctx);
    if (!served) break;
    await answerItem(ctx, served);
    count += 1;
    if (count > 15) throw new Error("runaway loop — a form should have 9 rows");
  }
  return count;
}

describe("real content state (unmocked readiness fact, not probes.ts behaviour)", () => {
  it("still has every probe item key-unverified — Phase 7 hasn't run yet", () => {
    const issues = validateMonitoringContent();
    expect(issues.some((i) => i.code === "key-unverified")).toBe(true);
  });
});

describe("baseline -> post -> delayed completes", () => {
  it("runs the full timepoint sequence with every attempt version-stamped, 9 rows per form", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    expect(baseline.resuming).toBe(false);
    expect(["A", "B", "C"]).toContain(baseline.formId);

    const baselineCount = await runProbeForm(ctx, baseline.probeId);
    expect(baselineCount).toBe(9);

    const baselineComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [50, 60, 40, 70] },
      ctx
    );
    expect(baselineComplete.itemCount).toBe(9);
    const baselineTotals = JSON.parse(baselineComplete.totals);
    expect(baselineTotals.itemCount).toBe(9);
    // 6 s3-resolution recall items per form comfortably clears GAMMA_MIN_ITEMS (4) — unlike Delegation's per-side sparsity, this form's own resolution is meaningful.
    expect(baselineTotals.resolution === null || typeof baselineTotals.resolution === "number").toBe(true);

    const profile = await prisma.skillProfile.findUnique({
      where: { userId_skillKey: { userId: user.id, skillKey: SKILL } },
    });
    expect(profile!.assessmentCompletedAt).not.toBeNull();

    const baselineAttempts = await prisma.skillAttempt.findMany({ where: { probeId: baseline.probeId } });
    expect(baselineAttempts).toHaveLength(9);
    for (const a of baselineAttempts) {
      expect(a.contentVersion).toBe(profile!.contentVersion);
    }

    const post = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "post" }, ctx);
    const postCount = await runProbeForm(ctx, post.probeId);
    expect(postCount).toBe(9);
    await mutationResolvers.completeSkillProbe(null, { skillKey: SKILL, timepoint: "post", selfReport: [10, 20, 30, 40] }, ctx);

    const delayedRow = await prisma.skillProbe.findUnique({
      where: { userId_skillKey_timepoint: { userId: user.id, skillKey: SKILL, timepoint: "delayed" } },
    });
    expect(delayedRow).not.toBeNull();
    expect(delayedRow!.scheduledFor).not.toBeNull();

    await prisma.skillProbe.update({
      where: { id: delayedRow!.id },
      data: { scheduledFor: new Date(Date.now() - 60 * 1000) },
    });

    const delayed = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "delayed" }, ctx);
    const delayedCount = await runProbeForm(ctx, delayed.probeId);
    expect(delayedCount).toBe(9);
    const delayedComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "delayed", selfReport: [0, 0, 0, 0] },
      ctx
    );
    expect(delayedComplete.itemCount).toBe(9);
  }, 60_000);
});

describe("dueSkillProbes", () => {
  it("includes monitoring once every module is mastered", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    expect(await queryResolvers.dueSkillProbes(null, {}, ctx)).toEqual([]);

    for (const moduleKey of ["s1-access", "s2-explain", "s3-resolution", "s4-agreement", "s5-anchor", "s6-complacency"]) {
      await prisma.skillModuleProgress.create({
        data: { userId: user.id, skillKey: SKILL, moduleKey, state: "mastered", masteredAt: new Date() },
      });
    }

    const due = await queryResolvers.dueSkillProbes(null, {}, ctx);
    expect(due).toContainEqual({ skillKey: SKILL, timepoint: "post", scheduledFor: null });
  });
});

describe("a full probe path completes with no credential and no network reachable", () => {
  it("runs baseline end to end with ANTHROPIC_API_KEY unset", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    const token = process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    try {
      const ctx = makeCtx(await createTestUser());
      const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
      const count = await runProbeForm(ctx, baseline.probeId);
      expect(count).toBe(9);
      const complete = await mutationResolvers.completeSkillProbe(
        null,
        { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] },
        ctx
      );
      expect(complete.itemCount).toBe(9);
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });
});
