import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * A fresh user's first `startDelegationItem` call for a module always serves
 * the pool's lowest-difficulty item (stable sort, first in authored array
 * order among ties) — see `delegation/v1/spec.ts`'s pool ordering. Each call
 * permanently "uses up" that item, so calling this `n` times walks the pool
 * in a fixed, predictable order.
 */
async function serveNth(ctx: any, moduleKey: string, n: number) {
  let served: any = null;
  for (let i = 0; i < n; i++) {
    served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey, probeId: null }, ctx);
  }
  return served;
}

describe("startDelegationItem — the ordering rule", () => {
  it("never ships advice or truth in the served item", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g3-weigh", probeId: null }, ctx);

    expect(served).not.toBeNull();
    expect(Object.keys(served.item)).not.toContain("advice");
    expect(Object.keys(served.item)).not.toContain("truth");
    expect((served.item as any).advice).toBeUndefined();
    expect((served.item as any).truth).toBeUndefined();
  });
});

describe("commitDelegationEstimate", () => {
  it("returns the advice, and rejects a second commit", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g3-weigh", probeId: null }, ctx);

    const advice = await mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 1400, confidence: 60 }, ctx);
    expect(typeof advice.advice).toBe("number");

    await expect(
      mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 1400, confidence: 60 }, ctx)
    ).rejects.toThrow(/already committed/);
  });

  it("rejects a revision committed before any estimate", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g3-weigh", probeId: null }, ctx);

    await expect(
      mutationResolvers.commitDelegationRevision(null, { attemptId: served.attemptId, value: 1400 }, ctx)
    ).rejects.toThrow(/Commit an estimate/);
  });
});

describe("estimate-kind full flow (g3-weigh)", () => {
  it("scores G3 and leaves every other criterion unscored", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g3-weigh", probeId: null }, ctx);
    await mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 1400, confidence: 60 }, ctx);

    const outcome = await mutationResolvers.commitDelegationRevision(null, { attemptId: served.attemptId, value: 1420 }, ctx);
    expect(outcome.stage).toBe("scored");
    const g3 = outcome.result.score.criteria.find((c: any) => c.id === "G3");
    expect(g3.level).not.toBeNull();
    for (const c of outcome.result.score.criteria) {
      if (c.id !== "G3") expect(c.level).toBeNull();
    }
  });

  it("marks an out-of-range initial estimate void, with no net gain", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g3-weigh", probeId: null }, ctx);
    await mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 999999, confidence: 60 }, ctx);
    const outcome = await mutationResolvers.commitDelegationRevision(null, { attemptId: served.attemptId, value: 999999 }, ctx);

    expect(outcome.result.score.isVoid).toBe(true);
    expect(outcome.result.score.netGain).toBeNull();
  });
});

describe("cue-kind full flow (g2-instance)", () => {
  it("waits for a cue selection before scoring", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g2-instance", probeId: null }, ctx);
    await mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 260, confidence: 70 }, ctx);

    const revised = await mutationResolvers.commitDelegationRevision(null, { attemptId: served.attemptId, value: 255 }, ctx);
    expect(revised.stage).toBe("needsCue");
    expect(revised.cueOptions.length).toBeGreaterThanOrEqual(3);

    const cueId = revised.cueOptions[0].cueId;
    const scored = await mutationResolvers.selectDelegationCue(null, { attemptId: served.attemptId, cueId }, ctx);
    const g2 = scored.score.criteria.find((c: any) => c.id === "G2");
    expect(g2.level).not.toBeNull();
  });
});

describe("split-kind full flow (g4-split)", () => {
  it("scores G4 directly with no estimate step, and rejects an estimate commit on a split item", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g4-split", probeId: null }, ctx);

    await expect(
      mutationResolvers.commitDelegationEstimate(null, { attemptId: served.attemptId, value: 1, confidence: 50 }, ctx)
    ).rejects.toThrow(/does not take a plain estimate/);

    const pieceIds: string[] = served.item.splitPieces.map((p: any) => p.pieceId);
    const dispositions = pieceIds.map((pieceId, i) => ({ pieceId, disposition: i === 0 ? "give" : "keep" }));
    const result = await mutationResolvers.commitDelegationSplit(null, { attemptId: served.attemptId, dispositions }, ctx);

    const g4 = result.score.criteria.find((c: any) => c.id === "G4");
    expect(g4.level).not.toBeNull();
  });
});

describe("sequence full flow (g6-drift)", () => {
  it("scores G6 only after all three rounds land, in order", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startDelegationItem(null, { mode: "module", moduleKey: "g6-drift", probeId: null }, ctx);

    await expect(
      mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 1, value: 40, phase: "estimate" }, ctx)
    ).rejects.toThrow(/out of order/);

    // g6-p1's authored rounds: round0 advice 45, round1 (seeded error) advice
    // 70, round2 advice 40. Chosen so round0's and round2's WOA both land
    // comfortably away from zero — dropRatio is undefined otherwise (§4.3).
    const r0 = await mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 0, value: 40, phase: "estimate" }, ctx);
    expect(r0.stage).toBe("advice");
    expect(typeof r0.advice).toBe("number");
    const r0rev = await mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 0, value: 43, phase: "revision" }, ctx);
    expect(r0rev.stage).toBe("recorded");

    await mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 1, value: 42, phase: "estimate" }, ctx);
    await mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 1, value: 50, phase: "revision" }, ctx);

    await mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 2, value: 36, phase: "estimate" }, ctx);
    const final = await mutationResolvers.commitSequenceRound(null, { attemptId: served.attemptId, roundIndex: 2, value: 38, phase: "revision" }, ctx);

    expect(final.stage).toBe("scored");
    const g6 = final.result.score.criteria.find((c: any) => c.id === "G6");
    expect(g6.level).not.toBeNull();
  });
});

describe("g5-stakes pair scoring — a pair, not two independent items", () => {
  it("holds G5 pending on the first half, and resolves it on the second", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const low = await serveNth(ctx, "g5-stakes", 1);
    await mutationResolvers.commitDelegationEstimate(null, { attemptId: low.attemptId, value: 640, confidence: 60 }, ctx);
    const lowResult = await mutationResolvers.commitDelegationRevision(null, { attemptId: low.attemptId, value: 650 }, ctx);
    expect(lowResult.result.score.pendingPair).toBe(true);
    expect(lowResult.result.score.criteria.find((c: any) => c.id === "G5").level).toBeNull();

    const high = await serveNth(ctx, "g5-stakes", 1);
    await mutationResolvers.commitDelegationEstimate(null, { attemptId: high.attemptId, value: 640, confidence: 60 }, ctx);
    const highResult = await mutationResolvers.commitDelegationRevision(
      null,
      { attemptId: high.attemptId, value: 645, recoverabilityMove: true },
      ctx
    );
    expect(highResult.result.score.pendingPair).toBe(false);
    expect(highResult.result.score.criteria.find((c: any) => c.id === "G5").level).not.toBeNull();
  });
});
