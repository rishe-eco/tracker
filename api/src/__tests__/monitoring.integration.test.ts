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

describe("startMonitoringItem — the ordering rule", () => {
  it("never ships an answer key, causal steps, planted tags, or a longset's claimCorrect/attentionDependent", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const recall = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s3-resolution", probeId: null }, ctx);
    expect(recall).not.toBeNull();
    expect((recall.item as any).answerVariants).toBeUndefined();
    expect((recall.item as any).requiredTokens).toBeUndefined();

    const explain = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s2-explain", probeId: null }, ctx);
    expect((explain.item as any).causalSteps).toBeUndefined();

    const transcript = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s4-agreement", probeId: null }, ctx);
    expect((transcript.item as any).planted).toBeUndefined();
    expect(transcript.item.turns).not.toBeNull();
    for (const t of transcript.item.turns as any[]) expect(t).not.toHaveProperty("planted");

    const longset = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s6-complacency", probeId: null }, ctx);
    for (const c of (longset.item as any).checkpoints ?? []) expect(c).not.toHaveProperty("claimCorrect");
    for (const o of (longset.item as any).countermeasureOptions ?? []) expect(o).not.toHaveProperty("attentionDependent");
  });
});

describe("recall (s3-resolution) full flow", () => {
  it("rejects an answer before a prediction, then scores with a predictionSample and no per-attempt S3 level", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s3-resolution", probeId: null }, ctx);

    await expect(mutationResolvers.submitMonitoringAnswer(null, { attemptId: served.attemptId, text: "anything" }, ctx)).rejects.toThrow(/Commit a prediction/);

    await mutationResolvers.commitMonitoringPrediction(null, { attemptId: served.attemptId, level: "confident" }, ctx);
    await expect(
      mutationResolvers.commitMonitoringPrediction(null, { attemptId: served.attemptId, level: "probably" }, ctx)
    ).rejects.toThrow(/already committed/);

    const outcome = await mutationResolvers.submitMonitoringAnswer(null, { attemptId: served.attemptId, text: "paris" }, ctx);
    expect(outcome.stage).toBe("scored");
    expect(outcome.result.score.predictionSample).toEqual({ prediction: "confident", outcome: expect.any(Number) });
    // S3 never gets a per-attempt level — it's a window-level pattern (build plan §4.1's own reasoning applied to scoring.ts).
    const s3 = outcome.result.score.criteria.find((c: any) => c.id === "S3");
    expect(s3.level).toBeNull();
    expect(s3.scoredBy).toBe("unscored");
  });
});

describe("pair (s1-access) full flow — a half never scores alone", () => {
  it("scores the unassisted half only after both an answer and a rating", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const unassisted = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s1-access", probeId: null }, ctx);
    expect(unassisted.item.pairHalf).toBe("unassisted");
    expect(unassisted.item.authoredExplanation).toBeNull();

    await mutationResolvers.commitMonitoringPrediction(null, { attemptId: unassisted.attemptId, level: "probably" }, ctx);
    const answerOutcome = await mutationResolvers.submitMonitoringAnswer(null, { attemptId: unassisted.attemptId, text: "100" }, ctx);
    expect(answerOutcome.stage).toBe("needsRating");
    expect(answerOutcome.result).toBeNull();

    const ratingOutcome = await mutationResolvers.commitMonitoringRating(null, { attemptId: unassisted.attemptId, phase: "after", value: 7 }, ctx);
    expect(ratingOutcome.stage).toBe("scored");
    expect(ratingOutcome.result.score.ratingSample).toEqual({ pairId: "s1-pair-01", pairHalf: "unassisted", rating: 7 });
    expect(ratingOutcome.result.score.predictionSample).not.toBeNull();
  });

  it("scores the assisted half from a rating alone — no prediction, no answer", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    // Consume the unassisted half first (pool order) to reach the assisted half.
    await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s1-access", probeId: null }, ctx);
    const assisted = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s1-access", probeId: null }, ctx);
    expect(assisted.item.pairHalf).toBe("assisted");
    expect(typeof assisted.item.authoredExplanation).toBe("string");
    expect((assisted.item.authoredExplanation as string).length).toBeGreaterThan(0);

    const outcome = await mutationResolvers.commitMonitoringRating(null, { attemptId: assisted.attemptId, phase: "after", value: 9 }, ctx);
    expect(outcome.stage).toBe("scored");
    expect(outcome.result.score.ratingSample).toEqual({ pairId: "s1-pair-01", pairHalf: "assisted", rating: 9 });
    expect(outcome.result.score.predictionSample).toBeNull();
  });
});

describe("explain (s2-explain) — the D-45 ordering fix", () => {
  it("rejects a step selection before the re-rating lands", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s2-explain", probeId: null }, ctx);

    await mutationResolvers.commitMonitoringRating(null, { attemptId: served.attemptId, phase: "before", value: 8 }, ctx);
    const explanationResult = await mutationResolvers.commitMonitoringExplanation(null, { attemptId: served.attemptId, text: "it just works" }, ctx);
    expect(explanationResult.steps.length).toBe(3);

    await expect(
      mutationResolvers.selectMonitoringSteps(null, { attemptId: served.attemptId, stepIds: [explanationResult.steps[0].stepId] }, ctx)
    ).rejects.toThrow(/Re-rate/);

    await mutationResolvers.commitMonitoringRating(null, { attemptId: served.attemptId, phase: "after", value: 5 }, ctx);
    const outcome = await mutationResolvers.selectMonitoringSteps(null, { attemptId: served.attemptId, stepIds: [explanationResult.steps[0].stepId] }, ctx);
    expect(outcome.score.deflation).toEqual({ before: 8, after: 5 });
    const s2 = outcome.score.criteria.find((c: any) => c.id === "S2");
    expect(s2.scoredBy).toBe("key");
  });
});

describe("transcript (s4-agreement, s5-anchor)", () => {
  it("scores level 2 on a clean control when nothing is marked", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    // Walk the s4-agreement pool until a clean control is served.
    let served: any;
    let attempt: any;
    for (let i = 0; i < 6; i++) {
      attempt = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s4-agreement", probeId: null }, ctx);
      if (attempt === null) break;
      served = attempt;
      const outcome = await mutationResolvers.markMonitoringInfluence(null, { attemptId: served.attemptId, marks: [] }, ctx);
      const s4 = outcome.score.criteria.find((c: any) => c.id === "S4");
      if (outcome.score.influenceResult.plantedTotal === 0) {
        expect(s4.level).toBe(2);
        return;
      }
    }
    throw new Error("No clean s4-agreement control found in the pool within 6 items.");
  });

  it("penalizes a false alarm on a clean control", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    for (let i = 0; i < 6; i++) {
      const served = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s4-agreement", probeId: null }, ctx);
      if (served === null) break;
      const turnId = served.item.turns![0].turnId;
      const outcome = await mutationResolvers.markMonitoringInfluence(null, { attemptId: served.attemptId, marks: [{ turnId, movedWhat: "something" }] }, ctx);
      if (outcome.score.influenceResult.plantedTotal === 0) {
        const s4 = outcome.score.criteria.find((c: any) => c.id === "S4");
        expect(s4.level).toBeLessThan(2);
        expect(outcome.score.influenceResult.falseAlarms).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error("No clean s4-agreement control found in the pool within 6 items.");
  });
});

describe("longset (s6-complacency)", () => {
  it("scores 2 for an attention-independent countermeasure and 0 for bare effort", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const served1 = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s6-complacency", probeId: null }, ctx);
    for (const c of served1.item.checkpoints as any[]) {
      await mutationResolvers.markMonitoringCheckpoint(null, { attemptId: served1.attemptId, checkpointId: c.checkpointId, checked: true }, ctx);
    }
    const independentOption = served1.item.countermeasureOptions!.find((o: any) => o.optionId === "structural_every5")!;
    const outcome1 = await mutationResolvers.selectMonitoringCountermeasure(null, { attemptId: served1.attemptId, optionId: independentOption.optionId }, ctx);
    expect(outcome1.score.criteria.find((c: any) => c.id === "S6").level).toBe(2);
    expect(outcome1.score.checkRate.firstThird).toBe(1);

    const served2 = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s6-complacency", probeId: null }, ctx);
    const bareEffortOption = served2.item.countermeasureOptions!.find((o: any) => o.optionId === "effort_careful")!;
    const outcome2 = await mutationResolvers.selectMonitoringCountermeasure(null, { attemptId: served2.attemptId, optionId: bareEffortOption.optionId }, ctx);
    expect(outcome2.score.criteria.find((c: any) => c.id === "S6").level).toBe(0);
    expect(outcome2.score.checkRate.firstThird).toBe(0);
  });
});

describe("monitoringProgress — resolution never appears without performance", () => {
  it("returns null resolution/performance with no scored s3 items, and populates both once scored", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const before = await queryResolvers.monitoringProgress(null, {}, ctx);
    expect(before.resolution).toBeNull();
    expect(before.performance).toBeNull();

    for (let i = 0; i < 4; i++) {
      const served = await mutationResolvers.startMonitoringItem(null, { mode: "module", moduleKey: "s3-resolution", probeId: null }, ctx);
      await mutationResolvers.commitMonitoringPrediction(null, { attemptId: served.attemptId, level: i % 2 === 0 ? "confident" : "no_idea" }, ctx);
      await mutationResolvers.submitMonitoringAnswer(null, { attemptId: served.attemptId, text: i % 2 === 0 ? "right answer" : "wrong" }, ctx);
    }

    const after = await queryResolvers.monitoringProgress(null, {}, ctx);
    expect(after.performance).not.toBeNull();
    expect(after.postAiInflationReady).toBe(false);
    expect(after.postAiInflation).toBeNull();
  });
});
