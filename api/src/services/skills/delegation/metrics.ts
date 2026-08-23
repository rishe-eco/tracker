/**
 * Behavioural metrics derived from a delegation attempt or pair/sequence of
 * attempts. Spec: `05-delegation-lab.md` §6; build plan §4.2-4.5.
 */

/**
 * `adviceQuality` is derived, never authored (build plan §3 Phase 2): whether
 * the advice was actually more accurate than the learner's own initial
 * estimate on *this* item, for *this* learner — which is what makes the
 * instrument self-normalise against each learner's competence without a
 * domain-expertise questionnaire. Distinct from `isAdviceGood` in
 * `content/skills/delegation/types.ts`, which is a locale-independent
 * authoring-time proxy used only to balance the content pack.
 */
export function adviceQualityFor(initial: number, advice: number, truth: number): "good" | "bad" | "tie" {
  const initialError = Math.abs(initial - truth);
  const adviceError = Math.abs(advice - truth);
  if (adviceError === initialError) return "tie";
  return adviceError < initialError ? "good" : "bad";
}

/** Net gain from advice (build plan §4.3) — positive means consulting helped, in the item's own units. */
export function netGainFor(initial: number, final: number, truth: number): number {
  return Math.abs(initial - truth) - Math.abs(final - truth);
}

// ─── G5: the stakes pair (build plan §4.4) ─────────────────────────────────

/** How far the pair's reliance must move to count as "reduced" — a defensible starting position, expected to be tuned once real pair data exists. */
export const PAIR_DELTA = 0.15;
/** Below this absolute difference, the pair counts as literally unchanged. */
export const NO_CHANGE_EPS = 0.05;

export type StakesPairInput = {
  woaLow: number | null;
  woaHigh: number | null;
  /** Set by the learner on the high-stakes half only — "I'd check this before acting." Never graded for quality here; that's Verification Lab's measurement. */
  recoverabilityMoveHigh: boolean;
};

export function scoreStakesPair(input: StakesPairInput): 0 | 1 | 2 | null {
  const { woaLow, woaHigh, recoverabilityMoveHigh } = input;
  if (woaLow === null || woaHigh === null) return null;

  const reducedReliance = woaHigh <= woaLow - PAIR_DELTA;
  const insuredReliance = woaHigh >= woaLow - PAIR_DELTA && recoverabilityMoveHigh;
  if (reducedReliance || insuredReliance) return 2;

  const unchanged = Math.abs(woaHigh - woaLow) < NO_CHANGE_EPS;
  if (unchanged && !recoverabilityMoveHigh) return 0;

  return 1;
}

// ─── G6: the advisor sequence (build plan §4.3, §4.5) ──────────────────────

/** Below this, round-1 weighting is too close to zero for a ratio against it to mean anything. */
export const G6_ROUND1_FLOOR = 0.05;
export const G6_COLLAPSE_MAX = 0.2;
export const G6_PROPORTIONATE_MIN = 0.4;
export const G6_NO_UPDATE_MIN = 0.9;

/** `dropRatio = WOA(round 3) / WOA(round 1)` — undefined (null) if round 1's weighting is ~0. */
export function dropRatioFor(woaRound1: number | null, woaRound3: number | null): number | null {
  if (woaRound1 === null || woaRound3 === null) return null;
  if (Math.abs(woaRound1) < G6_ROUND1_FLOOR) return null;
  return woaRound3 / woaRound1;
}

/**
 * Both mirror failures — collapsing to ~0 after the seeded error, and not
 * updating at all (dropRatio near or above 1, whether that's "no change" or
 * a single success sending weighting up) — score 0. Rubric §4: "both
 * overreactions cost the same."
 */
export function scoreStableUpdating(dropRatio: number | null): 0 | 1 | 2 | null {
  if (dropRatio === null) return null;
  if (dropRatio <= G6_COLLAPSE_MAX) return 0;
  if (dropRatio >= G6_NO_UPDATE_MIN) return 0;
  if (dropRatio < G6_PROPORTIONATE_MIN) return 1;
  return 2;
}

// ─── Progress-level aggregates (build plan §4.3) ───────────────────────────

/** `overReliance`/`underReliance` are always returned together and never summed — see `types.ts` in the client and spec §6. */
export type RelianceRates = { overReliance: number | null; underReliance: number | null };

export function relianceRates(directions: ("over" | "under" | "ok")[]): RelianceRates {
  if (directions.length === 0) return { overReliance: null, underReliance: null };
  const over = directions.filter((d) => d === "over").length;
  const under = directions.filter((d) => d === "under").length;
  return { overReliance: over / directions.length, underReliance: under / directions.length };
}

/** Reliance discrimination — the headline (spec §6): mean WOA on trust-cued items minus mean WOA on keep-cued items. */
export function discriminationFor(trustWoas: number[], keepWoas: number[]): number | null {
  if (trustWoas.length === 0 || keepWoas.length === 0) return null;
  const meanTrust = trustWoas.reduce((a, b) => a + b, 0) / trustWoas.length;
  const meanKeep = keepWoas.reduce((a, b) => a + b, 0) / keepWoas.length;
  return meanTrust - meanKeep;
}

/** Anchoring on uncued items — mean |WOA - 0.5|. Should be small; large means confident deviation with no grounds. */
export function anchoringFor(noneWoas: number[]): number | null {
  if (noneWoas.length === 0) return null;
  return noneWoas.reduce((sum, w) => sum + Math.abs(w - 0.5), 0) / noneWoas.length;
}

/**
 * Self-assessment calibration — Brier score over stated confidence (0-100)
 * against whether the learner's own initial estimate was more accurate than
 * the median item error in the window (build plan §4.3). The window this
 * runs over is a build decision the spec leaves open (D-39): the same
 * 6-attempt window every other mastery/calibration figure in this engine
 * uses, so the number is comparable across criteria rather than an
 * unrelated lookback.
 */
export function calibrationBrier(confidences: number[], initialErrors: number[]): number | null {
  if (confidences.length === 0 || confidences.length !== initialErrors.length) return null;
  const sorted = [...initialErrors].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  let sumSquaredError = 0;
  for (let i = 0; i < confidences.length; i++) {
    const wasAccurate = initialErrors[i] < median ? 1 : 0;
    const p = confidences[i] / 100;
    sumSquaredError += (p - wasAccurate) ** 2;
  }
  return sumSquaredError / confidences.length;
}
