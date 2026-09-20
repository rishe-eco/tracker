/**
 * Noticing — the dials.
 *
 * Build plan §5 phase 1, spec §6 (Dials table). Mirrors
 * `content/feelings-needs/dials.ts`: a hardcoded, typed config object rather
 * than a settings table, because the real product grows an
 * evaluation-and-settings layer over exactly these parameters. Values here are
 * provisional first-pass calls, carried over from the spec's provisional
 * column — tune against the feel-test (build plan §10), not against a streak.
 */

export const DIALS = {
  /**
   * The place palette (spec §6 `placePalette`). One number, not a pool/display
   * split like needs below: the frame never rotates or grows this list, so
   * there is nothing to keep in reserve. The escape ("somewhere else → type
   * it") is offered alongside these, not counted in the five.
   */
  places: {
    displayCount: 5,
  },

  /**
   * The observable-cue chips (spec §8.3b), beat-1 step 3's one-time palette.
   * Same reasoning as `places` — authored once, shown whole, escape on top.
   */
  cues: {
    displayCount: 6,
  },

  /**
   * The needs palette (spec §6 `needPoolSize` / `needDisplayCount`, build plan
   * §4). Two numbers on purpose, same split as Module 1's feeling palette: the
   * pool has to be wide enough to read another person's life — practical,
   * informational, and needs that invite no offer (build plan §4) — while the
   * screen stays small enough that the step reads as a handful of words, not a
   * menu to browse.
   */
  needs: {
    poolSize: 20,
    displayCount: 6,
  },

  /**
   * The optional loop repeat (spec §6 `repeatSoftCap`). Soft-capped so a
   * plural sitting can never become an inventory of people — the fourth pass
   * is usually inventory, not noticing.
   */
  repeat: {
    softCap: 3,
  },

  /**
   * Tier 3 catches (spec §6 `catchCooldownDays`, `catchesPerSitting`; build
   * plan §6 delta 3, §8). The cooldown is per catch TYPE and measured in days,
   * not passes — `NoticingState.lastCatchAt` is the map this dial is read
   * against. `perSitting` caps total catches (of any type) within one sitting,
   * on top of the per-type cooldown.
   *
   * Raised from the spec's provisional 3 to 5 (phase 5 judgment call). Read
   * the three lexicons side by side: `read`'s triggers (rude, difficult,
   * fine, cold, annoying...) are exactly the casual evaluative shorthand
   * people reach for constantly when describing someone in a sentence or
   * two, where `strategy`'s (a ride, a lawyer, a loan...) and `protective`'s
   * (should, have to, guilty...) are narrower and gated behind an optional
   * field skipped by default. At 3 days, `read` alone was on track to refire
   * roughly twice a week indefinitely against ordinary language — a cadence
   * closer to a running commentary on word choice than the distributed touch
   * spec §4.4 asks for. `strategy`/`protective` were never going to be the
   * type that hit this ceiling (their triggers are rarer and their fields
   * are optional), so raising the one shared number mostly reins in `read`
   * without meaningfully starving the other two.
   *
   * This is a uniform bump to one shared dial, not a structural fix: `read`
   * plausibly deserves its own, longer cooldown rather than sharing one
   * number with two types that were never going to strain it — the
   * underlying state (`lastCatchAt`, keyed by type) already supports that
   * split; only this dial's shape doesn't yet. Worth revisiting with real
   * usage data (build plan §10's gates) rather than guessing a second number
   * now.
   */
  catches: {
    cooldownDays: 5,
    perSitting: 1,
  },

  /**
   * The day-one frame (spec §4.1). `recallWindow` is copy guidance, not an
   * enforced range — the reverse-prompt ("how was the person you sat nearest
   * to yesterday?") only lands if the memory is close, so the frame asks about
   * today or yesterday and nothing older.
   */
  frame: {
    recallWindow: "today or yesterday",
  },

  /**
   * P7-equivalent: self-initiation and the one-time graduation door (spec §6
   * `selfInitiationWindow`; build plan §6 delta 2). Operationalized exactly
   * like Feelings & Needs' prompt fade — `computeFadeLevel` derives a level
   * from completed sittings, capped here, never stored (see
   * `services/noticing/state.ts`). The spec frames the dial as "unprompted
   * passes over ~2 weeks"; `sittingsPerFadeStep` is this build's first-pass
   * translation of that into the same mechanism Module 1 already ships.
   */
  graduation: {
    sittingsPerFadeStep: 5,
    graduationFadeLevel: 3,
  },

  /**
   * The soft signal that keeps the offered act small (spec §6
   * `smallThingLengthHint`). A placeholder hint string, not an enforced
   * character limit — the field stays free text.
   */
  smallThing: {
    lengthHint: "one line",
  },
} as const;

export type Dials = typeof DIALS;
