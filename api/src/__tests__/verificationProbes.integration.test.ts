import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { validateVerificationContent } from "../content/skills/verification/validate";

// Phase 8 (human key verification) hasn't run yet, so every item in this
// pack is genuinely `key-unverified` today — real, correct, and asserted
// below. That gate is content readiness, not the probe container this file
// exists to test, so it's mocked open here the same way skillProbes.integration
// mocks Decomposition's readiness open.
vi.mock("../content/skills/verification/validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../content/skills/verification/validate")>();
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

const SKILL = "verification";

/**
 * Answer one served item well enough to reach a submitted score. Probe items
 * are always unassisted (build plan §5), so every item goes through the
 * two-step localisation: commit carries free text, then the pick scores it.
 */
async function answerItem(ctx: any, served: any) {
  await mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "Check it somehow." }, ctx);
  await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c1_self_critique" }, ctx);
  const commit = await mutationResolvers.commitVerificationVerdict(
    null,
    { attemptId: served.attemptId, verdict: "supported", confidence: 50, residualRisk: "something", elementFreeText: "n/a" },
    ctx
  );
  return mutationResolvers.setVerificationLocalization(
    null,
    { attemptId: served.attemptId, elementId: commit.elements[0].elementId },
    ctx
  );
}

/** Serve and answer every item of a probe's form, then return how many there were. */
async function runProbeForm(ctx: any, probeId: string): Promise<number> {
  let count = 0;
  for (;;) {
    const served = await mutationResolvers.startVerificationItem(null, { mode: "assessment", moduleKey: null, probeId }, ctx);
    if (!served) break;
    expect(served.rung).toBe("unassisted");
    await answerItem(ctx, served);
    count += 1;
    if (count > 12) throw new Error("runaway loop — a form should have 6 items");
  }
  return count;
}

describe("real content state (unmocked readiness fact, not probes.ts behaviour)", () => {
  it("still has every probe item key-unverified — Phase 8 hasn't run yet", () => {
    const issues = validateVerificationContent();
    expect(issues.some((i) => i.code === "key-unverified")).toBe(true);
  });
});

describe("probes run unassisted regardless of the module's practice rung", () => {
  it("stamps rung unassisted on an assessment item even after the module is set to assisted", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "assisted" }, ctx);

    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    const served = await mutationResolvers.startVerificationItem(null, { mode: "assessment", moduleKey: null, probeId: baseline.probeId }, ctx);
    expect(served.rung).toBe("unassisted");
    expect(served.assistedCeilingSeconds).toBeNull();

    const attempt = await prisma.skillAttempt.findUnique({ where: { id: served.attemptId } });
    expect(attempt!.rung).toBe("unassisted");
  });
});

describe("baseline -> post -> delayed completes", () => {
  it("runs the full timepoint sequence with every attempt version-stamped", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    expect(baseline.resuming).toBe(false);
    expect(["A", "B", "C"]).toContain(baseline.formId);

    const baselineCount = await runProbeForm(ctx, baseline.probeId);
    expect(baselineCount).toBe(6);

    const baselineComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [50, 60, 40, 70] },
      ctx
    );
    expect(baselineComplete.itemCount).toBe(6);
    const baselineTotals = JSON.parse(baselineComplete.totals);
    expect(baselineTotals.itemCount).toBe(6);
    expect(typeof baselineTotals.strictComposite).toBe("number");
    expect(typeof baselineTotals.ritualRate).toBe("number");

    const profile = await prisma.skillProfile.findUnique({
      where: { userId_skillKey: { userId: user.id, skillKey: SKILL } },
    });
    expect(profile!.assessmentCompletedAt).not.toBeNull();

    const baselineAttempts = await prisma.skillAttempt.findMany({ where: { probeId: baseline.probeId } });
    expect(baselineAttempts).toHaveLength(6);
    for (const a of baselineAttempts) {
      expect(a.contentVersion).toBe(profile!.contentVersion);
      expect(a.rung).toBe("unassisted");
    }

    const post = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "post" }, ctx);
    const postCount = await runProbeForm(ctx, post.probeId);
    expect(postCount).toBe(6);
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
    expect(delayedCount).toBe(6);
    const delayedComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "delayed", selfReport: [0, 0, 0, 0] },
      ctx
    );
    expect(delayedComplete.itemCount).toBe(6);
  });
});

describe("dueSkillProbes", () => {
  it("includes verification once every module is mastered/tested-out", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    expect(await queryResolvers.dueSkillProbes(null, {}, ctx)).toEqual([]);

    for (const moduleKey of ["v1-oracle", "v2-independent", "v3-falsify", "v4-cheapest", "v5-locate", "v6-unverifiable"]) {
      await prisma.skillModuleProgress.create({
        data: { userId: user.id, skillKey: SKILL, moduleKey, state: "mastered", masteredAt: new Date() },
      });
    }

    const due = await queryResolvers.dueSkillProbes(null, {}, ctx);
    expect(due).toContainEqual({ skillKey: SKILL, timepoint: "post", scheduledFor: null });
  });
});

describe("skillExport", () => {
  it("returns JSON and a markdown summary covering the probe", async () => {
    const ctx = makeCtx(await createTestUser());
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    await mutationResolvers.completeSkillProbe(null, { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 2, 3, 4] }, ctx);

    const result = await queryResolvers.skillExport(null, { skillKey: SKILL }, ctx);
    const parsed = JSON.parse(result.json);
    expect(parsed.attempts).toHaveLength(6);
    expect(parsed.probes).toHaveLength(1);
    expect(result.markdown).toContain("baseline");
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
      expect(count).toBe(6);
      const complete = await mutationResolvers.completeSkillProbe(
        null,
        { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] },
        ctx
      );
      expect(complete.itemCount).toBe(6);
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });
});
