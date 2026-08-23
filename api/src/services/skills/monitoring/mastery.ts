/**
 * Mastery, per module. Spec §7 gives one formula — "resolution above the
 * module threshold, bias within ±1 scale point, no false alarm on a clean
 * transcript, and — for s1 — post-AI inflation not above baseline" — which
 * only cleanly applies as written to s1-access and s3-resolution: those are
 * the two modules with a resolution/bias figure at all. s4/s5 have a
 * clean-transcript clause but no resolution; s2/s6 have neither. This is the
 * same shape of gap Delegation's build hit (D-39) — resolved here the same
 * way, with three mastery-evaluator shapes instead of one:
 *
 *   - `evaluateResolutionMastery` (s3-resolution): gamma + bias.
 *   - `evaluateAccessMastery` (s1-access): bias + post-AI inflation.
 *   - `evaluateKeyedMastery` (s2-explain, s4-agreement, s5-anchor,
 *     s6-complacency): the ≥5-of-6 key-match rate every other tool in this
 *     engine falls back to when a module has no computed spread of its own,
 *     with a clean-transcript clause bolted on for s4/s5 only.
 *
 * "Bias within ±1 scale point" (spec §7) is written for a 0-10 rating scale,
 * but s3's bias (spec §6: mean(predicted probability - outcome)) lives on a
 * [-1, 1] probability scale, not a rating scale — there is no rating in
 * s3 at all. Rather than invent an unmotivated conversion, this file reuses
 * `S1_BIAS_OVERCONFIDENT_THRESHOLD` (0.25) as the probability-scale band for
 * both s1 and s3's bias clauses, on the same "defensible starting position,
 * not a finding" footing as Delegation's own threshold constants.
 */

import type { MasteryGap } from "../mastery";
import { computeGamma, type PredictionOutcomePair } from "./gamma";
import { computeBias, inflationFor, S1_BIAS_OVERCONFIDENT_THRESHOLD, S3_GAMMA_MASTERY_THRESHOLD } from "./metrics";
import { PREDICTION_ORDINAL, type PredictionLevel } from "../../../content/skills/monitoring/types";

export const MASTERY_WINDOW = 6;
export const MASTERY_MIN_DISTINCT_DAYS = 2;
export const MASTERY_KEY_MATCH_REQUIRED = 5;

export type MonitoringMasteryVerdict = { mastered: boolean; unmetCriteria: MasteryGap[] };

export type ResolutionAttempt = { prediction: PredictionLevel; outcome: 0 | 1; dayKey: string };

export function evaluateResolutionMastery(attempts: ResolutionAttempt[]): MonitoringMasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_WINDOW) unmet.push({ code: "attempts", count: window.length, required: MASTERY_WINDOW });

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_WINDOW && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }

  const pairs: PredictionOutcomePair[] = window.map((a) => ({ prediction: PREDICTION_ORDINAL[a.prediction], outcome: a.outcome }));
  const gamma = computeGamma(pairs);
  if (gamma === null || gamma <= S3_GAMMA_MASTERY_THRESHOLD) {
    unmet.push({ code: "resolution", required: S3_GAMMA_MASTERY_THRESHOLD });
  }

  const bias = computeBias(window);
  if (bias === null || Math.abs(bias) > S1_BIAS_OVERCONFIDENT_THRESHOLD) {
    unmet.push({ code: "bias", required: S1_BIAS_OVERCONFIDENT_THRESHOLD });
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

export type AccessAttempt = { prediction: PredictionLevel; outcome: 0 | 1; dayKey: string };
export type AccessRatingPair = { assistedRating: number; unassistedRating: number };

export function evaluateAccessMastery(attempts: AccessAttempt[], ratingPairs: AccessRatingPair[]): MonitoringMasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_WINDOW) unmet.push({ code: "attempts", count: window.length, required: MASTERY_WINDOW });

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_WINDOW && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }

  const bias = computeBias(window);
  if (bias === null || bias > S1_BIAS_OVERCONFIDENT_THRESHOLD) {
    unmet.push({ code: "bias", required: S1_BIAS_OVERCONFIDENT_THRESHOLD });
  }

  const inflation = inflationFor(ratingPairs.slice(-MASTERY_WINDOW));
  if (inflation === null || inflation > 0) {
    unmet.push({ code: "inflation", required: 0 });
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

export type KeyedAttempt = { level: 0 | 1 | 2 | null; dayKey: string; isCleanControl?: boolean; falseAlarm?: boolean };

/** s2-explain, s4-agreement, s5-anchor, s6-complacency — no computed spread of their own. */
export function evaluateKeyedMastery(attempts: KeyedAttempt[], opts: { requireNoCleanFalseAlarm?: boolean } = {}): MonitoringMasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_WINDOW) unmet.push({ code: "attempts", count: window.length, required: MASTERY_WINDOW });

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_WINDOW && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }

  const fullLevel = window.filter((a) => a.level === 2).length;
  if (fullLevel < MASTERY_KEY_MATCH_REQUIRED) {
    unmet.push({ code: "keyMatch", count: fullLevel, required: MASTERY_KEY_MATCH_REQUIRED });
  }

  if (opts.requireNoCleanFalseAlarm) {
    const cleanFalseAlarm = window.some((a) => a.isCleanControl && a.falseAlarm);
    if (cleanFalseAlarm) unmet.push({ code: "cleanFalseAlarm" });
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

