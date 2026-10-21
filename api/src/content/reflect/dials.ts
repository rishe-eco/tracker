/**
 * Reflect: the dials.
 *
 * Build plan §6.4 (limits), PD-7 (practice locale), PD-10 (cooldowns). A
 * hardcoded, typed config object rather than a settings table, same as
 * `content/noticing/dials.ts`. The numbers are the founder's to change.
 *
 * Client-side limits (the autosave pause) live with the client hook, which
 * cannot import from here: nothing under `client/app` imports this folder.
 */

export const DIALS = {
  /** Character limits, enforced by the server and read back to the client through the API. */
  limits: {
    scene: 140,
    story: 5000,
    whenText: 280,
    reading: 280,
    camera: 280,
    /** A feeling or need the person types (`other → type it`). */
    ownWord: 60,
    close: 1000,
  },

  /** Moments and reading pairs per entry. The unique `(entryId, position)` key backs both under a race. */
  momentsCap: 3,
  readingsCap: 3,

  /** Past the soft line the story step shows one sentence. No counter, ever (AC-44). */
  storySoftLine: 1500,

  /** Past entries come in pages of this size, with a `before` cursor (PD-11). */
  pastPageSize: 50,
  /** Characters of the story shown in the Past entries list. */
  storyStartChars: 80,

  /**
   * Reflect's own pack, and Feelings & Needs' palettes and lexicon, are served
   * in this locale whatever `Accept-Language` says (PD-7). The `fa` surface
   * ships complete and `draft`, and is not served in this version.
   */
  practiceLocale: "en",

  /**
   * Cooldowns for the two offers (PD-10). Each is measured in days from the
   * date in `ReflectState.lastCatchAt`, written when the offer is surfaced, and
   * each is also held to once per entry.
   */
  catches: {
    interpretation: { cooldownDays: 2, perEntry: 1 },
    faux: { cooldownDays: 7, perEntry: 1 },
  },
} as const;

export type Dials = typeof DIALS;
