import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { DECOMPOSITION_MODULE_KEYS } from "../content/skills/decomposition/types";
import { validateDecompositionContent } from "../content/skills/decomposition/validate";

// Phase 8 (human key verification) hasn't run yet, so every item in every
// tool's pack is genuinely `key-unverified` today — real, correct, and
// asserted below. That gate is content readiness, not the probe container
// this file exists to test, so it's mocked open here the same way an
// unconfigured judge is mocked open in Clarity's own tests.
vi.mock("../content/skills/decomposition/validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../content/skills/decomposition/validate")>();
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

const SKILL = "decomposition";

/**
 * Answer one served Decomposition item well enough to reach a submitted
 * score. Assessment-form items are arrangement/control only (the build plan's
 * "4 decomposable + 2 control" composition), so there is never a diagnosis
 * step to satisfy — only the whole-before-pieces lock.
 */
async function answerItem(ctx: any, attemptId: string) {
  await mutationResolvers.lockDecompositionWhole(
    null,
    { attemptId, statement: "A reframed whole for this task.", doneWhen: "Booked by Friday." },
    ctx
  );
  return mutationResolvers.submitDecompositionAttempt(
    null,
    { attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
    ctx
  );
}

/** Serve and answer every item of a probe's form, then return how many there were. */
async function runProbeForm(ctx: any, probeId: string): Promise<number> {
  let count = 0;
  for (;;) {
    const served = await mutationResolvers.startDecompositionItem(
      null,
      { mode: "assessment", moduleKey: null, probeId },
      ctx
    );
    if (!served) break;
    await answerItem(ctx, served.attemptId);
    count += 1;
    if (count > 12) throw new Error("runaway loop — a form should have 6 items");
  }
  return count;
}

async function markAllModulesMastered(userId: string) {
  for (const moduleKey of DECOMPOSITION_MODULE_KEYS) {
    await prisma.skillModuleProgress.create({
      data: { userId, skillKey: SKILL, moduleKey, state: "mastered", masteredAt: new Date() },
    });
  }
}

describe("real content state (unmocked readiness fact, not probes.ts behaviour)", () => {
  it("still has every probe item key-unverified — Phase 8 hasn't run yet", () => {
    const issues = validateDecompositionContent();
    expect(issues.some((i) => i.code === "key-unverified")).toBe(true);
  });
});

describe("baseline -> six modules -> post -> delayed completes", () => {
  it("runs the full timepoint sequence with every attempt version-stamped", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    // Baseline.
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    expect(baseline.resuming).toBe(false);
    expect(baseline.alreadyCompleted).toBe(false);
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

    // assessmentCompletedAt was never written anywhere before this phase —
    // this is the regression the baseline timepoint exists to fix.
    const profile = await prisma.skillProfile.findUnique({
      where: { userId_skillKey: { userId: user.id, skillKey: SKILL } },
    });
    expect(profile!.assessmentCompletedAt).not.toBeNull();

    // Every attempt served during the probe is stamped with its probeId and
    // the profile's content version.
    const baselineAttempts = await prisma.skillAttempt.findMany({ where: { probeId: baseline.probeId } });
    expect(baselineAttempts).toHaveLength(6);
    for (const a of baselineAttempts) {
      expect(a.contentVersion).toBe(profile!.contentVersion);
    }

    // Post — allowed on demand, no module-mastery gate required.
    const post = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "post" }, ctx);
    expect(post.alreadyCompleted).toBe(false);
    const postCount = await runProbeForm(ctx, post.probeId);
    expect(postCount).toBe(6);
    await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "post", selfReport: [10, 20, 30, 40] },
      ctx
    );

    // Completing post schedules the delayed probe as a row, 7 days out —
    // before this phase, nothing ever wrote a SkillProbe row at all.
    const delayedRow = await prisma.skillProbe.findUnique({
      where: { userId_skillKey_timepoint: { userId: user.id, skillKey: SKILL, timepoint: "delayed" } },
    });
    expect(delayedRow).not.toBeNull();
    expect(delayedRow!.completedAt).toBeNull();
    expect(delayedRow!.scheduledFor).not.toBeNull();
    const daysOut = (delayedRow!.scheduledFor!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(6.9);
    expect(daysOut).toBeLessThan(7.1);

    // Starting the delayed probe before it's due is a sequence error, not a
    // silent early start — the whole point of this timepoint is a real gap.
    await expect(
      mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "delayed" }, ctx)
    ).rejects.toThrow(/isn't due yet/);

    // Simulate the 7 days having passed.
    await prisma.skillProbe.update({
      where: { id: delayedRow!.id },
      data: { scheduledFor: new Date(Date.now() - 60 * 1000) },
    });

    const delayed = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "delayed" }, ctx);
    expect(delayed.resuming).toBe(false);
    expect(delayed.probeId).toBe(delayedRow!.id);
    const delayedCount = await runProbeForm(ctx, delayed.probeId);
    expect(delayedCount).toBe(6);
    const delayedComplete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "delayed", selfReport: [0, 0, 0, 0] },
      ctx
    );
    expect(delayedComplete.itemCount).toBe(6);

    // No fourth row appears — completing delayed does not schedule anything further.
    const allProbes = await prisma.skillProbe.findMany({ where: { userId: user.id, skillKey: SKILL } });
    expect(allProbes).toHaveLength(3);
  });
});

describe("completeSkillProbe rejects", () => {
  it("a second completion of the same timepoint", async () => {
    const ctx = makeCtx(await createTestUser());
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] },
      ctx
    );
    await expect(
      mutationResolvers.completeSkillProbe(null, { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] }, ctx)
    ).rejects.toThrow(/already completed/);
  });

  it("completion before every item in the form is answered", async () => {
    const ctx = makeCtx(await createTestUser());
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    // Answer only one of the six items.
    const served = await mutationResolvers.startDecompositionItem(
      null,
      { mode: "assessment", moduleKey: null, probeId: baseline.probeId },
      ctx
    );
    await answerItem(ctx, served!.attemptId);
    await expect(
      mutationResolvers.completeSkillProbe(null, { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] }, ctx)
    ).rejects.toThrow(/finish the form/);
  });

  it("a malformed self-report", async () => {
    const ctx = makeCtx(await createTestUser());
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    await expect(
      mutationResolvers.completeSkillProbe(null, { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1] }, ctx)
    ).rejects.toThrow(/exactly 4/);
    await expect(
      mutationResolvers.completeSkillProbe(null, { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 200] }, ctx)
    ).rejects.toThrow(/between 0 and 100/);
  });
});

describe("assessment items require a probe", () => {
  it("rejects serving an assessment-mode item with no probeId", async () => {
    const ctx = makeCtx(await createTestUser());
    await expect(
      mutationResolvers.startDecompositionItem(null, { mode: "assessment", moduleKey: null }, ctx)
    ).rejects.toThrow(/call startSkillProbe first/);
  });
});

describe("self-report is collected and never enters totals", () => {
  it("keeps selfReport out of the totals JSON and out of the score entirely", async () => {
    const ctx = makeCtx(await createTestUser());
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    const complete = await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [12, 34, 56, 78] },
      ctx
    );
    expect(complete.totals).not.toContain("selfReport");
    expect(complete.totals).not.toContain("12,34,56,78");

    const entry = await queryResolvers.skillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline" },
      ctx
    );
    expect(JSON.parse(entry.selfReport)).toEqual([12, 34, 56, 78]);
  });
});

describe("comparability is enforced in code", () => {
  it("marks a probe non-comparable once the learner's pinned version moves on", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 1, 1, 1] },
      ctx
    );

    const before = await queryResolvers.skillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    expect(before.comparable).toBe(true);

    // Simulate a later content-version bump the learner has moved onto —
    // the probe row itself is untouched (it recorded the version it was
    // actually scored under), only the profile's pin changes.
    await prisma.skillProfile.update({
      where: { userId_skillKey: { userId: user.id, skillKey: SKILL } },
      data: { contentVersion: "decomposition/v2-hypothetical" },
    });

    const after = await queryResolvers.skillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    expect(after.comparable).toBe(false);
  });
});

describe("dueSkillProbes", () => {
  it("surfaces post once every module is mastered/tested-out, and delayed once it's due", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    expect(await queryResolvers.dueSkillProbes(null, {}, ctx)).toEqual([]);

    await markAllModulesMastered(user.id);
    const due1 = await queryResolvers.dueSkillProbes(null, {}, ctx);
    expect(due1).toContainEqual({ skillKey: SKILL, timepoint: "post", scheduledFor: null });

    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "post" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "post", selfReport: [1, 1, 1, 1] },
      ctx
    );

    // Post is no longer due once completed, and the freshly-scheduled delayed
    // probe is not yet due (it's 7 days out).
    const due2 = await queryResolvers.dueSkillProbes(null, {}, ctx);
    expect(due2.find((d: any) => d.timepoint === "post")).toBeUndefined();
    expect(due2.find((d: any) => d.timepoint === "delayed")).toBeUndefined();

    await prisma.skillProbe.update({
      where: { userId_skillKey_timepoint: { userId: user.id, skillKey: SKILL, timepoint: "delayed" } },
      data: { scheduledFor: new Date(Date.now() - 1000) },
    });

    const due3 = await queryResolvers.dueSkillProbes(null, {}, ctx);
    expect(due3.some((d: any) => d.skillKey === SKILL && d.timepoint === "delayed")).toBe(true);
  });
});

describe("skillExport", () => {
  it("returns JSON and a markdown summary covering every attempt and probe", async () => {
    const ctx = makeCtx(await createTestUser());
    const baseline = await mutationResolvers.startSkillProbe(null, { skillKey: SKILL, timepoint: "baseline" }, ctx);
    await runProbeForm(ctx, baseline.probeId);
    await mutationResolvers.completeSkillProbe(
      null,
      { skillKey: SKILL, timepoint: "baseline", selfReport: [1, 2, 3, 4] },
      ctx
    );

    const result = await queryResolvers.skillExport(null, { skillKey: SKILL }, ctx);
    const parsed = JSON.parse(result.json);
    expect(parsed.attempts).toHaveLength(6);
    expect(parsed.probes).toHaveLength(1);
    expect(parsed.probes[0].timepoint).toBe("baseline");
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
