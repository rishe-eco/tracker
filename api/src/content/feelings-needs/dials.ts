/**
 * Feelings & Needs — the dials.
 *
 * Plan §8 (Dials — "a hardcoded config object, not a table") and §11.3 (exact
 * values to confirm during the build). Sourced from the mechanism doc's Dials
 * rows (00-module1-process-anatomy.md, P1–P7).
 *
 * These are hardcoded for the demo on purpose. The real product grows an
 * evaluation-and-settings layer over exactly these parameters (the mechanism
 * doc's whole point) — keeping them in one typed object now is what makes that
 * layer cheap later. Values are provisional first-pass calls; tune against the
 * team feel-test (M6), not against a streak.
 */

export const DIALS = {
  /** P1: the frame is a required, once-only onboarding moment (plan §4.1, §11.4). */
  frame: {
    required: true,
    skippable: false,
  },

  /**
   * P2: one short settling breath. NOT a timer or meditation — a threshold, not
   * a duration (plan §4.2, §10). Skippable, and skipped automatically on a
   * repeat pass (already settled).
   */
  breath: {
    skippable: true,
    /** Purely a UI cue length; there is deliberately no enforced countdown. */
    suggestedSeconds: 6,
  },

  /**
   * P3: the palette stays small — granularity is built in context, never a
   * word-count (plan §10).
   *
   * Two different numbers, deliberately. The guardrail is about **what is on
   * screen**: a wall of words becomes a menu to browse, which breaks the
   * keep-moving loop. It is not about how many words the pack knows. The other
   * failure mode pulls the opposite way — a loop that can't land any word teaches
   * that feelings are opaque (P1 failure mode b), and a six-word pool guarantees
   * that for anyone who is angry, ashamed or overwhelmed.
   *
   * So: author a pool wide enough to cover the affect space, show a small
   * selection from it. `*DisplayCount` is the guardrail; `*PoolSize` is a
   * bookkeeping assertion that the authored content still matches this file.
   */
  palette: {
    locationDisplayCount: 6,
    textureDisplayCount: 6,
    feelingDisplayCount: 6,
    needDisplayCount: 5,

    locationPoolSize: 8,
    texturePoolSize: 12,
    feelingPoolSize: 20,
    needPoolSize: 12,

    /**
     * How many early-felt-win loops before `broaden`-tier feeling words are
     * mixed into the displayed selection (P1 precondition: an early success
     * installs the malleability belief; the palette is weighted pleasant/
     * met-need early).
     */
    earlyWinLoops: 5,
  },

  /**
   * The optional loop repeat for plural feelings (plan §4.2). Soft-capped so it
   * can never become an open-ended emotional inventory — the rumination the
   * "keep moving" guard exists to prevent.
   */
  repeat: {
    softCap: 3,
  },

  /**
   * P5: the distinction catch surfaces only after the loop is established
   * (~week 2), distributed rather than all at once. `minLoopsBeforeCatch` gates
   * the first catch; `catchCooldownPasses` spaces subsequent ones so it never
   * fires on every instance (plan §4.3, §10 "catch, don't quiz").
   */
  distinctions: {
    minLoopsBeforeCatch: 10,
    catchCooldownPasses: 3,
  },

  /**
   * P7: prompt-fade + one-time capability moment. Detect-don't-count — no streak
   * anywhere (decision-log 2026-08-01). `sittingsPerFadeStep` is how many
   * sittings advance one fade level; `graduationFadeLevel` is the level at which
   * the one-time "this runs on its own now" door is surfaced.
   */
  graduation: {
    sittingsPerFadeStep: 5,
    graduationFadeLevel: 3,
  },
} as const;

export type Dials = typeof DIALS;
