/**
 * Assembles a `MonitoringScore` from an item's key and a learner's response.
 * Spec: `06-monitoring-lab.md` §4, §6, §7; build plan §4.
 *
 * Like Delegation Lab, a single attempt scores only the one criterion its
 * own module trains — the other five slots carry `scoredBy: "unscored"`.
 * Unlike Delegation, **two** criteria (S1, S3) never get a per-attempt level
 * at all, not just one (Delegation's G1): both describe a pattern across a
 * window of items (a bias figure, a gamma), not a property of one item, so
 * a "recall" or "pair"-unassisted attempt records a sample — its own
 * (prediction, outcome) pair, or its own self-rating — for the window-level
 * computation in `monitoringSession.ts`'s progress aggregation instead.
 *
 * S2's deflation (ratingBefore/ratingAfter) and S6's check-rate are
 * recorded on every attempt but never enter `total` — both are descriptive
 * only, per build plan §2 trap 2 and §4.5.
 */

import type {
  MonitoringCriterionId,
  MonitoringModuleKey,
  PairHalf,
  PredictionLevel,
} from "../../../content/skills/monitoring/types";
import type { PlantedInfluence, PlantedInfluenceType } from "../../../content/skills/monitoring/types";
import type { Locale } from "../../../content/skills/types";
import { monitoringEvidence as ev } from "../../../content/skills/monitoring/v1/evidence";
import { scoreCountermeasure } from "./metrics";

export type MonitoringCriterionScore = {
  id: MonitoringCriterionId;
  level: 0 | 1 | 2 | null;
  scoredBy: "computed" | "key" | "unscored";
  evidence: string;
};

const ALL_CRITERIA: MonitoringCriterionId[] = ["S1", "S2", "S3", "S4", "S5", "S6"];

function emptyCriteria(locale: Locale, populated?: MonitoringCriterionScore): MonitoringCriterionScore[] {
  return ALL_CRITERIA.map((id) =>
    populated && populated.id === id
      ? populated
      : { id, level: null, scoredBy: "unscored", evidence: ev(locale, "notThisModule") }
  );
}

export type MonitoringScore = {
  moduleKey: MonitoringModuleKey;
  criteria: MonitoringCriterionScore[];
  total: number;
  scoredCount: number;
  /** "recall" (s3), and the unassisted half of a "pair" (s1) — feeds window-level gamma/bias, never scored per-attempt. */
  predictionSample: { prediction: PredictionLevel; outcome: 0 | 1 } | null;
  /** "pair" only — feeds window-level inflation (build plan §4.3). */
  ratingSample: { pairId: string; pairHalf: PairHalf; rating: number } | null;
  /** "explain" only — descriptive, never scored (build plan §2 trap 2). */
  deflation: { before: number; after: number } | null;
  /**
   * "transcript" only.
   *
   * `plantedTurns` is the answer key, and like every other key in this engine
   * it exists only on a scored attempt — never on the served item, which is
   * what `toPublicMonitoringItem` enforces. Before it existed the reveal said
   * "1 of 2 planted influences found" and stopped, which is the one lab
   * scoring S5 ("name the turn that moved you") declining to say which turn
   * that was (persona review pass 3, S-6).
   *
   * `type` is a closed enum, so the client can name it in either locale
   * without any authored prose crossing the wire. The item's `keyNote`
   * deliberately does not — it is English-only spec prose.
   */
  influenceResult: {
    hits: number;
    falseAlarms: number;
    plantedTotal: number;
    misses: number;
    plantedTurns: { turnId: string; type: PlantedInfluenceType; found: boolean }[];
  } | null;
  /** "longset" only — descriptive, never scored (build plan §4.5). */
  checkRate: { firstThird: number; lastThird: number; decay: number | null } | null;
  /**
   * "recall" (s3) and the answered half of a "pair" (s1) — what actually
   * happened on this item.
   *
   * S1 and S3 are window-level by design: neither carries a per-attempt
   * level, so before this existed a completed recall sitting revealed
   * literally nothing — six "not scored" rows and a heading that read
   * "not scored" too (persona review pass 3, blocker 3). The measurement
   * stays window-level; this is the outcome, not a score, and it is the only
   * thing a single sitting of a predict-then-measure tool has to show.
   *
   * Never present on a served item — only here, after the answer is in.
   */
  answerOutcome: { yourAnswer: string; correct: boolean; acceptedAnswer: string } | null;
};

function baseScore(
  moduleKey: MonitoringModuleKey,
  locale: Locale,
  populated?: MonitoringCriterionScore
): Omit<
  MonitoringScore,
  "predictionSample" | "ratingSample" | "deflation" | "influenceResult" | "checkRate" | "answerOutcome"
> {
  return {
    moduleKey,
    criteria: emptyCriteria(locale, populated),
    total: populated?.level ?? 0,
    scoredCount: populated?.level !== null && populated?.level !== undefined ? 1 : 0,
  };
}

// ─── recall (s3), and the unassisted half of a pair (s1) ───────────────────

export function assembleRecallScore(
  moduleKey: "s3-resolution" | "s1-access",
  prediction: PredictionLevel,
  outcome: 0 | 1,
  locale: Locale
): MonitoringScore {
  return {
    ...baseScore(moduleKey, locale),
    predictionSample: { prediction, outcome },
    ratingSample: null,
    deflation: null,
    influenceResult: null,
    checkRate: null,
    answerOutcome: null,
  };
}

// ─── pair rating (s1, both halves) ──────────────────────────────────────────

export function assemblePairRatingScore(
  pairId: string,
  pairHalf: PairHalf,
  rating: number,
  locale: Locale
): MonitoringScore {
  return {
    ...baseScore("s1-access", locale),
    predictionSample: null,
    ratingSample: { pairId, pairHalf, rating },
    deflation: null,
    influenceResult: null,
    checkRate: null,
    answerOutcome: null,
  };
}

// ─── explain (s2) ────────────────────────────────────────────────────────

/**
 * S2 (rubric): level 2 if the selection covers every load-bearing step;
 * otherwise level 1 if the re-rating moved down at all (honest recognition
 * of the gap) or level 0 if it didn't. The rubric's alternate level-2 path
 * ("correctly identifies which step they cannot supply") has no separate
 * action in this build — selection IS the only signal — recorded here so a
 * future build knows the simplification was deliberate, not missed.
 */
export function assembleExplainScore(
  ratingBefore: number,
  ratingAfter: number,
  selectedStepIds: string[],
  causalSteps: { stepId: string; loadBearing: boolean }[],
  locale: Locale
): MonitoringScore {
  const loadBearingIds = causalSteps.filter((s) => s.loadBearing).map((s) => s.stepId);
  const coversLoadBearing = loadBearingIds.length > 0 && loadBearingIds.every((id) => selectedStepIds.includes(id));
  const moved = ratingAfter < ratingBefore;

  const level: 0 | 1 | 2 = coversLoadBearing ? 2 : moved ? 1 : 0;
  const populated: MonitoringCriterionScore = {
    id: "S2",
    level,
    scoredBy: "key",
    evidence: ev(locale, coversLoadBearing ? "s2.covers" : moved ? "s2.movedDown" : "s2.noMove"),
  };

  return {
    ...baseScore("s2-explain", locale, populated),
    predictionSample: null,
    ratingSample: null,
    deflation: { before: ratingBefore, after: ratingAfter },
    influenceResult: null,
    checkRate: null,
    answerOutcome: null,
  };
}

// ─── transcript (s4, s5) ─────────────────────────────────────────────────

export type TranscriptMarkInput = {
  moduleKey: "s4-agreement" | "s5-anchor";
  isCleanControl: boolean;
  /** The authored key for this transcript. Empty on a clean control. */
  planted: PlantedInfluence[];
  markedTurnIds: string[];
  /** True if every marked, correctly-planted turn also carries non-empty "what it moved" text. */
  everyHitNamed: boolean;
  locale: Locale;
};

/**
 * S4/S5 share one scoring shape (build plan doesn't distinguish them): a hit
 * is a marked turn that is actually planted; a false alarm is any mark on a
 * clean control, or a marked turn that isn't planted on a non-clean one.
 */
export function assembleTranscriptScore(input: TranscriptMarkInput): MonitoringScore {
  const criterionId: MonitoringCriterionId = input.moduleKey === "s4-agreement" ? "S4" : "S5";

  const plantedTurnIds = input.planted.map((p) => p.turnId);
  const hits = input.markedTurnIds.filter((id) => plantedTurnIds.includes(id)).length;
  const falseAlarms = input.isCleanControl
    ? input.markedTurnIds.length
    : input.markedTurnIds.filter((id) => !plantedTurnIds.includes(id)).length;
  const misses = plantedTurnIds.filter((id) => !input.markedTurnIds.includes(id)).length;

  let level: 0 | 1 | 2;
  if (input.isCleanControl) {
    level = falseAlarms === 0 ? 2 : hits === 0 && falseAlarms > 0 ? 0 : 1;
  } else if (hits === 0) {
    level = 0;
  } else if (misses === 0 && falseAlarms === 0 && input.everyHitNamed) {
    level = 2;
  } else {
    level = falseAlarms > 1 ? 0 : 1;
  }

  const populated: MonitoringCriterionScore = {
    id: criterionId,
    level,
    scoredBy: "key",
    evidence: input.isCleanControl
      ? ev(input.locale, falseAlarms === 0 ? "influence.cleanCorrect" : "influence.cleanFalseAlarm")
      : ev(input.locale, "influence.tally", {
          hits,
          planted: plantedTurnIds.length,
          falseAlarms,
        }),
  };

  return {
    ...baseScore(input.moduleKey, input.locale, populated),
    predictionSample: null,
    ratingSample: null,
    deflation: null,
    influenceResult: {
      hits,
      falseAlarms,
      plantedTotal: plantedTurnIds.length,
      misses,
      plantedTurns: input.planted.map((p) => ({
        turnId: p.turnId,
        type: p.type,
        found: input.markedTurnIds.includes(p.turnId),
      })),
    },
    checkRate: null,
    answerOutcome: null,
  };
}

// ─── longset (s6) ────────────────────────────────────────────────────────

export function assembleLongsetScore(
  selectedOptionId: string,
  countermeasures: { optionId: string; attentionDependent: boolean }[],
  hasTriggerByOptionId: Record<string, boolean>,
  checkRate: { firstThird: number; lastThird: number; decay: number | null },
  locale: Locale
): MonitoringScore {
  const option = countermeasures.find((c) => c.optionId === selectedOptionId);
  const level = option ? scoreCountermeasure(option.attentionDependent, hasTriggerByOptionId[selectedOptionId] ?? false) : 0;

  const populated: MonitoringCriterionScore = {
    id: "S6",
    level,
    scoredBy: "key",
    evidence: ev(locale, level === 2 ? "s6.independent" : level === 1 ? "s6.trigger" : "s6.bareEffort"),
  };

  return {
    ...baseScore("s6-complacency", locale, populated),
    predictionSample: null,
    ratingSample: null,
    deflation: null,
    influenceResult: null,
    checkRate,
    answerOutcome: null,
  };
}
