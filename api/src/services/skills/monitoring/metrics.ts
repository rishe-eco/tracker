/**
 * Monitoring metrics that aren't gamma or answer-matching. Build plan §4.3-4.6.
 */

import { PREDICTION_ORDINAL, RATING_SCALE_MAX, type PredictionLevel } from "../../../content/skills/monitoring/types";

/** Maps an ordinal prediction to a proxy probability, for S1's bias figure (spec §4 S1; this file's own resolution of "predicted performance"). */
export const PREDICTION_PROBABILITY: Record<PredictionLevel, number> = {
  no_idea: 0,
  probably_not: 1 / 3,
  probably: 2 / 3,
  confident: 1,
};

/** Above this, S1's predicted-unassisted-performance clause reads as overconfident (rubric level 0). */
export const S1_BIAS_OVERCONFIDENT_THRESHOLD = 0.25;
/** S3's gamma threshold for "discriminates above the module threshold" (rubric level 2). */
export const S3_GAMMA_MASTERY_THRESHOLD = 0.3;
/** Mastery's bias band (spec §7): "bias within ±1 scale point" on the 0-10 rating scale used by s1/s2. */
export const MASTERY_BIAS_BAND = 1;

/**
 * mean(predicted probability) - accuracy, signed so direction is legible
 * (spec §6). Positive = overconfident. Used for S1's per-window bias clause
 * and for the tool-level "bias" metric shown beside resolution.
 */
export function computeBias(pairs: { prediction: PredictionLevel; outcome: 0 | 1 }[]): number | null {
  if (!pairs.length) return null;
  const meanPredicted = pairs.reduce((sum, p) => sum + PREDICTION_PROBABILITY[p.prediction], 0) / pairs.length;
  const accuracy = pairs.reduce((sum, p) => sum + p.outcome, 0) / pairs.length;
  return meanPredicted - accuracy;
}

/**
 * Post-AI inflation (build plan §4.3): selfRating(assisted) - selfRating(unassisted),
 * per pairId, averaged. The pair is the unit; a half never scores alone.
 */
export function inflationFor(pairs: { assistedRating: number; unassistedRating: number }[]): number | null {
  if (!pairs.length) return null;
  const diffs = pairs.map((p) => p.assistedRating - p.unassistedRating);
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

/**
 * Influence discrimination (build plan §4.4). Primary is unweighted;
 * weightedHits is reported beside it, never folded in — weighting the
 * primary would make one influence type dominate.
 */
export function influenceDiscrimination(marks: {
  plantedTotal: number;
  plantedFound: number;
  weight2Total: number;
  weight2Found: number;
  cleanTurnsTotal: number;
  falseAlarms: number;
}): { hitRate: number | null; falseAlarmRate: number | null; discrimination: number | null; weightedHits: number | null } {
  const hitRate = marks.plantedTotal > 0 ? marks.plantedFound / marks.plantedTotal : null;
  const falseAlarmRate = marks.cleanTurnsTotal > 0 ? marks.falseAlarms / marks.cleanTurnsTotal : null;
  const discrimination = hitRate !== null && falseAlarmRate !== null ? hitRate - falseAlarmRate : null;
  const weightedHits = marks.weight2Total > 0 ? marks.weight2Found / marks.weight2Total : null;
  return { hitRate, falseAlarmRate, discrimination, weightedHits };
}

/**
 * Check-rate decay (build plan §4.5): last-third checkRate / first-third
 * checkRate, for ONE session. Never aggregated across sessions and never
 * scored — an aggregated attention score is a vigilance streak wearing a
 * different name.
 */
export function checkRateDecay(checked: boolean[]): { firstThird: number; lastThird: number; decay: number | null } {
  const n = checked.length;
  const thirdSize = Math.floor(n / 3);
  if (thirdSize === 0) return { firstThird: 0, lastThird: 0, decay: null };
  const first = checked.slice(0, thirdSize);
  const last = checked.slice(n - thirdSize);
  const rate = (arr: boolean[]) => arr.filter(Boolean).length / arr.length;
  const firstThird = rate(first);
  const lastThird = rate(last);
  return { firstThird, lastThird, decay: firstThird > 0 ? lastThird / firstThird : null };
}

/**
 * S6 (build plan §4.6): 2 iff the option is attention-independent. 1 if
 * attention-dependent but names a trigger. 0 for bare effort. The third
 * state (`hasTrigger`) isn't on the shared `Countermeasure` type because it
 * only distinguishes within the attention-dependent half — see
 * `content/skills/monitoring/v1/spec.ts`'s `COUNTERMEASURE_HAS_TRIGGER`.
 */
export function scoreCountermeasure(attentionDependent: boolean, hasTrigger: boolean): 0 | 1 | 2 {
  if (!attentionDependent) return 2;
  return hasTrigger ? 1 : 0;
}

export { PREDICTION_ORDINAL, RATING_SCALE_MAX };
