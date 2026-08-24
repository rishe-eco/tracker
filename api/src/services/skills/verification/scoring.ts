/**
 * Assembles a `VerificationScore` from an item's key and a learner's
 * response, plus the mastery/tested-out/promotion verdicts over a module's
 * attempts. Spec: `04-verification-lab.md` §4, §6, §7; build plan §4.
 */

import type {
  BenchEntry,
  FaultProfile,
  VerificationCriterionId,
  VerificationElement,
  Verdict,
} from "../../../content/skills/verification/types";
import { VERIFICATION_CRITERIA, cheapestSufficientCost } from "../../../content/skills/verification/types";
import type { Locale } from "../../../content/skills/types";
import { verificationEvidence as ev } from "../../../content/skills/verification/v1/evidence";
import type { MasteryGap } from "../mastery";
import { scoreHonestClosure, scoreIndependence, scoreLocalisation, scoreOracleNamed } from "./detectors";
import { costFor, ritualStateFor, scoreCostLevel, type RitualState } from "./metrics";

export type Rung = "assisted" | "unassisted";

export type VerificationCriterionScore = {
  id: VerificationCriterionId;
  level: 0 | 1 | 2 | null;
  scoredBy: "detector" | "instrumentation" | "key" | "key+instrumentation" | "unscored";
  evidence: string;
};

export type VerificationScore = {
  criteria: VerificationCriterionScore[];
  total: number;
  scoredCount: number;
  strict: boolean;
  ritualState: RitualState;
  costSpent: number;
  costRatio: number | null;
  rung: Rung;
  isVoid: boolean;
  /** True only when every applicable criterion carries a level — the bar mastery needs. */
  isComplete: boolean;
};

export type AssembleVerificationInput = {
  item: {
    profile: FaultProfile;
    bench: BenchEntry[];
    elements: VerificationElement[];
    failingElementId: string | null;
    keyVerdict: Verdict;
    notWorthChecking: boolean;
  };
  rung: Rung;
  oracleText: string;
  oracleNamedBeforeAnyCheck: boolean;
  selectedCheckIds: string[];
  verdict: Verdict;
  elementId: string | null;
  residualRisk: string;
  answerText: string;
  locale: Locale;
};

/**
 * Strict composite (build plan §4.2), binarised at level 2 on V1 and V3 —
 * conservative, matching Evidence Lab's L × I × A. V3 itself collapses to a
 * binary in this build: the rubric's level 1 ("discriminates only for part of
 * the claim") describes a partial-credit case the ritual-state algorithm
 * (§4.1) has no signal for, so V3 tracks the ritual state directly —
 * `some-could-fail` / `all-could-fail` → 2, `none-could-fail` / `none-run` →
 * 0. This mirrors the build plan's own instruction that the strict composite
 * treats both criteria as binary, applied one level down into V3 itself.
 */
export function assembleVerificationScore(input: AssembleVerificationInput): VerificationScore {
  const { item, locale } = input;
  const selected = item.bench.filter((b) => input.selectedCheckIds.includes(b.checkId));
  const isVoid = !input.verdict;

  const ritualState = ritualStateFor(selected);
  const v3Level: 0 | 2 = ritualState === "some-could-fail" || ritualState === "all-could-fail" ? 2 : 0;

  const v1 = scoreOracleNamed({
    oracleText: input.oracleText,
    namedBeforeAnyCheck: input.oracleNamedBeforeAnyCheck,
    selected,
    profile: item.profile,
    verdict: input.verdict,
    keyVerdict: item.keyVerdict,
    locale,
  });

  const v2 = scoreIndependence({
    selected,
    profile: item.profile,
    verdict: input.verdict,
    keyVerdict: item.keyVerdict,
    locale,
  });

  const { costSpent, costRatio } = costFor(item.bench, input.selectedCheckIds);
  const v4Level = scoreCostLevel(costRatio, input.rung, item.notWorthChecking, selected.length > 0);

  const v5 = scoreLocalisation({
    failingElementId: item.failingElementId,
    chosenElementId: input.elementId,
    verdict: input.verdict,
    keyVerdict: item.keyVerdict,
    locale,
  });

  const v6 = scoreHonestClosure({
    verdict: input.verdict,
    keyVerdict: item.keyVerdict,
    residualRisk: input.residualRisk,
    answerText: input.answerText,
    locale,
  });

  const criteria: VerificationCriterionScore[] = [
    { id: "V1", level: v1.level, scoredBy: "instrumentation", evidence: v1.evidence },
    { id: "V2", level: v2.level, scoredBy: "key", evidence: v2.evidence },
    {
      id: "V3",
      level: v3Level,
      scoredBy: "key",
      evidence: ev(
        locale,
        ritualState === "none-run"
          ? "v3.noneRun"
          : ritualState === "none-could-fail"
            ? "v3.noneCouldFail"
            : ritualState === "all-could-fail"
              ? "v3.allCouldFail"
              : "v3.someCouldFail"
      ),
    },
    {
      id: "V4",
      level: v4Level,
      scoredBy: v4Level === null ? "unscored" : "key+instrumentation",
      evidence:
        v4Level === null
          ? ev(locale, "v4.underCeiling")
          : costRatio === null
            ? ev(locale, "v4.noDiscriminating")
            : ev(locale, "v4.ratio", { ratio: costRatio.toFixed(2) }),
    },
    {
      id: "V5",
      level: v5?.level ?? null,
      scoredBy: v5 === null ? "unscored" : "key",
      evidence: v5?.evidence ?? ev(locale, "v5.control"),
    },
    { id: "V6", level: v6.level, scoredBy: "key+instrumentation", evidence: v6.evidence },
  ];

  const scored = criteria.filter((c) => c.level !== null);
  const strict = v1.level === 2 && v3Level === 2 && input.verdict === item.keyVerdict;

  return {
    criteria,
    total: isVoid ? 0 : scored.reduce((sum, c) => sum + (c.level as number), 0),
    scoredCount: scored.length,
    strict: !isVoid && strict,
    ritualState,
    costSpent,
    costRatio,
    rung: input.rung,
    isVoid,
    isComplete: !isVoid && scored.length === VERIFICATION_CRITERIA.length,
  };
}

// ─── Mastery, tested-out, promotion (spec §7; build plan §4.5) ─────────────

export type ScoredVerificationAttempt = {
  score: VerificationScore;
  profile: FaultProfile;
  /** "YYYY-MM-DD" in the learner's own timezone. */
  dayKey: string;
};

export type VerificationMasteryVerdict = { mastered: boolean; unmetCriteria: MasteryGap[] };

const MASTERY_WINDOW = 6;
const MASTERY_REQUIRED_STRICT = 5;
const MASTERY_MIN_DISTINCT_DAYS = 2;
const MASTERY_MAX_COST_RATIO = 2;

/**
 * Mastered = across two distinct calendar days, on unassisted-rung items for
 * this module: strict composite on ≥5 of the last 6, no false alarm on a
 * `CORRECT` control, cost ratio ≤2x on those items, and zero `none-could-fail`
 * attempts in the window (spec §7). Assisted-rung attempts are filtered out
 * by the caller before this ever sees them — mastery may only be earned
 * unscaffolded (engine §3 step 6), and a cost ceiling is scaffolding.
 */
export function evaluateVerificationMastery(attempts: ScoredVerificationAttempt[]): VerificationMasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_WINDOW) {
    unmet.push({ code: "attempts", count: window.length, required: MASTERY_WINDOW });
  }

  const strictCount = window.filter((a) => a.score.strict).length;
  if (strictCount < MASTERY_REQUIRED_STRICT) {
    unmet.push({ code: "strict", count: strictCount, required: MASTERY_REQUIRED_STRICT });
  }

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_WINDOW && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }

  const falseAlarms = window.filter((a) => a.profile === "CORRECT" && !a.score.strict).length;
  if (falseAlarms > 0) {
    unmet.push({ code: "falseAlarms", count: falseAlarms });
  }

  const overspent = window.some((a) => a.score.costRatio !== null && a.score.costRatio > MASTERY_MAX_COST_RATIO);
  if (overspent) {
    unmet.push({ code: "costRatio", required: MASTERY_MAX_COST_RATIO });
  }

  const ritualCount = window.filter((a) => a.score.ritualState === "none-could-fail").length;
  if (ritualCount > 0) {
    unmet.push({ code: "ritual", count: ritualCount });
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

const TEST_OUT_STRICT_RATE = 0.8;

/** Tested out = baseline strict composite ≥80% on this module's items, with no control false alarm and zero ritual attempts. */
export function evaluateVerificationTestedOut(baselineAttempts: ScoredVerificationAttempt[]): boolean {
  if (baselineAttempts.length === 0) return false;
  if (baselineAttempts.some((a) => a.profile === "CORRECT" && !a.score.strict)) return false;
  if (baselineAttempts.some((a) => a.score.ritualState === "none-could-fail")) return false;
  const strictRate = baselineAttempts.filter((a) => a.score.strict).length / baselineAttempts.length;
  return strictRate >= TEST_OUT_STRICT_RATE;
}

const PROMOTION_WINDOW = 6;
const PROMOTION_REQUIRED_STRICT = 4;

/**
 * Promotion is offered, never applied (build plan §4.5): on the assisted
 * rung, strict composite on ≥4 of the last 6 attempts with no control false
 * alarm. `setVerificationRung` is the only way the rung actually changes,
 * and it is always a learner action.
 */
export function promotionEligible(assistedAttempts: ScoredVerificationAttempt[]): boolean {
  const window = assistedAttempts.slice(-PROMOTION_WINDOW);
  if (window.length < PROMOTION_WINDOW) return false;
  const falseAlarm = window.some((a) => a.profile === "CORRECT" && !a.score.strict);
  if (falseAlarm) return false;
  return window.filter((a) => a.score.strict).length >= PROMOTION_REQUIRED_STRICT;
}
