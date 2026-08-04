/**
 * Feelings & Needs (Learn Module 1) — content types.
 *
 * Plan: ecosystem/working/learn-build/00-module1-demo-plan.md §5, §6.
 * Mechanisms: ecosystem/working/learn-mechanisms/00-module1-process-anatomy.md.
 *
 * This tool reuses the skills-engine content discipline (00-skills-engine.md §5,
 * §5.1), for the same reason: to keep Persian cheap to add later (plan §7). Two
 * rules shape everything here:
 *
 * 1. Content is authored and versioned in this repo, never generated at runtime.
 *    The module is LLM-free by design — the distinction catch (P5) runs on an
 *    authored lexicon, not a model (plan §6).
 *
 * 2. Every content item splits into a locale-invariant `spec` and a per-locale
 *    `surface`. The spec holds the structure that must stay identical across
 *    locales (palette ids, weighting, lexicon concept ids, their category and
 *    hint slots); the surface holds only the words. Author the spec once;
 *    realize the surface per locale.
 *
 * The demo ships English-only. `fa` is deferred, not dropped — the split is the
 * one shortcut we do NOT take, because taking it is what would make Persian
 * expensive later.
 */

export type Locale = "en" | "fa";

// ─── Palettes ────────────────────────────────────────────────────────────────

/**
 * The feeling palette is weighted so pleasant / met-need words surface first
 * (P1's early-felt-win precondition, P3's granularity-in-context): `early`
 * entries lead, `broaden` entries enter once the loop is established. Texture and
 * need palettes are not tier-weighted.
 */
export type PaletteTier = "early" | "broaden";

/** Locale-invariant: the entry's identity and (for feelings) its weighting. */
export type PaletteEntrySpec = {
  id: string;
  tier?: PaletteTier;
};

/**
 * Per-locale: the word the person sees.
 *
 * `carryLabel` is the form the word takes when it is *carried into the next
 * prompt* rather than sitting on a chip — "in your {{place}} —" on the texture
 * step, and so on. Optional, and it falls back to `label`.
 *
 * It exists because a chip label and a word inside a sentence are not always the
 * same string, in either language:
 *
 * - In English the fallback is nearly always right, but not for
 *   `hard_to_place`: "in your **hard to place** —" is not a sentence.
 * - In Persian it is load-bearing. The carry wants a possessive ("توی
 *   **سینه‌ات** —"), and Persian attaches that suffix differently depending on
 *   how the word ends — سینه → سینه‌ات, گلو → گلویت. No rule the code could
 *   apply gets both; the surface simply states the form.
 *
 * Surface-only, so it adds nothing to the spec and cannot put the locales out of
 * parity: a locale that does not need it says nothing.
 */
export type PaletteEntrySurface = {
  id: string;
  label: string;
  carryLabel?: string;
};

/** The form to use inside a carried sentence, falling back to the chip label. */
export function carryLabelOf(entry: PaletteEntrySurface): string {
  return entry.carryLabel ?? entry.label;
}

// ─── Day-1 frame (P1) ────────────────────────────────────────────────────────

/**
 * The "felt, not told" sequence, as a four-beat script: recall → locate → name →
 * payoff (plan §4.1).
 *
 * Two failure modes are designed against, and both live in this copy. The lesson
 * is never stated as a slogan — the payoff reports what just happened rather than
 * asserting a principle, because a belief that is told is a motivational poster
 * and a belief that is felt is a belief. And the first attempt must not fail to
 * land a word: `recall` steers toward an ordinary, mild moment (not the hardest
 * thing available) and the offered words are plain, so something fits.
 */
export type FrameBeat = {
  prompt: string;
  /** The quieter second line — guidance, not instruction. */
  helper: string;
};

export type FrameSurface = {
  intro: { title: string; body: string; begin: string };
  recall: FrameBeat & { ready: string };
  /**
   * *Where* it sits — a place in the body.
   *
   * Split from the texture beat below because the original single step asked
   * "where does it sit in your body?" and then offered *texture* words (heavy,
   * tight, hollow). The question and its answers were about different things,
   * which reads as a non-sequitur at exactly the moment the person is being
   * asked to attend inward for the first time. Two beats also match P2's actual
   * move, which is "attend to **where / what texture** the state has".
   */
  place: FrameBeat & { locationIds: string[] };
  /** *What it's like* there. Now genuinely a second question. */
  texture: FrameBeat & { textureIds: string[] };
  /** Which feeling entries the frame offers — plain words, so one lands. */
  name: FrameBeat & { feelingIds: string[] };
  /** The felt payoff. Reports the handle appearing; never states the lesson. */
  payoff: { line: string; body: string; close: string };
};

// ─── The daily loop copy (P2→P3→P4) ──────────────────────────────────────────

/**
 * Step prompts for the loop wizard. Everything obeys "keep moving" (plan §10).
 *
 * The `*Terse` variants are the withdrawn form of each prompt, used once the
 * scaffold starts fading (P7). They are authored rather than generated by
 * truncation, because the short form of a prompt is a different sentence, not a
 * clipped one — and because the fade is the actual mechanism here, not a
 * cosmetic setting.
 *
 * `bodyHelper` is nullable: at the first fade step the helper lines simply stop
 * being sent. Withdrawing the scaffolding *is* the intervention — the person is
 * meant to notice, eventually, that the app stopped explaining and they carried
 * on anyway.
 */
export type LoopCopySurface = {
  breathePrompt: string;
  breatheHint: string | null;
  breatheSkip: string;
  /** Where it sits. See the note on FrameSurface.place for why this is its own beat. */
  placePrompt: string;
  placePromptTerse: string;
  placeHelper: string | null;
  /** "in your {{place}} —", carried onto the texture step. */
  textureCarry: string;
  texturePrompt: string;
  texturePromptTerse: string;
  textureHelper: string | null;
  /** "on that {{texture}} feeling —" — the texture is carried forward on screen. */
  nameCarry: string;
  namePrompt: string;
  namePromptTerse: string;
  nameOther: string;
  nameOwnPlaceholder: string;
  /** "this {{feeling}} —" */
  needCarry: string;
  needPrompt: string;
  needPromptTerse: string;
  needSkip: string;
  smallStepPrompt: string;
  smallStepPlaceholder: string;
  smallStepSkip: string;
  done: string;
  /** Offered at close; "add another" is a quiet secondary (plan §4.2). */
  addAnother: string;
  addAnotherAsk: string;
  /** Shown when the soft cap is reached — closes warmly, never scolds. */
  addAnotherCapped: string;
  finish: string;
  /** Recap for a plural sitting — side by side, explicitly not related. */
  recapHeading: string;
  recapLead: string;
  recapNotRelated: string;
  /** The repeat skips the breath — already settled. */
  repeatLead: string;
  repeatPrompt: string;
};

// ─── Distinction catch (P5) ──────────────────────────────────────────────────

/**
 * Faux-feelings group into families by what the judgment is *about*. The catch
 * line comes from the family; the hints underneath come from the specific word.
 * Authoring it this way is what keeps 39 concepts maintainable — and keeps the
 * catch from reading as 39 slightly different lectures.
 */
export type LexiconCategoryId =
  | "excluded"
  | "diminished"
  | "betrayed"
  | "pressured"
  | "threatened";

/**
 * A faux-feeling concept: an evaluative word masquerading as a feeling.
 * `feelingSlots` / `needSlots` are the number of hint chips the surface supplies,
 * so the locales stay structurally matched where they overlap.
 *
 * `locales` is the one place this spec is **not** locale-invariant, and it is a
 * deliberate exception rather than a leak.
 *
 * Everything else here is structure that must be identical across languages —
 * palette ids, weighting, hint-slot counts — because that is what makes two
 * locales comparable. A faux-feeling is different in kind. The NVC list is a
 * claim about *English words*: "ignored", "dismissed", "let down" are adjectives
 * that look like feelings and are not. That claim does not transfer, and the
 * mismatch runs both ways:
 *
 * - Persian mostly lacks those adjectives; it says the same things as passive
 *   verb phrases, which the `fa` surface handles.
 * - Persian *has* judgments English has no word for. «بی‌معرفتی» is a friend
 *   failing the duty of معرفت; «تحویل نگرفتن» is warmth withheld on arrival;
 *   «منت گذاشتن» is a kindness weighed back at you. Each is a reading of what
 *   someone did, wearing a feeling's clothes — exactly what the catch is for —
 *   and none has an English counterpart to pair it with.
 *
 * The alternative was to give every concept an entry in every locale. That would
 * mean inventing English triggers for a concept English does not have, so the
 * catch could fire on words nobody types. Declaring the scope is more honest, and
 * it keeps the failure visible: a concept with no surface in a locale it claims
 * is still an error.
 *
 * Omit `locales` for a concept every language shares — which is most of them.
 */
export type LexiconConceptSpec = {
  id: string;
  category: LexiconCategoryId;
  feelingSlots: number;
  needSlots: number;
  /** Locales that realize this concept. Absent means all of them. */
  locales?: Locale[];
};

/** The per-family catch line. `{{word}}` is replaced with the concept's word. */
export type LexiconCategorySurface = {
  id: LexiconCategoryId;
  catchTemplate: string;
};

/**
 * Per-locale realization. `triggers` are the match strings (a closed set — this
 * is the whole detector, no ML). They never reach the client: detection runs
 * server-side and the client only receives the catch for a concept that fired.
 *
 * **The matching contract** (binding on the P5 matcher, Phase 5):
 *
 * - Match against the **feeling field only** — the palette word chosen, or the
 *   short phrase typed into the "other" escape. Never against `smallAction` or
 *   any other free text. Several triggers are ordinary English words ("used",
 *   "forced", "played") which are unambiguous *as a named feeling* and would
 *   over-fire inside prose.
 * - **Case-insensitive, on word boundaries.** Substring matching would fire
 *   "used" inside "unused".
 * - **Longest match wins.** Some triggers nest inside others ("cheated" inside
 *   "cheated on"); the longer is the more specific reading.
 * - **At most one catch per pass**, subject to the distribution dials — the
 *   catch is a distributed touch, not an annotation pass.
 */
export type LexiconConceptSurface = {
  id: string;
  /** Display form, substituted into the category's `catchTemplate`. */
  word: string;
  triggers: string[];
  /** Chip labels: the feeling underneath ("hurt?", "lonely?"). */
  feelingHints: string[];
  /** Chip labels: the need underneath ("to matter?", "to be included?"). */
  needHints: string[];
};

/**
 * The framing around a catch. `dismiss` is load-bearing, not politeness: a catch
 * the person cannot wave off is a quiz, and a quiz triggers the defensiveness
 * that stops the contrast landing (P5 mechanism).
 */
export type CatchCopySurface = {
  /** Fallback line when a concept has no category-specific template. */
  genericTemplate: string;
  feelingHintsLabel: string;
  needHintsLabel: string;
  dismiss: string;
  /** Quiet reassurance that this is their own material, not a correction. */
  note: string;
};

// ─── Self-initiation (P7) ────────────────────────────────────────────────────

/**
 * The one-time capability moment. A door, not a score — no count, no streak, and
 * nothing that can be lost again (decision-log 2026-08-01).
 */
export type GraduationSurface = {
  line: string;
  body: string;
  close: string;
};

// ─── Pack assembly ───────────────────────────────────────────────────────────

export type FeelingsNeedsSpec = {
  contentVersion: string;
  locations: PaletteEntrySpec[];
  textures: PaletteEntrySpec[];
  feelings: PaletteEntrySpec[];
  needs: PaletteEntrySpec[];
  lexicon: LexiconConceptSpec[];
};

export type FeelingsNeedsSurface = {
  /**
   * `draft` means machine-drafted and not yet post-edited by a native speaker.
   * Surfaced in the UI rather than hidden — a draft locale is a known state.
   */
  reviewStatus: "draft" | "reviewed";
  locations: PaletteEntrySurface[];
  textures: PaletteEntrySurface[];
  feelings: PaletteEntrySurface[];
  needs: PaletteEntrySurface[];
  frame: FrameSurface;
  loop: LoopCopySurface;
  catch: CatchCopySurface;
  graduation: GraduationSurface;
  lexiconCategories: LexiconCategorySurface[];
  lexicon: LexiconConceptSurface[];
};

/** The full assembled pack (spec ∪ surface) for one locale. Server-side only. */
export type FeelingsNeedsPack = {
  contentVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  locations: (PaletteEntrySurface & { tier?: PaletteTier })[];
  textures: (PaletteEntrySurface & { tier?: PaletteTier })[];
  feelings: (PaletteEntrySurface & { tier?: PaletteTier })[];
  needs: (PaletteEntrySurface & { tier?: PaletteTier })[];
  frame: FrameSurface;
  loop: LoopCopySurface;
  catch: CatchCopySurface;
  graduation: GraduationSurface;
  lexiconCategories: LexiconCategorySurface[];
  lexicon: (LexiconConceptSurface & { category: LexiconCategoryId })[];
};

/**
 * What the client is allowed to see. It carries the palettes, frame and loop
 * copy — but NOT the lexicon or its catch templates. There is no answer key to
 * protect here (the module is LLM-free and the palettes are public), but
 * detection is a server concern: the catch is composed server-side when a
 * faux-feeling fires, so the trigger list has no reason to ship to a browser.
 */
export type PublicFeelingsNeedsPack = {
  contentVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  locations: (PaletteEntrySurface & { tier?: PaletteTier })[];
  textures: (PaletteEntrySurface & { tier?: PaletteTier })[];
  feelings: (PaletteEntrySurface & { tier?: PaletteTier })[];
  needs: (PaletteEntrySurface & { tier?: PaletteTier })[];
  frame: FrameSurface;
  loop: LoopCopySurface;
  graduation: GraduationSurface;
};

export function toPublicPack(pack: FeelingsNeedsPack): PublicFeelingsNeedsPack {
  const {
    lexicon: _lexicon,
    lexiconCategories: _categories,
    catch: _catch,
    ...rest
  } = pack;
  return rest;
}

/** Compose a catch line for a concept that just fired. Server-side. */
export function renderCatch(
  pack: FeelingsNeedsPack,
  conceptId: string
): { line: string; feelingHints: string[]; needHints: string[] } | null {
  const concept = pack.lexicon.find((c) => c.id === conceptId);
  if (!concept) return null;
  const category = pack.lexiconCategories.find((c) => c.id === concept.category);
  const template = category?.catchTemplate ?? pack.catch.genericTemplate;
  return {
    line: template.replace("{{word}}", concept.word),
    feelingHints: concept.feelingHints,
    needHints: concept.needHints,
  };
}
