/**
 * Goodman-Kruskal gamma between ordinal self-predictions and binary
 * correctness. Build plan §4.1 — "the file most likely to be written wrong."
 *
 * Predictions are ordinal (no_idea 0, probably_not 1, probably 2, confident 3);
 * outcomes are binary. For every unordered pair with both a prediction
 * difference and an outcome difference, count it concordant (same direction)
 * or discordant (opposite direction); gamma = (C-D)/(C+D).
 *
 * `null` renders as "not measurable from this set," never 0 or a blank — a
 * learner who got everything right has no discriminable variance, and
 * reporting 0 would read as "no self-knowledge" when the truth is "not
 * measurable." This is the confound from spec §2 surfacing in the
 * arithmetic, which is also why resolution is never shown without
 * performance beside it: the sets where gamma is undefined are exactly the
 * sets where performance was extreme.
 */

export type PredictionOutcomePair = { prediction: number; outcome: 0 | 1 };

/** Below this many scored items, gamma is too unstable to display (build plan §4.1). */
export const GAMMA_MIN_ITEMS = 4;

export function computeGamma(pairs: PredictionOutcomePair[]): number | null {
  if (pairs.length < GAMMA_MIN_ITEMS) return null;

  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const pi = pairs[i].prediction;
      const pj = pairs[j].prediction;
      const oi = pairs[i].outcome;
      const oj = pairs[j].outcome;
      if (pi === pj || oi === oj) continue; // no discriminable pair
      const sameDirection = pi > pj === oi > oj;
      if (sameDirection) concordant++;
      else discordant++;
    }
  }

  // C+D === 0 covers "all predictions identical" and "all outcomes identical"
  // (6/6 or 0/6) alike — every pair got skipped above for one reason or the
  // other, so there is nothing to divide.
  if (concordant + discordant === 0) return null;
  return (concordant - discordant) / (concordant + discordant);
}
