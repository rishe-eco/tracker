import { describe, expect, it } from "vitest";
import { costFor, ritualStateFor, scoreCostLevel } from "../services/skills/verification/metrics";
import {
  assembleVerificationScore,
  evaluateVerificationMastery,
  evaluateVerificationTestedOut,
  promotionEligible,
  type ScoredVerificationAttempt,
} from "../services/skills/verification/scoring";
import type { BenchEntry } from "../content/skills/verification/types";

const bench = (over: Partial<BenchEntry>[] = []): BenchEntry[] => [
  { checkId: "c1_self_critique", costSeconds: 15, independent: false, discriminating: false, bearsOnClaim: false },
  { checkId: "c2_confidence", costSeconds: 10, independent: false, discriminating: false, bearsOnClaim: false },
  { checkId: "c3_recompute", costSeconds: 10, independent: true, discriminating: true, bearsOnClaim: true },
  { checkId: "c4_near_miss", costSeconds: 40, independent: true, discriminating: false, bearsOnClaim: true },
  { checkId: "c5_expensive", costSeconds: 90, independent: true, discriminating: true, bearsOnClaim: true },
  { checkId: "c6_filler", costSeconds: 15, independent: true, discriminating: false, bearsOnClaim: false },
  ...over,
] as BenchEntry[];

describe("ritualStateFor", () => {
  const b = bench();
  it("none-run when nothing was selected", () => {
    expect(ritualStateFor([])).toBe("none-run");
  });
  it("none-could-fail when every selected check is non-discriminating", () => {
    expect(ritualStateFor([b[0], b[1]])).toBe("none-could-fail");
  });
  it("some-could-fail when a mix was selected", () => {
    expect(ritualStateFor([b[0], b[2]])).toBe("some-could-fail");
  });
  it("all-could-fail when every selected check discriminates", () => {
    expect(ritualStateFor([b[2], b[4]])).toBe("all-could-fail");
  });
});

describe("scoreCostLevel", () => {
  it("is null on the assisted rung, regardless of ratio", () => {
    expect(scoreCostLevel(1.0, "assisted", false, true)).toBeNull();
    expect(scoreCostLevel(5.0, "assisted", false, true)).toBeNull();
  });
  it("is 2 at or below the near-ratio boundary (1.5x)", () => {
    expect(scoreCostLevel(1.5, "unassisted", false, true)).toBe(2);
    expect(scoreCostLevel(1.0, "unassisted", false, true)).toBe(2);
  });
  it("is 1 strictly between 1.5x and 3x", () => {
    expect(scoreCostLevel(1.51, "unassisted", false, true)).toBe(1);
    expect(scoreCostLevel(3.0, "unassisted", false, true)).toBe(1);
  });
  it("is 0 above 3x", () => {
    expect(scoreCostLevel(3.01, "unassisted", false, true)).toBe(0);
  });
  it("on a notWorthChecking (NO_ORACLE) item: 2 if nothing was run, 0 if anything was", () => {
    expect(scoreCostLevel(null, "unassisted", true, false)).toBe(2);
    expect(scoreCostLevel(null, "unassisted", true, true)).toBe(0);
  });
});

describe("costFor", () => {
  it("sums only the selected entries and ratios against the cheapest discriminating one", () => {
    const b = bench();
    const { costSpent, costRatio } = costFor(b, ["c3_recompute", "c5_expensive"]);
    expect(costSpent).toBe(100);
    expect(costRatio).toBe(10); // 100 / 10 (cheapest discriminating)
  });
});

describe("assembleVerificationScore", () => {
  const item = {
    profile: "SUM_MISMATCH" as const,
    bench: bench(),
    elements: [
      { elementId: "e1", decoy: false },
      { elementId: "e2", decoy: true },
      { elementId: "e3", decoy: true },
      { elementId: "e4", decoy: true },
    ],
    failingElementId: "e1",
    keyVerdict: "unsupported" as const,
    notWorthChecking: false,
  };

  it("strict composite requires V1=2, V3=2 and a matching verdict", () => {
    const score = assembleVerificationScore({
      item,
      rung: "unassisted",
      oracleText: "Add the figures myself and compare to the stated total.",
      oracleNamedBeforeAnyCheck: true,
      selectedCheckIds: ["c3_recompute"],
      verdict: "unsupported",
      elementId: "e1",
      residualRisk: "The individual line items were not independently re-verified.",
      answerText: "some answer text",
    });
    expect(score.strict).toBe(true);
    expect(score.criteria.find((c) => c.id === "V5")?.level).toBe(2);
  });

  it("V4 is null (unscored) on the assisted rung even when overspent", () => {
    const score = assembleVerificationScore({
      item,
      rung: "assisted",
      oracleText: "check the sum",
      oracleNamedBeforeAnyCheck: true,
      selectedCheckIds: ["c3_recompute", "c5_expensive", "c6_filler"],
      verdict: "unsupported",
      elementId: "e1",
      residualRisk: "nothing else checked",
      answerText: "answer",
    });
    expect(score.criteria.find((c) => c.id === "V4")?.level).toBeNull();
    expect(score.criteria.find((c) => c.id === "V4")?.scoredBy).toBe("unscored");
  });

  it("V5 is null (inapplicable) on a control item with no failingElementId", () => {
    const controlItem = { ...item, profile: "CORRECT" as const, failingElementId: null, keyVerdict: "supported" as const };
    const score = assembleVerificationScore({
      item: controlItem,
      rung: "unassisted",
      oracleText: "recompute",
      oracleNamedBeforeAnyCheck: true,
      selectedCheckIds: ["c3_recompute"],
      verdict: "supported",
      elementId: "e2",
      residualRisk: "nothing outstanding",
      answerText: "answer",
    });
    expect(score.criteria.find((c) => c.id === "V5")?.level).toBeNull();
    expect(score.isComplete).toBe(false); // 5 of 6 scored
    expect(score.scoredCount).toBe(5);
  });
});

describe("evaluateVerificationMastery", () => {
  const attempt = (over: Partial<ScoredVerificationAttempt["score"]> = {}, profile: ScoredVerificationAttempt["profile"] = "SUM_MISMATCH", dayKey = "2026-08-22"): ScoredVerificationAttempt => ({
    profile,
    dayKey,
    score: {
      criteria: [],
      total: 10,
      scoredCount: 6,
      strict: true,
      ritualState: "all-could-fail",
      costSpent: 10,
      costRatio: 1.0,
      rung: "unassisted",
      isVoid: false,
      isComplete: true,
      ...over,
    },
  });

  it("mastered: 6 unassisted attempts, 5+ strict, 2 distinct days, no false alarms, cost <=2x, no ritual", () => {
    const window: ScoredVerificationAttempt[] = [
      attempt({}, "SUM_MISMATCH", "2026-08-21"),
      attempt({}, "SUM_MISMATCH", "2026-08-21"),
      attempt({}, "SUM_MISMATCH", "2026-08-22"),
      attempt({}, "SUM_MISMATCH", "2026-08-22"),
      attempt({ strict: false }, "STALE_ASSUMPTION", "2026-08-22"),
      attempt({}, "CORRECT", "2026-08-22"),
    ];
    expect(evaluateVerificationMastery(window).mastered).toBe(true);
  });

  it("not mastered: a CORRECT control false alarm", () => {
    const window: ScoredVerificationAttempt[] = Array.from({ length: 5 }, () => attempt({}, "SUM_MISMATCH", "2026-08-21"));
    window.push(attempt({ strict: false }, "CORRECT", "2026-08-22"));
    const verdict = evaluateVerificationMastery(window);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.some((g) => g.code === "falseAlarms")).toBe(true);
  });

  it("not mastered: cost ratio over 2x anywhere in the window", () => {
    const window: ScoredVerificationAttempt[] = [
      ...Array.from({ length: 5 }, () => attempt({}, "SUM_MISMATCH", "2026-08-21")),
      attempt({ costRatio: 2.5 }, "SUM_MISMATCH", "2026-08-22"),
    ];
    expect(evaluateVerificationMastery(window).unmetCriteria.some((g) => g.code === "costRatio")).toBe(true);
  });

  it("not mastered: a none-could-fail (ritual) attempt anywhere in the window", () => {
    const window: ScoredVerificationAttempt[] = [
      ...Array.from({ length: 5 }, () => attempt({}, "SUM_MISMATCH", "2026-08-21")),
      attempt({ ritualState: "none-could-fail" }, "SUM_MISMATCH", "2026-08-22"),
    ];
    expect(evaluateVerificationMastery(window).unmetCriteria.some((g) => g.code === "ritual")).toBe(true);
  });
});

describe("evaluateVerificationTestedOut", () => {
  it("requires >=80% strict, no control false alarm, and zero ritual", () => {
    const attempts: ScoredVerificationAttempt[] = [
      { profile: "SUM_MISMATCH", dayKey: "d", score: { criteria: [], total: 10, scoredCount: 6, strict: true, ritualState: "all-could-fail", costSpent: 10, costRatio: 1, rung: "unassisted", isVoid: false, isComplete: true } },
      { profile: "CORRECT", dayKey: "d", score: { criteria: [], total: 10, scoredCount: 6, strict: true, ritualState: "all-could-fail", costSpent: 10, costRatio: 1, rung: "unassisted", isVoid: false, isComplete: true } },
    ];
    expect(evaluateVerificationTestedOut(attempts)).toBe(true);
  });
});

describe("promotionEligible", () => {
  it("offered at >=4 of 6 assisted-rung strict attempts with no control false alarm", () => {
    const window: ScoredVerificationAttempt[] = [
      ...Array.from({ length: 4 }, () => ({ profile: "SUM_MISMATCH" as const, dayKey: "d", score: { criteria: [], total: 10, scoredCount: 6, strict: true, ritualState: "all-could-fail" as const, costSpent: 10, costRatio: 1, rung: "assisted" as const, isVoid: false, isComplete: true } })),
      { profile: "CORRECT" as const, dayKey: "d", score: { criteria: [], total: 10, scoredCount: 6, strict: true, ritualState: "all-could-fail" as const, costSpent: 10, costRatio: 1, rung: "assisted" as const, isVoid: false, isComplete: true } },
      { profile: "STALE_ASSUMPTION" as const, dayKey: "d", score: { criteria: [], total: 4, scoredCount: 6, strict: false, ritualState: "none-run" as const, costSpent: 0, costRatio: null, rung: "assisted" as const, isVoid: false, isComplete: true } },
    ];
    expect(promotionEligible(window)).toBe(true);
  });

  it("not offered with fewer than 6 attempts", () => {
    expect(promotionEligible([])).toBe(false);
  });
});
