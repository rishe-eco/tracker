/**
 * Mastery, per module. Spec §7 gives one formula — reliance discrimination,
 * anchoring, net gain, error rates, all computed "for that module" — which
 * only makes sense for a module whose own pool has a trust/keep/none spread
 * to compute a discrimination value from. `g4-split` and `g6-drift` items
 * carry no `cueDirection` at all (types.ts's header note), so §7's formula
 * cannot apply to them; this is a genuine gap the build plan doesn't
 * reconcile, resolved here (D-39) with a key-match mastery rule for those
 * two modules instead, the same shape every other tool in this engine uses
 * (≥5 of 6 at the criterion's full level, across ≥2 distinct days).
 *
 * Every threshold below is a named constant precisely because the spec
 * leaves its exact value to the build — a defensible starting position, not
 * a finding, same posture as Verification Lab's `ASSISTED_CEILING_MULTIPLE`.
 */

import type { MasteryGap } from "../mastery";
import { anchoringFor, discriminationFor, relianceRates } from "./metrics";
import type { CueDirectionLike, RelianceDirection } from "./woa";

export const MASTERY_WINDOW = 6;
export const MASTERY_MIN_DISTINCT_DAYS = 2;
export const MASTERY_DISCRIMINATION_MIN = 0.25;
export const MASTERY_ANCHORING_MAX = 0.15;
export const MASTERY_ERROR_RATE_MAX = 0.3;
export const MASTERY_KEY_MATCH_REQUIRED = 5;

export type DelegationMasteryVerdict = { mastered: boolean; unmetCriteria: MasteryGap[] };

export type WeighingAttempt = {
  woaClamped: number | null;
  cueDirection: CueDirectionLike;
  direction: RelianceDirection;
  netGain: number | null;
  dayKey: string;
};

/** g1-own, g2-instance, g3-weigh, g5-stakes (g5's "attempts" are pairs, one row per pair). */
export function evaluateWeighingMastery(attempts: WeighingAttempt[]): DelegationMasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_WINDOW) {
    unmet.push({ code: "attempts", count: window.length, required: MASTERY_WINDOW });
  }

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_WINDOW && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }

  const trustWoas = window.filter((a) => a.cueDirection === "trust" && a.woaClamped !== null).map((a) => a.woaClamped as number);
  const keepWoas = window.filter((a) => a.cueDirection === "keep" && a.woaClamped !== null).map((a) => a.woaClamped as number);
  const discrimination = discriminationFor(trustWoas, keepWoas);
  if (discrimination === null || discrimination < MASTERY_DISCRIMINATION_MIN) {
    unmet.push({ code: "discrimination", required: MASTERY_DISCRIMINATION_MIN });
  }

  const noneWoas = window.filter((a) => a.cueDirection === "none" && a.woaClamped !== null).map((a) => a.woaClamped as number);
  const anchoring = anchoringFor(noneWoas);
  if (anchoring === null || anchoring > MASTERY_ANCHORING_MAX) {
    unmet.push({ code: "anchoring", required: MASTERY_ANCHORING_MAX });
  }

  const netGains = window.map((a) => a.netGain).filter((g): g is number => g !== null);
  const meanNetGain = netGains.length ? netGains.reduce((a, b) => a + b, 0) / netGains.length : null;
  if (meanNetGain === null || meanNetGain <= 0) {
    unmet.push({ code: "netGain" });
  }

  const directions = window.map((a) => a.direction);
  const { overReliance, underReliance } = relianceRates(directions);
  if ((overReliance ?? 0) > MASTERY_ERROR_RATE_MAX) unmet.push({ code: "overReliance", required: MASTERY_ERROR_RATE_MAX });
  if ((underReliance ?? 0) > MASTERY_ERROR_RATE_MAX) unmet.push({ code: "underReliance", required: MASTERY_ERROR_RATE_MAX });

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

export type KeyedAttempt = { level: 0 | 1 | 2 | null; dayKey: string };

/** g4-split, g6-drift — no within-module cue spread to compute discrimination from; mastery is a key-match rate instead. */
export function evaluateKeyedMastery(attempts: KeyedAttempt[]): DelegationMasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_WINDOW) {
    unmet.push({ code: "attempts", count: window.length, required: MASTERY_WINDOW });
  }
  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_WINDOW && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }
  const fullLevel = window.filter((a) => a.level === 2).length;
  if (fullLevel < MASTERY_KEY_MATCH_REQUIRED) {
    unmet.push({ code: "keyMatch", count: fullLevel, required: MASTERY_KEY_MATCH_REQUIRED });
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}
