import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { validateDelegationContent } from "../content/skills/delegation/validate";

// Phase 7 (human key re-derivation) hasn't run yet, so every probe item in
// this pack is genuinely `key-unverified` today — real, correct, and
// asserted below. That gate is content readiness, not the probe container
// this file exists to test, so it's mocked open here the same way
// verificationProbes.integration does for its own tool.
vi.mock("../content/skills/delegation/validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../content/skills/delegation/validate")>();
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

const SKILL = "delegation";

/** Answer one served item well enough to reach a submitted score, whatever its kind. */
async function answerItem(ctx: any, served: any) {
  const item = served.item;
  if (item.kind === "split") {
    const dispositions = item.splitPieces.map((p: any) => ({ pieceId: p.pieceId, disposition: "keep" }));
    return mutationResolvers.commitDelegationSplit(null, { attemptId: served.attemptId, dispositions }, ctx);
  }
  if (item.kind === "sequence") {
    let last: any;
    for (let round = 0; round < item.totalRounds; round++) {
      const advice = await mutationResolvers.commitSequenceRound(
        null,
        { attemptId: served.attemptId, roundIndex: round, value: 10, phase: "estimate" },
        ctx
      );
      expect(typeof advice.advice).toBe("number");
      last = await mutationResolvers.commitSequenceRound(
        null,
        { attemptId: served.attemptId, roundIndex: round, value: 11, phase: "revision" },
        ctx
      );
    }
    return last.result;
  }

  await mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 10, confidence: 50 }, ctx);
  const revised = await mutationResolvers.commitDelegationRevision(null, { attemptId: served.attemptId, value: 11 }, ctx);
  if (revised.stage === "scored") return revised.result;
  return mutationResolvers.selectDelegationCue(null, { attemptId: served.attemptId, cueId: revised.cueOptions[0].cueId }, ctx);
}

/** Serve and answer every row of a probe's form — 7 physical rows (5 single-item modules + the g5 pair), scoring as 6 units (spec §7). */
async function runProbeForm(ctx: any, probeId: string): Promise<number> {
  let count = 0;
  for (;;) {
    const served = await mutationResolvers.startDelegationItem(null, { mode: "assessment", moduleKey: null, probeId }, ctx);
    if (!served) break;
    await answerItem(ctx, served);
    count += 1;
    if (count > 14) throw new Error("runaway loop — a form should have 7 rows");
  }
  return count;
}

describe("real content state (unmocked readiness fact, not probes.ts behaviour)", () => {
  it("still has every probe item key-unverified — Phase 7 hasn't run yet", () => {
    const issues = validateDelegationContent();
    expect(issues.some((i) => i.code === "key-unverified")).toBe(true);
  });
});

describe("baseline -> post -> delayed completes", () => {
  // 3 timepoints x 7 rows x several sequential mutation round-trips each —
  // ~20s alone, comfortably over the default 30s under full-suite worker
  // contention (observed: Verification Lab's equally-heavy equivalent test
  // times out the same way under load, though not in isolation).
  it("runs the full timepoint sequence with every attempt version-stamped, 7 rows per form", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    expect(baseline.resuming).toBe(false);
    expect(["A", "B", "C"]).toContain(baseline.formId);

    const baselineCount = await runProbeForm(ctx, baseline.probeId);
    expect(baselineCount).toBe(7);

    const baselineComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [50, 60, 40, 70] },
      ctx
    );
    expect(baselineComplete.itemCount).toBe(7);
    const baselineTotals = JSON.parse(baselineComplete.totals);
    expect(baselineTotals.itemCount).toBe(7);

    const profile = await prisma.skillProfile.findUnique({
      where: { userId_skillKey: { userId: user.id, skillKey: SKILL } },
    });
    expect(profile!.assessmentCompletedAt).not.toBeNull();

    const baselineAttempts = await prisma.skillAttempt.findMany({ where: { probeId: baseline.probeId } });
    expect(baselineAttempts).toHaveLength(7);
    for (const a of baselineAttempts) {
      expect(a.contentVersion).toBe(profile!.contentVersion);
    }

    const post = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "post" }, ctx);
    const postCount = await runProbeForm(ctx, post.probeId);
    expect(postCount).toBe(7);
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
    expect(delayedCount).toBe(7);
    const delayedComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "delayed", selfReport: [0, 0, 0, 0] },
      ctx
    );
    expect(delayedComplete.itemCount).toBe(7);
  }, 60_000);
});

describe("dueSkillProbes", () => {
  it("includes delegation once every module is mastered", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    expect(await queryResolvers.dueSkillProbes(null, {}, ctx)).toEqual([]);

    for (const moduleKey of ["g1-own", "g2-instance", "g3-weigh", "g4-split", "g5-stakes", "g6-drift"]) {
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
      expect(count).toBe(7);
      const complete = await mutationResolvers.completeSkillProbe(
        null,
        { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] },
        ctx
      );
      expect(complete.itemCount).toBe(7);
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });
});
