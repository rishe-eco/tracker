/**
 * Feelings & Needs `v1` — the locale-invariant spec.
 *
 * Everything here is identical across every locale: palette ids and their
 * weighting, and the faux-feeling concept ids with their family and hint-slot
 * counts. The words live in `surface.<locale>.ts`. Holding this constant is what
 * keeps a later Persian surface comparable and cheap (plan §7).
 *
 * Note what is *not* here: which words a person is shown. The pool is authored
 * wide enough to cover the affect space; how many appear at once is a dial, not
 * content (see `../dials.ts`).
 */

import type {
  FeelingsNeedsSpec,
  LexiconConceptSpec,
  Locale,
  PaletteEntrySpec,
} from "../types";

export const CONTENT_VERSION = "feelings-needs/v1";

/**
 * P2 — where in the body. The first half of P2's move ("attend to where / what
 * texture"), which used to be collapsed into the texture question.
 *
 * Anatomical rather than a vocabulary, so unlike the feelings this pool is
 * small, complete, and does not rotate or fade: there is no granularity to build
 * in naming your own chest.
 *
 * `hard_to_place` is not a filler option. P2's third failure mode is going blank
 * at "where do you feel it", and the mechanism is explicit that blankness must
 * be **handled as information, not failure** — for a high-alexithymia person the
 * sensation may genuinely be faint. A chip records it as an answer; a skip would
 * record it as a step they failed to complete.
 */
export const LOCATION_SPECS: PaletteEntrySpec[] = [
  { id: "chest" },
  { id: "throat" },
  { id: "stomach" },
  { id: "shoulders" },
  { id: "jaw" },
  { id: "head" },
  { id: "all_over" },
  { id: "hard_to_place" },
];

/**
 * P2 — body textures. Concrete and bodily on purpose: these are sensations, not
 * feelings. "restless" is a feeling and belongs in the palette below; "jittery"
 * is what restlessness feels like in the chest, and belongs here. Keeping the
 * two lists honest is what makes "body before words" a real step rather than
 * naming the feeling twice.
 */
export const TEXTURE_SPECS: PaletteEntrySpec[] = [
  { id: "tight" },
  { id: "heavy" },
  { id: "jittery" },
  { id: "warm" },
  { id: "buzzy" },
  { id: "hollow" },
  { id: "light" },
  { id: "tense" },
  { id: "knotted" },
  { id: "sinking" },
  { id: "cold" },
  { id: "fluttery" },
];

/**
 * P3 — feeling words.
 *
 * `early` is weighted pleasant / met-need: the first loops need to land a word
 * and produce a felt win, because that win is what installs the malleability
 * belief (P1 precondition). `broaden` carries the unpleasant / unmet-need range
 * and enters once the loop is established.
 *
 * The broaden tier covers the core affect space — sad, angry, scared, ashamed,
 * overwhelmed all have a word — because a palette that can't name anger doesn't
 * teach granularity, it teaches that the app only wants to hear mild things.
 */
export const FEELING_SPECS: PaletteEntrySpec[] = [
  { id: "at_ease", tier: "early" },
  { id: "glad", tier: "early" },
  { id: "calm", tier: "early" },
  { id: "content", tier: "early" },
  { id: "grateful", tier: "early" },
  { id: "hopeful", tier: "early" },
  { id: "relieved", tier: "early" },
  { id: "curious", tier: "early" },

  { id: "uneasy", tier: "broaden" },
  { id: "restless", tier: "broaden" },
  { id: "disappointed", tier: "broaden" },
  { id: "drained", tier: "broaden" },
  { id: "lonely", tier: "broaden" },
  { id: "hurt", tier: "broaden" },
  { id: "sad", tier: "broaden" },
  { id: "irritated", tier: "broaden" },
  { id: "anxious", tier: "broaden" },
  { id: "overwhelmed", tier: "broaden" },
  { id: "ashamed", tier: "broaden" },
  { id: "tender", tier: "broaden" },
];

/**
 * P4 — needs, offered never forced. Not tier-weighted: a need is a candidate
 * held lightly at every stage, so there is no "advanced" need.
 */
export const NEED_SPECS: PaletteEntrySpec[] = [
  { id: "rest" },
  { id: "connection" },
  { id: "to_matter" },
  { id: "safety" },
  { id: "space" },
  { id: "ease" },
  { id: "to_be_seen" },
  { id: "autonomy" },
  { id: "trust" },
  { id: "understanding" },
  { id: "respect" },
  { id: "support" },
];

/**
 * P5 — the faux-feelings lexicon: the canonical NVC set of evaluative words
 * that masquerade as feelings. This list *is* the detector (plan §6) — no
 * classifier, no training data, no model.
 *
 * Each concept declares its family, which supplies the catch line, and how many
 * feeling/need hint chips its surface must supply, so locales stay structurally
 * matched. The trigger strings are language-specific and live in the surface.
 */
export const LEXICON_SPECS: LexiconConceptSpec[] = [
  // Judgments about being left out or not reached — the disconnection family.
  { id: "ignored", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "left_out", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "invisible", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "unheard", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "abandoned", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "neglected", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "rejected", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "isolated", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "misunderstood", category: "excluded", feelingSlots: 2, needSlots: 2 },
  { id: "unsupported", category: "excluded", feelingSlots: 2, needSlots: 2 },

  // Judgments about being made small — the dignity family.
  { id: "dismissed", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "belittled", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "patronized", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "criticized", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "judged", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "put_down", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "insulted", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "invalidated", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "unappreciated", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "taken_for_granted", category: "diminished", feelingSlots: 2, needSlots: 2 },
  { id: "disrespected", category: "diminished", feelingSlots: 2, needSlots: 2 },

  // Judgments about broken trust — the reliance family.
  { id: "let_down", category: "betrayed", feelingSlots: 2, needSlots: 2 },
  { id: "betrayed", category: "betrayed", feelingSlots: 2, needSlots: 2 },
  { id: "cheated", category: "betrayed", feelingSlots: 2, needSlots: 2 },
  { id: "lied_to", category: "betrayed", feelingSlots: 2, needSlots: 2 },
  { id: "distrusted", category: "betrayed", feelingSlots: 2, needSlots: 2 },
  { id: "used", category: "betrayed", feelingSlots: 2, needSlots: 2 },
  { id: "manipulated", category: "betrayed", feelingSlots: 2, needSlots: 2 },

  // Judgments about being squeezed — the autonomy family.
  { id: "pressured", category: "pressured", feelingSlots: 2, needSlots: 2 },
  { id: "coerced", category: "pressured", feelingSlots: 2, needSlots: 2 },
  { id: "cornered", category: "pressured", feelingSlots: 2, needSlots: 2 },
  { id: "obligated", category: "pressured", feelingSlots: 2, needSlots: 2 },
  { id: "overworked", category: "pressured", feelingSlots: 2, needSlots: 2 },

  // Judgments about being come at — the safety family.
  { id: "attacked", category: "threatened", feelingSlots: 2, needSlots: 2 },
  { id: "threatened", category: "threatened", feelingSlots: 2, needSlots: 2 },
  { id: "intimidated", category: "threatened", feelingSlots: 2, needSlots: 2 },
  { id: "bullied", category: "threatened", feelingSlots: 2, needSlots: 2 },
  { id: "harassed", category: "threatened", feelingSlots: 2, needSlots: 2 },
  { id: "blamed", category: "threatened", feelingSlots: 2, needSlots: 2 },

  // ── Persian-only ──────────────────────────────────────────────────────────
  //
  // Judgments Persian makes that English has no word for. See the note on
  // `LexiconConceptSpec.locales` for why these are scoped rather than paired
  // with invented English counterparts.
  //
  // Authored, not translated, and that was a research finding rather than an
  // assumption: the Persian NVC centre (زبان زندگی) publishes the real-feelings
  // list — met-need and unmet-need — but **no faux-feelings list**. Rosenberg's
  // chapter-4 table of "words that describe what we think others are doing to
  // us" has no published Persian counterpart, so there was nothing to translate
  // and the ids below are grounded in Persian usage instead.
  //
  // Each one is a *reading of what someone did* rather than a felt state, which
  // is the only test for admission here. Ordinary Persian feeling words —
  // «دلتنگ», «دلگیر» — are feelings and belong in the palette, not here.

  /** «بی‌معرفتی» — a friend failing the duty of معرفت. Reliance broken, not a promise. */
  { id: "fa_no_loyalty", category: "betrayed", feelingSlots: 2, needSlots: 2, locales: ["fa"] },

  /** «تحویل نگرفتن» — the active ritual of warm reception, withheld. */
  { id: "fa_not_received", category: "excluded", feelingSlots: 2, needSlots: 2, locales: ["fa"] },

  /** «غریبی کردن» — an intimate treating you as a stranger. Coldness, not distance. */
  { id: "fa_treated_as_stranger", category: "excluded", feelingSlots: 2, needSlots: 2, locales: ["fa"] },

  /** «آدم حساب نکردن» — not counted as a person. Standing, not one brushed-off remark. */
  { id: "fa_not_counted", category: "diminished", feelingSlots: 2, needSlots: 2, locales: ["fa"] },

  /** «ضایع شدن» — آبرو spilled in front of others. Public, which is what makes it its own thing. */
  { id: "fa_face_lost", category: "diminished", feelingSlots: 2, needSlots: 2, locales: ["fa"] },

  /** «منت گذاشتن» — a kindness weighed back at you, from مَن, a unit of weight. */
  { id: "fa_favour_held_over", category: "pressured", feelingSlots: 2, needSlots: 2, locales: ["fa"] },
];

export const SPEC: FeelingsNeedsSpec = {
  contentVersion: CONTENT_VERSION,
  locations: LOCATION_SPECS,
  textures: TEXTURE_SPECS,
  feelings: FEELING_SPECS,
  needs: NEED_SPECS,
  lexicon: LEXICON_SPECS,
};

/** All palette/lexicon ids, for the parity validator and quick membership checks. */
export const LOCATION_IDS = LOCATION_SPECS.map((l) => l.id);
export const TEXTURE_IDS = TEXTURE_SPECS.map((t) => t.id);
export const FEELING_IDS = FEELING_SPECS.map((f) => f.id);
export const NEED_IDS = NEED_SPECS.map((n) => n.id);
export const LEXICON_IDS = LEXICON_SPECS.map((l) => l.id);

export const LEXICON_CATEGORY_BY_ID = new Map(LEXICON_SPECS.map((l) => [l.id, l.category]));

/** Whether a concept is claimed by this locale. No `locales` means every locale. */
export function conceptAppliesTo(concept: LexiconConceptSpec, locale: Locale): boolean {
  return concept.locales === undefined || concept.locales.includes(locale);
}

/**
 * The concepts one locale is expected to realize.
 *
 * The single place the locale scoping is interpreted — the pack builder and the
 * parity tests both read it, so "what should this surface contain" has one
 * answer rather than two that can drift.
 */
export function lexiconForLocale(locale: Locale): LexiconConceptSpec[] {
  return LEXICON_SPECS.filter((c) => conceptAppliesTo(c, locale));
}
