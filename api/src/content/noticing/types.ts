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
  /** Step 1 — the recalled episode. Carries the reroute for "can't think of one". */
  moment: FrameStepSurface & { reroutePrompt: string; rerouteLabel: string };
  /** Step 2 — their own unsaid need. Palette (needs) + `other → type it`. */
  unsaidNeed: FrameStepSurface & { otherLabel: string };
  /** Step 3 — what was visible. Multi-select cue chips + escape. */
  visibleCues: FrameStepSurface & { otherLabel: string };
  /** Step 4 — no question. Reports the turn as a description, not a claim. */
  turn: { line: string };
  /** Step 5 — the reverse prompt. A two-way pick, not free text. */
  reverse: FrameStepSurface & { knowLabel: string; noIdeaLabel: string; noIdeaResponse: string };
};

/**
 * Beat 2 — the welcome-calibration prediction (spec §4.1). Shown once, as a
 * correction to a guess the person just made — never as a standing statistic.
 */
export type FrameBeatTwoSurface = {
  prompt: string;
  options: { id: "not_very" | "somewhat" | "very"; label: string }[];
  correction: { line: string; body: string };
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
 * from one object without reaching into the pack root.
 */
export type LoopCopySurface = {
  placePrompt: string;
  placeOtherLabel: string;
  personPrompt: string;
  personThirdPartyWarning: string;
  observationPrompt: string;
  needPrompt: string;
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
 * The field contract (build plan §8, binding on the phase-5 matcher, stated
 * here because it is a property of the content's shape): `read` matches only
 * `observation`; `strategy` matches `need` and `smallThing`; `protective`
 * matches `smallThing` and `motiveNote`. **None of the three is ever matched
 * against `person`** — a matcher that read the person field would be the tool
 * forming an opinion about a named human being.
 */
export type CatchTypeId = "read" | "strategy" | "protective";

/** Locale-invariant: how many hint chips this catch type's surface supplies. */
export type CatchLexiconSpec = {
  type: CatchTypeId;
  hintSlots: number;
};

/**
 * Per-locale realization. `triggers` are the match strings — a closed set,
 * the whole detector, no model. Never shipped to the client: detection runs
 * server-side (`services/noticing/catches.ts`, phase 5) and the client only
 * receives a catch that already fired.
 */
export type CatchLexiconSurface = {
  type: CatchTypeId;
  triggers: string[];
  /** The gentle contrast line, framed as a question, not a correction. */
  line: string;
  /** Candidate needs offered as chips. Empty for `protective`, which routes instead of offering. */
  hints: string[];
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
  catches: (CatchLexiconSurface & { hintSlots: number })[];
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

/** Compose a catch that just fired. Server-side only — see `catches.ts` (phase 5). */
export function renderCatch(
  pack: NoticingPack,
  type: CatchTypeId
): { line: string; hints: string[]; dismiss: string; note: string; routeTo?: string } | null {
  const lexicon = pack.catches.find((c) => c.type === type);
  if (!lexicon) return null;
  return {
    line: lexicon.line,
    hints: lexicon.hints,
    dismiss: pack.catchCopy.dismiss,
    note: pack.catchCopy.note,
    routeTo: lexicon.routeTo,
  };
}
