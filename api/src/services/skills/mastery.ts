/**
 * Mastery and test-out rules.
 *
 * Deliberately rule-based rather than a knowledge-tracing model. Bayesian
 * knowledge tracing with a 0.95–0.98 threshold is the standard answer and the
 * wrong one here: it assumes item volumes this tool will never have (six modules
 * × a handful of items), and its output is uninterpretable to the learner. A
 * learner can read these rules and know exactly what is being asked of them.
 *
 * Spec: 00-skills-engine.md §8; 02-evidence-lab.md §7.
 */

import type { EvidenceItemScore } from "./scoring";

/** How many recent unscaffolded attempts are considered. */
export const MASTERY_WINDOW = 6;
/** How many of them must reach the strict composite. */
export const MASTERY_REQUIRED_STRICT = 5;
/** Distinct calendar days the window must span. */
export const MASTERY_MIN_DISTINCT_DAYS = 2;
/** Reflex speed: median time to first check on strict items. */
export const MASTERY_MAX_MEDIAN_TTFC_MS = 60_000;

export type ScoredAttempt = EvidenceItemScore & {
  /** "YYYY-MM-DD" in the learner's own timezone. */
  dayKey: string;
};

export type MasteryVerdict = {
  mastered: boolean;
  /** Why not — shown to the learner, so the bar is never mysterious. */
  unmetCriteria: string[];
  strictCount: number;
  distinctDays: number;
  medianTimeToFirstCheckMs: number | null;
  controlFalseAlarms: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * All four clauses are load-bearing and each rules out a different way of
 * looking competent without being competent: accuracy without speed is an audit
 * nobody sustains, speed without accuracy is a habit, either one with control
 * false alarms is distrust, and any of them inside a single sitting measures
 * short-term retention only — which is the exact illusion this tool exists to
 * dispel.
 *
 * `attempts` is ordered oldest → newest; only the last MASTERY_WINDOW count.
 */
export function evaluateMastery(attempts: ScoredAttempt[]): MasteryVerdict {
  const window = attempts.slice(-MASTERY_WINDOW);
  const unmet: string[] = [];

  const strictCount = window.filter((a) => a.strict === 1).length;
  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  const controlFalseAlarms = window.filter((a) => a.falseAlarm).length;
  const ttfc = median(
    window
      .filter((a) => a.strict === 1 && a.timeToFirstCheckMs !== null)
      .map((a) => a.timeToFirstCheckMs as number)
  );

  if (window.length < MASTERY_REQUIRED_STRICT) {
    unmet.push(`needs at least ${MASTERY_REQUIRED_STRICT} unscaffolded attempts`);
  }
  if (strictCount < MASTERY_REQUIRED_STRICT) {
    unmet.push(`${strictCount}/${MASTERY_REQUIRED_STRICT} items checked and answered correctly`);
  }
  if (distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push(`practice spread over ${distinctDays} of ${MASTERY_MIN_DISTINCT_DAYS} required days`);
  }
  if (controlFalseAlarms > 0) {
    unmet.push(`${controlFalseAlarms} true claim(s) flagged as faulty`);
  }
  if (ttfc === null || ttfc >= MASTERY_MAX_MEDIAN_TTFC_MS) {
    unmet.push(
      `median time to first check ${ttfc === null ? "not established" : `${Math.round(ttfc / 1000)}s`} ` +
        `(target under ${MASTERY_MAX_MEDIAN_TTFC_MS / 1000}s)`
    );
  }

  return {
    mastered: unmet.length === 0,
    unmetCriteria: unmet,
    strictCount,
    distinctDays,
    medianTimeToFirstCheckMs: ttfc,
    controlFalseAlarms,
  };
}

/** Baseline strict rate at or above this tests a learner out of a module. */
export const TEST_OUT_STRICT_RATE = 0.8;

/**
 * Skipping over-practice measurably beats grinding it — but a tested-out module
 * is marked distinctly rather than as mastered, because calling it mastery would
 * inflate the baseline→post delta with work the learner never did.
 */
export function evaluateTestedOut(baselineScores: EvidenceItemScore[]): boolean {
  if (baselineScores.length === 0) return false;
  if (baselineScores.some((s) => s.falseAlarm)) return false;
  const strictRate = baselineScores.filter((s) => s.strict === 1).length / baselineScores.length;
  return strictRate >= TEST_OUT_STRICT_RATE;
}
