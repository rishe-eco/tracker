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
import { scoreCountermeasure } from "./metrics";

export type MonitoringCriterionScore = {
  id: MonitoringCriterionId;
  level: 0 | 1 | 2 | null;
  scoredBy: "computed" | "key" | "unscored";
  evidence: string;
};

const ALL_CRITERIA: MonitoringCriterionId[] = ["S1", "S2", "S3", "S4", "S5", "S6"];

function emptyCriteria(populated?: MonitoringCriterionScore): MonitoringCriterionScore[] {
  return ALL_CRITERIA.map((id) =>
    populated && populated.id === id ? populated : { id, level: null, scoredBy: "unscored", evidence: "Not this item's module." }
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
  /** "transcript" only. */
  influenceResult: { hits: number; falseAlarms: number; plantedTotal: number; misses: number } | null;
  /** "longset" only — descriptive, never scored (build plan §4.5). */
  checkRate: { firstThird: number; lastThird: number; decay: number | null } | null;
};

function baseScore(moduleKey: MonitoringModuleKey, populated?: MonitoringCriterionScore): Omit<
  MonitoringScore,
  "predictionSample" | "ratingSample" | "deflation" | "influenceResult" | "checkRate"
> {
  return {
    moduleKey,
    criteria: emptyCriteria(populated),
    total: populated?.level ?? 0,
    scoredCount: populated?.level !== null && populated?.level !== undefined ? 1 : 0,
  };
}

// ─── recall (s3), and the unassisted half of a pair (s1) ───────────────────

export function assembleRecallScore(moduleKey: "s3-resolution" | "s1-access", prediction: PredictionLevel, outcome: 0 | 1): MonitoringScore {
  return {
    ...baseScore(moduleKey),
    predictionSample: { prediction, outcome },
    ratingSample: null,
    deflation: null,
    influenceResult: null,
    checkRate: null,
  };
}

// ─── pair rating (s1, both halves) ──────────────────────────────────────────

export function assemblePairRatingScore(pairId: string, pairHalf: PairHalf, rating: number): MonitoringScore {
  return {
    ...baseScore("s1-access"),
    predictionSample: null,
    ratingSample: { pairId, pairHalf, rating },
    deflation: null,
    influenceResult: null,
    checkRate: null,
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
  causalSteps: { stepId: string; loadBearing: boolean }[]
): MonitoringScore {
  const loadBearingIds = causalSteps.filter((s) => s.loadBearing).map((s) => s.stepId);
  const coversLoadBearing = loadBearingIds.length > 0 && loadBearingIds.every((id) => selectedStepIds.includes(id));
  const moved = ratingAfter < ratingBefore;

  const level: 0 | 1 | 2 = coversLoadBearing ? 2 : moved ? 1 : 0;
  const populated: MonitoringCriterionScore = {
    id: "S2",
    level,
    scoredBy: "key",
    evidence: coversLoadBearing
      ? "The selection covers every load-bearing causal step."
      : moved
        ? "The selection misses a load-bearing step, but the re-rating moved down."
        : "The selection misses a load-bearing step, and the re-rating didn't move.",
  };

  return {
    ...baseScore("s2-explain", populated),
    predictionSample: null,
    ratingSample: null,
    deflation: { before: ratingBefore, after: ratingAfter },
    influenceResult: null,
    checkRate: null,
  };
}

// ─── transcript (s4, s5) ─────────────────────────────────────────────────

export type TranscriptMarkInput = {
  moduleKey: "s4-agreement" | "s5-anchor";
  isCleanControl: boolean;
  plantedTurnIds: string[];
  markedTurnIds: string[];
  /** True if every marked, correctly-planted turn also carries non-empty "what it moved" text. */
  everyHitNamed: boolean;
};

/**
 * S4/S5 share one scoring shape (build plan doesn't distinguish them): a hit
 * is a marked turn that is actually planted; a false alarm is any mark on a
 * clean control, or a marked turn that isn't planted on a non-clean one.
 */
export function assembleTranscriptScore(input: TranscriptMarkInput): MonitoringScore {
  const criterionId: MonitoringCriterionId = input.moduleKey === "s4-agreement" ? "S4" : "S5";

  const hits = input.markedTurnIds.filter((id) => input.plantedTurnIds.includes(id)).length;
  const falseAlarms = input.isCleanControl
    ? input.markedTurnIds.length
    : input.markedTurnIds.filter((id) => !input.plantedTurnIds.includes(id)).length;
  const misses = input.plantedTurnIds.filter((id) => !input.markedTurnIds.includes(id)).length;

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
      ? falseAlarms === 0
        ? "Correctly found nothing planted in a clean transcript."
        : "Marked a turn in a clean transcript that had nothing planted — a false alarm."
      : `${hits}/${input.plantedTurnIds.length} planted influence(s) found, ${falseAlarms} false alarm(s).`,
  };

  return {
    ...baseScore(input.moduleKey, populated),
    predictionSample: null,
    ratingSample: null,
    deflation: null,
    influenceResult: { hits, falseAlarms, plantedTotal: input.plantedTurnIds.length, misses },
    checkRate: null,
  };
}

// ─── longset (s6) ────────────────────────────────────────────────────────

export function assembleLongsetScore(
  selectedOptionId: string,
  countermeasures: { optionId: string; attentionDependent: boolean }[],
  hasTriggerByOptionId: Record<string, boolean>,
  checkRate: { firstThird: number; lastThird: number; decay: number | null }
): MonitoringScore {
  const option = countermeasures.find((c) => c.optionId === selectedOptionId);
  const level = option ? scoreCountermeasure(option.attentionDependent, hasTriggerByOptionId[selectedOptionId] ?? false) : 0;

  const populated: MonitoringCriterionScore = {
    id: "S6",
    level,
    scoredBy: "key",
    evidence:
      level === 2
        ? "The chosen check fires independent of attention — a fixed point in the workflow."
        : level === 1
          ? "The chosen check still depends on noticing a trigger in the moment."
          : "The chosen check is bare effort, with no mechanism at all.",
  };

  return {
    ...baseScore("s6-complacency", populated),
    predictionSample: null,
    ratingSample: null,
    deflation: null,
    influenceResult: null,
    checkRate,
  };
}
