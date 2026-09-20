/**
 * Noticing (Impact Act 1) — content types.
 *
 * Build plan §2, §7. Mirrors `content/feelings-needs/types.ts` — same
 * spec/surface split, same reasons — but shares no code or import with it
 * (build plan §3, §4): Noticing authors its own needs palette and its own
 * catch lexicons.
 *
 * 1. Content is authored and versioned in this repo, never generated at
 *    runtime. LLM-free by design — the three Tier 3 catches run on authored
 *    lexicons, not a model.
 *
 * 2. Every content item splits into a locale-invariant `spec` and a
 *    per-locale `surface`. The spec holds structure that must stay identical
 *    across locales (palette ids, catch type ids, hint-slot counts); the
 *    surface holds only the words.
 *
 * The prototype ships English-only. `fa` is structurally present as a
 * declared draft (build plan §3) — deferred, not dropped.
 */

export type Locale = "en" | "fa";

// ─── Palettes ────────────────────────────────────────────────────────────────

/** Locale-invariant: the entry's identity. None of Noticing's palettes are tier-weighted. */
export type PaletteEntrySpec = {
  id: string;
};

/** Per-locale: the word the person sees. */
export type PaletteEntrySurface = {
  id: string;
  label: string;
};

// ─── Day-one frame (N1, N2) ──────────────────────────────────────────────────

/** One step's copy: a prompt and an optional quieter second line. */
export type FrameStepSurface = {
  prompt: string;
  helper?: string;
};

/**
 * Beat 1 — five steps, plus the `can't think of one` reroute (spec §4.1).
 * The design rule that generates all of them: the person supplies both halves
 * (their own unsaid need, then what was actually visible) and the tool only
 * lays the two side by side. `turn` asks nothing — it is the juxtaposition,
 * not a sixth question.
 */
export type FrameBeatOneSurface = {
  /**
   * Step 1 — the recalled episode. Carries the reroute for "can't think of
   * one". `wishedPrompt` is the question actually shown once that reroute is
   * taken — it has to ask about a wish rather than a memory, so it cannot
   * share `prompt`'s wording (spec §4.1's escape lands on "a time you wished
   * someone had," a different question, not a fallback phrasing of the same
   * one).
   */
  moment: FrameStepSurface & { reroutePrompt: string; rerouteLabel: string; wishedPrompt: string };
  /** Step 2 — their own unsaid need. Palette (needs) + `other → type it`. */
  unsaidNeed: FrameStepSurface & { otherLabel: string };
  /** Step 3 — what was visible. Multi-select cue chips + escape. */
  visibleCues: FrameStepSurface & { otherLabel: string };
  /**
   * Step 4 — no question. Reports the turn as a description, not a claim.
   *
   * `wishedLine` is a second, mandatory variant for the `wishedInstead`
   * reroute. `line`'s wording ("they got from one to the other") asserts
   * that someone actually made the connection — true by construction on the
   * ordinary path (the recalled help could only have happened if it was
   * read), but false on the reroute path, where by definition nobody did.
   * Rendering `line` there would have the tool assert something about the
   * person's own material that isn't so — precisely the failure beat 1 was
   * rebuilt to stop doing (see the file-level docblock in
   * `v1/surface.en.ts`).
   */
  turn: { line: string; wishedLine: string };
  /** Step 5 — the reverse prompt. A two-way pick, not free text. */
  reverse: FrameStepSurface & {
    knowLabel: string;
    noIdeaLabel: string;
    knowResponse: string;
    noIdeaResponse: string;
  };
};

export type WelcomeGuessId = "not_very" | "somewhat" | "very";

/**
 * Beat 2 — the welcome-calibration prediction (spec §4.1). Shown once, as a
 * correction to a guess the person just made — never as a standing statistic.
 *
 * `lineByGuess` is keyed on purpose (phase-2 review correction): the research
 * finding is that people underestimate, so a single unconditional line
 * ("most people guess this low") is simply wrong for whoever picked `very` —
 * it tells the one person who got it right that they didn't. The `body` is
 * the finding itself and holds regardless of the guess; only the framing
 * around it depends on what was actually picked. The `very` line still
 * reports rather than congratulates — it confirms a guess, it doesn't award
 * one (same register as `reverse.knowResponse`).
 */
export type FrameBeatTwoSurface = {
  prompt: string;
  options: { id: WelcomeGuessId; label: string }[];
  correction: { lineByGuess: Record<WelcomeGuessId, string>; body: string };
};

export type FrameSurface = {
  intro: { title: string; body: string; begin: string };
  beatOne: FrameBeatOneSurface;
  beatTwo: FrameBeatTwoSurface;
};

// ─── The noticing loop copy (N3 → N4 → N5) ───────────────────────────────────

/**
 * Step prompts for the loop: place → person → observation → need → optional
 * small thing, plus the close and the bounded repeat (spec §4.2).
 *
 * `personThirdPartyWarning` sits under the person field specifically — it is
 * not the same string as `NoticingSurface.thirdPartyWarning` for reuse's
 * sake; keeping it here is what lets the loop wizard render every step's copy
 * from one object without reaching into the pack root. Both hold the same
 * words in this pack; nothing requires them to.
 *
 * `*PromptTerse` are the withdrawn form of the four spine prompts, used once
 * the scaffold starts fading (build plan §6 delta 2, spec §6
 * `selfInitiationWindow`). Authored as different sentences, not truncations —
 * same reasoning as Feelings & Needs' terse variants: the short form of a
 * prompt is a different sentence, and withdrawing the scaffolding is the
 * mechanism, not a cosmetic shortening. `smallThingPrompt` and
 * `capacityPrompt` have no terse form, same as Module 1's breath and
 * small-step prompts — they are asked rarely enough that fading them buys
 * nothing.
 */
export type LoopCopySurface = {
  placePrompt: string;
  placePromptTerse: string;
  placeOtherLabel: string;
  personPrompt: string;
  personPromptTerse: string;
  personThirdPartyWarning: string;
  observationPrompt: string;
  observationPromptTerse: string;
  needPrompt: string;
  needPromptTerse: string;
  needOtherLabel: string;
  needNotSure: string;
  smallThingPrompt: string;
  smallThingSkip: string;
  /** Post-offer capacity question — asked only when a small thing was written. */
  capacityPrompt: string;
  capacityOtherLabel: string;
  /** "✓ noticed." plus the restatement line. */
  close: string;
  addAnotherAsk: string;
  /** Shown when the soft cap is reached — closes warmly, never scolds. */
  addAnotherCapped: string;
  finish: string;
  recapHeading: string;
  recapNotRelated: string;
};

// ─── Tier 3 catches (N6) ──────────────────────────────────────────────────────

/**
 * Three catch types, not families of concepts — unlike Module 1's 39 faux-
 * feelings, each type here is one authored lexicon (build plan §8).
 *
 * The field contract (build plan §8, binding on the phase-5 matcher) is
 * encoded on the spec itself via `matchesFields`, not left as a comment for
 * the matcher to reimplement correctly: `read` matches only `observation`;
 * `strategy` matches `need` and `smallThing`; `protective` matches
 * `smallThing` and `motiveNote`. **`"person"` must never appear in any
 * `matchesFields` array** — a matcher that read the person field would be
 * the tool forming an opinion about a named human being. The fences suite
 * (build plan §9.4) and the phase-2 content suite both hold this.
 */
export type CatchTypeId = "read" | "strategy" | "protective";

/** The `NoticingEntry` fields a catch is allowed to be matched against. Never `"person"`. */
export type NoticingEntryField = "observation" | "need" | "smallThing" | "motiveNote";

/**
 * Locale-invariant: how many hint chips **every** trigger's hints (and the
 * fallback) must carry, for `strategy`. 0 for `read` and `protective`, which
 * never offer hints at all.
 */
export type CatchLexiconSpec = {
  type: CatchTypeId;
  hintSlots: number;
  /** The field contract, authored once here so phase 5 reads it rather than reimplements it. */
  matchesFields: NoticingEntryField[];
};

/**
 * One trigger and the hints sharp to it. Per-trigger rather than one set per
 * catch type (phase-2 review correction) — offering "rest?" under *"a
 * lawyer"* is the tool visibly not listening, which teaches something worse
 * than a wrong mapping does. Both `match` and `hints` are per-locale: the
 * trigger is a word in a language, and so is what it's paired with.
 */
export type CatchTriggerHints = {
  /** The match string — a closed set, the whole detector, no model. */
  match: string;
  /** Candidate needs, sharp to this trigger. Always phrased as questions. */
  hints: string[];
};

/**
 * Per-locale realization. Never shipped to the client: detection runs
 * server-side (`services/noticing/catches.ts`, phase 5) and the client only
 * receives a catch that already fired.
 */
export type CatchLexiconSurface = {
  type: CatchTypeId;
  triggers: CatchTriggerHints[];
  /** The gentle contrast line, framed as a question, not a correction. */
  line: string;
  /**
   * Hints for a trigger not worth hand-authoring separately — an escape
   * hatch, not the common case. Empty for `read` and `protective`, which
   * never offer hints at all.
   */
  fallbackHints: string[];
  /** `protective` only — routes to the Reflect handoff instead of an answer. */
  routeTo?: string;
};

/**
 * The framing around any catch. `dismiss` is load-bearing, not politeness — a
 * catch the person cannot wave off is a quiz.
 */
export type CatchCopySurface = {
  dismiss: string;
  note: string;
};

// ─── Capacity portrait (accreted, tier 2 close) ──────────────────────────────

export type CapacityCategory = "head" | "hands" | "heart";

export type CapacityCopySurface = {
  prompt: string;
  chips: Record<CapacityCategory, PaletteEntrySurface[]>;
  otherLabel: string;
};

// ─── Self-initiation (N7) ─────────────────────────────────────────────────────

/** The one-time capability moment. A door, not a score. */
export type GraduationSurface = {
  line: string;
  body: string;
  close: string;
};

// ─── Pack assembly ───────────────────────────────────────────────────────────

export type NoticingSpec = {
  contentVersion: string;
  places: PaletteEntrySpec[];
  cues: PaletteEntrySpec[];
  needs: PaletteEntrySpec[];
  catches: CatchLexiconSpec[];
};

export type NoticingSurface = {
  /** `draft` means not yet post-edited by a native speaker. Surfaced, not hidden. */
  reviewStatus: "draft" | "reviewed";
  places: PaletteEntrySurface[];
  cues: PaletteEntrySurface[];
  needs: PaletteEntrySurface[];
  frame: FrameSurface;
  loop: LoopCopySurface;
  catches: CatchLexiconSurface[];
  catchCopy: CatchCopySurface;
  capacity: CapacityCopySurface;
  graduation: GraduationSurface;
  thirdPartyWarning: string;
};

/** The full assembled pack (spec ∪ surface) for one locale. Server-side only. */
export type NoticingPack = {
  contentVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  places: PaletteEntrySurface[];
  cues: PaletteEntrySurface[];
  needs: PaletteEntrySurface[];
  frame: FrameSurface;
  loop: LoopCopySurface;
  catches: (CatchLexiconSurface & { hintSlots: number; matchesFields: NoticingEntryField[] })[];
  catchCopy: CatchCopySurface;
  capacity: CapacityCopySurface;
  graduation: GraduationSurface;
  thirdPartyWarning: string;
};

/**
 * What the client is allowed to see. No `catches` and no `catchCopy` — the
 * lexicons never reach a browser, and a catch is composed server-side and
 * returned only on the pass that triggered it (as `NtcCatch`, build plan §7).
 * There is nothing here shaped like Module 1's `toPublicPack` needing to keep
 * `catch` framing copy public, because that framing travels on `NtcCatch`
 * itself rather than on the content pack.
 */
export type PublicNoticingPack = {
  contentVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  places: PaletteEntrySurface[];
  cues: PaletteEntrySurface[];
  needs: PaletteEntrySurface[];
  frame: FrameSurface;
  loop: LoopCopySurface;
  capacity: CapacityCopySurface;
  graduation: GraduationSurface;
  thirdPartyWarning: string;
};

export function toPublicPack(pack: NoticingPack): PublicNoticingPack {
  const { catches: _catches, catchCopy: _catchCopy, ...rest } = pack;
  return rest;
}

/**
 * Compose a catch that just fired. Server-side only — see `catches.ts`
 * (phase 5), which finds `matchedWord` by walking `matchesFields` against
 * the entry and never against `person`.
 *
 * `matchedWord` substitutes into the lexicon's `{{word}}` — each catch line
 * quotes the person's own word back to them (spec §4.4's own examples all
 * do: "'difficult' is your read on it", "'should' is worth a look"), which is
 * what keeps the contrast about their material rather than a canned line.
 *
 * The hints returned are that trigger's own (`CatchTriggerHints.hints`) —
 * sharp to what was actually typed — falling back to `fallbackHints` only
 * for a trigger that wasn't worth hand-authoring separately.
 */
export function renderCatch(
  pack: NoticingPack,
  type: CatchTypeId,
  matchedWord: string
): { line: string; hints: string[]; dismiss: string; note: string; routeTo?: string } | null {
  const lexicon = pack.catches.find((c) => c.type === type);
  if (!lexicon) return null;
  const trigger = lexicon.triggers.find((t) => t.match.toLowerCase() === matchedWord.toLowerCase());
  return {
    line: lexicon.line.replace("{{word}}", matchedWord),
    hints: trigger?.hints ?? lexicon.fallbackHints,
    dismiss: pack.catchCopy.dismiss,
    note: pack.catchCopy.note,
    routeTo: lexicon.routeTo,
  };
}
