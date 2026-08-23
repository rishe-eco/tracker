import { describe, expect, it } from "vitest";
import { adviceQualityFor, dropRatioFor, netGainFor, scoreStableUpdating, scoreStakesPair } from "../services/skills/delegation/metrics";
import { anchoringFor, discriminationFor, relianceRates, calibrationBrier } from "../services/skills/delegation/metrics";
import { scoreCueSelection, scoreSplitDisposition } from "../services/skills/delegation/scoring";
import { evaluateKeyedMastery, evaluateWeighingMastery } from "../services/skills/delegation/mastery";

describe("adviceQualityFor / netGainFor", () => {
  it("is good when advice is more accurate than the learner's own estimate", () => {
    expect(adviceQualityFor(900, 1270, 1270)).toBe("good");
  });
  it("is bad when advice is less accurate", () => {
    expect(adviceQualityFor(1955, 1958, 1952)).toBe("bad");
  });
  it("computes net gain from advice", () => {
    expect(netGainFor(900, 1260, 1270)).toBe(370 - 10);
  });
});

describe("scoreStakesPair (build plan §4.4)", () => {
  it("scores 2 on reduced reliance", () => {
    expect(scoreStakesPair({ woaLow: 0.7, woaHigh: 0.4, recoverabilityMoveHigh: false })).toBe(2);
  });
  it("scores 2 on insured reliance — kept and made recoverable", () => {
    expect(scoreStakesPair({ woaLow: 0.7, woaHigh: 0.68, recoverabilityMoveHigh: true })).toBe(2);
  });
  it("scores 0 when unchanged with no recoverability move", () => {
    expect(scoreStakesPair({ woaLow: 0.7, woaHigh: 0.71, recoverabilityMoveHigh: false })).toBe(0);
  });
  it("scores 1 on some change below threshold with no recoverability move", () => {
    expect(scoreStakesPair({ woaLow: 0.7, woaHigh: 0.6, recoverabilityMoveHigh: false })).toBe(1);
  });
  it("is null until both halves exist", () => {
    expect(scoreStakesPair({ woaLow: null, woaHigh: 0.5, recoverabilityMoveHigh: false })).toBeNull();
  });
});

describe("dropRatioFor / scoreStableUpdating (build plan §4.3, §4.5)", () => {
  it("scores 0 on collapse", () => {
    const ratio = dropRatioFor(0.52, 0.08);
    expect(scoreStableUpdating(ratio)).toBe(0);
  });
  it("scores 2 on proportionate reduction", () => {
    const ratio = dropRatioFor(0.52, 0.34);
    expect(scoreStableUpdating(ratio)).toBe(2);
  });
  it("scores 0 when there is no update at all (mirrors the collapse failure)", () => {
    const ratio = dropRatioFor(0.5, 0.95);
    expect(scoreStableUpdating(ratio)).toBe(0);
  });
  it("is undefined when round 1's weighting is too close to zero", () => {
    expect(dropRatioFor(0.02, 0.5)).toBeNull();
  });
});

describe("progress-level aggregates", () => {
  it("computes reliance discrimination", () => {
    expect(discriminationFor([0.8, 0.7], [0.2, 0.3])).toBeCloseTo(0.5, 5);
  });
  it("is null with no items on one side", () => {
    expect(discriminationFor([], [0.3])).toBeNull();
  });
  it("computes anchoring on uncued items", () => {
    expect(anchoringFor([0.5, 0.6])).toBeCloseTo(0.05, 5);
  });
  it("never sums over- and under-reliance", () => {
    const rates = relianceRates(["over", "over", "under", "ok"]);
    expect(rates.overReliance).toBe(0.5);
    expect(rates.underReliance).toBe(0.25);
  });
  it("computes a calibration Brier score", () => {
    // Perfectly calibrated: high confidence exactly on the accurate item.
    const brier = calibrationBrier([90, 10], [0, 1]);
    expect(brier).toBeCloseTo(((0.9 - 1) ** 2 + (0.1 - 0) ** 2) / 2, 5);
  });
});

describe("scoreCueSelection (G2)", () => {
  const cueOptions = [
    { cueId: "cCat", kind: "category" as const, bearsOnRelative: false },
    { cueId: "cInst", kind: "instance" as const, bearsOnRelative: true },
    { cueId: "cNone", kind: "none" as const, bearsOnRelative: false },
  ];
  it("scores 2 for an instance cue that bears on relative competence", () => {
    expect(scoreCueSelection("cInst", cueOptions, "trust").level).toBe(2);
  });
  it("scores 0 for a category claim", () => {
    expect(scoreCueSelection("cCat", cueOptions, "trust").level).toBe(0);
  });
  it("scores 2 for correctly picking 'none' on an uncued item", () => {
    expect(scoreCueSelection("cNone", cueOptions, "none").level).toBe(2);
  });
  it("scores 1 for an instance cue that doesn't bear on relative competence on an uncued item", () => {
    expect(scoreCueSelection("cInst", cueOptions, "none").level).toBe(1);
  });
});

describe("scoreSplitDisposition (G4)", () => {
  const pieces = [
    { pieceId: "p1", keyDisposition: "give" as const },
    { pieceId: "p2", keyDisposition: "keep" as const },
  ];
  it("scores 2 for a full match", () => {
    expect(scoreSplitDisposition(pieces, { p1: "give", p2: "keep" }).level).toBe(2);
  });
  it("scores 0 for delegating the whole task", () => {
    expect(scoreSplitDisposition(pieces, { p1: "give", p2: "give" }).level).toBe(0);
  });
  it("scores 0 for keeping the whole task", () => {
    expect(scoreSplitDisposition(pieces, { p1: "keep", p2: "keep" }).level).toBe(0);
  });
  it("scores 1 for the fully-inverted split", () => {
    expect(scoreSplitDisposition(pieces, { p1: "keep", p2: "give" }).level).toBe(1);
  });
});

describe("evaluateWeighingMastery / evaluateKeyedMastery", () => {
  function weighingWindow(overrides: Partial<{ woaClamped: number; cueDirection: "trust" | "keep" | "none"; direction: "over" | "under" | "ok"; netGain: number; dayKey: string }>[]) {
    return overrides.map((o, i) => ({
      woaClamped: o.woaClamped ?? 0.5,
      cueDirection: o.cueDirection ?? "none",
      direction: o.direction ?? "ok",
      netGain: o.netGain ?? 1,
      dayKey: o.dayKey ?? (i < 3 ? "2026-01-01" : "2026-01-02"),
    }));
  }

  it("is not mastered with too few attempts", () => {
    const verdict = evaluateWeighingMastery(weighingWindow([{}, {}]));
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.some((g) => g.code === "attempts")).toBe(true);
  });

  it("masters with good discrimination, low anchoring, positive net gain, low error rates, across 2 days", () => {
    const window = weighingWindow([
      { cueDirection: "trust", woaClamped: 0.8, direction: "ok" },
      { cueDirection: "trust", woaClamped: 0.75, direction: "ok" },
      { cueDirection: "keep", woaClamped: 0.2, direction: "ok" },
      { cueDirection: "keep", woaClamped: 0.25, direction: "ok" },
      { cueDirection: "none", woaClamped: 0.5, direction: "ok" },
      { cueDirection: "none", woaClamped: 0.45, direction: "ok" },
    ]);
    const verdict = evaluateWeighingMastery(window);
    expect(verdict.mastered).toBe(true);
  });

  it("fails mastery on poor discrimination even with good individual numbers", () => {
    const window = weighingWindow([
      { cueDirection: "trust", woaClamped: 0.3 },
      { cueDirection: "trust", woaClamped: 0.3 },
      { cueDirection: "keep", woaClamped: 0.3 },
      { cueDirection: "keep", woaClamped: 0.3 },
      { cueDirection: "none", woaClamped: 0.5 },
      { cueDirection: "none", woaClamped: 0.5 },
    ]);
    const verdict = evaluateWeighingMastery(window);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.some((g) => g.code === "discrimination")).toBe(true);
  });

  it("evaluateKeyedMastery requires 5 of 6 at full level across 2 days", () => {
    const window = [2, 2, 2, 2, 2, 1].map((level, i) => ({ level: level as 0 | 1 | 2, dayKey: i < 3 ? "2026-01-01" : "2026-01-02" }));
    expect(evaluateKeyedMastery(window).mastered).toBe(true);
  });

  it("evaluateKeyedMastery fails below 5 of 6", () => {
    const window = [2, 2, 2, 1, 1, 1].map((level, i) => ({ level: level as 0 | 1 | 2, dayKey: i < 3 ? "2026-01-01" : "2026-01-02" }));
    expect(evaluateKeyedMastery(window).mastered).toBe(false);
  });
});
