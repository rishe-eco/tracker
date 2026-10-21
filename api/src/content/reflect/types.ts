/**
 * Reflect (the observer recount) — content types.
 *
 * Build plan 07-build-plan.md §5 B1, §6.5. Mirrors `content/noticing/types.ts`:
 * the same spec/surface split, for the same reasons.
 *
 * 1. Content is authored and versioned in this repo, never generated at
 *    runtime. LLM-free by design: the one catch (the interpretation offer)
 *    runs on an authored lexicon, not a model.
 *
 * 2. Every item splits into a locale-invariant `spec` (the lexicon's family
 *    ids) and a per-locale `surface` (the words).
 *
 * 3. The pack is **practice content**, served in `DIALS.practiceLocale`
 *    (PD-7). Interface strings (step names, buttons, the calm close, the
 *    banner) are not here: they are keys in `common.json`, in both locales.
 *
 * The lexicon never reaches a browser: nothing in this folder is imported
 * from `client/app` (fenced by `reflectFences.unit.test.ts`, AC-28).
 */

export type Locale = "en" | "fa";

/** The four authored families of the interpretation lexicon (spec §4.6). */
export type FamilyId = "absolute" | "mind_reading" | "label" | "verdict";

// ─── Spec (locale-invariant) ─────────────────────────────────────────────────

export type FamilySpec = { id: FamilyId };

export type ReflectSpec = {
  contentVersion: string;
  families: FamilySpec[];
};

// ─── Surface (per locale) ────────────────────────────────────────────────────

/** Step 2: the story. `softLine` shows once the story passes `DIALS.storySoftLine`. */
export type StoryCopy = {
  scenePrompt: string;
  scenePlaceholder: string;
  storyPrompt: string;
  softLine: string;
};

/** Step 3: moments. Palettes come from Feelings & Needs' pack, not from here. */
export type FeelingsCopy = {
  prompt: string;
  whenLabel: string;
  whenPlaceholder: string;
  feelingLabel: string;
  needLabel: string;
  metLabel: string;
  metOptions: { met: string; unmet: string; not_sure: string };
};

/** Step 4: reading pairs. */
export type RealityCopy = {
  prompt: string;
  readingLabel: string;
  cameraLabel: string;
};

/** Step 5: the re-reading close. */
export type CloseCopy = {
  prompt: string;
};

/**
 * The interpretation offer's framing. `offerLine` is one template with a
 * `{word}` slot: the lexicon carries no hints, so there is nothing else to
 * vary. The word is shown as the lexicon writes it (PD-13).
 */
export type InterpretationCopy = {
  offerLine: string;
  useLabel: string;
  dismissLabel: string;
};

/**
 * One family's triggers. A trigger may appear in several spellings (the `fa`
 * lexicon lists ZWNJ, joined and Arabic-keyboard variants); the matcher
 * normalizes, so variants of one family may collapse to the same string.
 * Variants never nest across two families.
 */
export type LexiconFamily = {
  family: FamilyId;
  triggers: string[];
};

export type ReflectSurface = {
  /** `draft` means not yet post-edited by a native speaker. Surfaced, not hidden. */
  reviewStatus: "draft" | "reviewed";
  story: StoryCopy;
  feelings: FeelingsCopy;
  reality: RealityCopy;
  close: CloseCopy;
  interpretation: InterpretationCopy;
  lexicon: LexiconFamily[];
};

// ─── The assembled pack ──────────────────────────────────────────────────────

/** The full pack for one locale (spec ∪ surface). Server-side only. */
export type ReflectPack = ReflectSurface & {
  contentVersion: string;
  locale: Locale;
};
