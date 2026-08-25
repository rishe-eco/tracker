/**
 * Review scheduling and probe timing.
 *
 * Fixed expanding intervals rather than a learned model (FSRS-class scheduling
 * is a P2 refinement). At this item volume a learned scheduler would be fitting
 * noise; fixed intervals are honest about what they are.
 *
 * Spec: 00-skills-engine.md §6, §8.
 */

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 21, 60] as const;

/** Days between the post probe and the delayed retention probe. */
export const DELAYED_PROBE_DELAY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic non-negative hash of a seed string. Shared by `jitterDays`
 * (review-date spread) and the probe form-rotation offset (`probes.ts`) — both
 * need "the same seed always lands the same way" rather than a true RNG, so
 * tests don't need a clock or a seedable random source.
 */
export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic ±1 day spread, seeded by module and user.
 *
 * Without it, a learner who does six modules in one sitting gets six reviews due
 * on the same morning, looks at the pile, and does none of them. Deterministic
 * rather than random so the same module always lands the same way — and so
 * tests don't need a clock or a seedable RNG.
 */
export function jitterDays(seed: string): -1 | 0 | 1 {
  return ((hashSeed(seed) % 3) - 1) as -1 | 0 | 1;
}

/**
 * When the module at `intervalIndex` next falls due. Indexes past the end of the
 * ladder stay at the final interval — a module that keeps passing keeps coming
 * back, just rarely.
 */
export function nextReviewAt(intervalIndex: number, from: Date, seed: string): Date {
  const idx = Math.min(Math.max(intervalIndex, 0), REVIEW_INTERVAL_DAYS.length - 1);
  const base = REVIEW_INTERVAL_DAYS[idx];
  // Clamp to at least one day: a "review" scheduled for the same sitting would
  // defeat the spacing it exists to create.
  const days = Math.max(1, base + jitterDays(seed));
  return new Date(from.getTime() + days * DAY_MS);
}

export type ReviewOutcome = {
  intervalIndex: number;
  nextReviewAt: Date;
  /**
   * Where a failed review re-enters the module. Step 5 is diagnose-and-fix, not
   * step 1: re-reading the concept is not the remedy for a failed application.
   */
  resumeAtStep: number;
};

export function onReviewPassed(currentIndex: number, now: Date, seed: string): ReviewOutcome {
  const next = Math.min(currentIndex + 1, REVIEW_INTERVAL_DAYS.length - 1);
  return { intervalIndex: next, nextReviewAt: nextReviewAt(next, now, seed), resumeAtStep: 7 };
}

export function onReviewFailed(_currentIndex: number, now: Date, seed: string): ReviewOutcome {
  return { intervalIndex: 0, nextReviewAt: nextReviewAt(0, now, seed), resumeAtStep: 5 };
}

export type ReviewSubmissionSchedule = {
  reviewIntervalIndex: number;
  nextReviewAt: Date;
  currentStep: number;
};

/**
 * What a submitted review does to a module's row — the step every skill tool
 * must take when the attempt just submitted was itself a due review, instead
 * of the ordinary `scheduleOnMastery` recompute. `scheduleOnMastery` only ever
 * *reads* `reviewIntervalIndex`; nothing writes it. Without this, a passed or
 * a failed review both fall through to `scheduleOnMastery`, which reschedules
 * at whatever the stored index already is (always 0, since nothing advances
 * it) — so the expanding ladder never expands and a fail never routes back to
 * the diagnose step.
 */
export function scheduleOnReviewSubmitted(
  passed: boolean,
  existing: { reviewIntervalIndex: number } | null | undefined,
  now: Date,
  seed: string
): ReviewSubmissionSchedule {
  const outcome = passed
    ? onReviewPassed(existing?.reviewIntervalIndex ?? 0, now, seed)
    : onReviewFailed(existing?.reviewIntervalIndex ?? 0, now, seed);
  return {
    reviewIntervalIndex: outcome.intervalIndex,
    nextReviewAt: outcome.nextReviewAt,
    currentStep: outcome.resumeAtStep,
  };
}

export type MasterySchedule = { masteredAt: Date; nextReviewAt: Date };

/**
 * On first mastery, stamp `masteredAt` once and schedule the next spaced
 * review — the step every skill tool must take so a mastered module actually
 * enters the review queue instead of sitting there permanently "mastered" and
 * never coming back. Shared here (rather than reimplemented per tool) because
 * Clarity Lab shipped this step half-done — `masteredAt` only, no
 * `nextReviewAt` — and a third tool is where that stops being tolerable.
 */
export function scheduleOnMastery(
  existing: { masteredAt: Date | null; reviewIntervalIndex: number } | null | undefined,
  now: Date,
  seed: string
): MasterySchedule {
  return {
    masteredAt: existing?.masteredAt ?? now,
    nextReviewAt: nextReviewAt(existing?.reviewIntervalIndex ?? 0, now, seed),
  };
}

/**
 * The delayed probe. Scheduled as a row rather than computed on read, because
 * "did the learner actually come back" is itself a reported outcome — and the
 * question of whether either skill *sticks* is the one the published literature
 * has not answered.
 */
export function delayedProbeDueAt(postCompletedAt: Date): Date {
  return new Date(postCompletedAt.getTime() + DELAYED_PROBE_DELAY_DAYS * DAY_MS);
}

/** "YYYY-MM-DD". Pass the learner's local date — two calendar days should mean two of *their* days. */
export function toDayKey(date: Date, timeZoneOffsetMinutes = 0): string {
  const shifted = new Date(date.getTime() - timeZoneOffsetMinutes * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
