/**
 * Short-answer matching. Build plan §4.2 — "the file that fails silently."
 *
 * A wrong match does not error; it marks a correct answer wrong, which
 * inverts the learner's resolution score with no symptom. So: no fuzzy
 * matching, no edit distance, no embeddings, no model. False accepts are
 * worse than false rejects here, and all four produce them.
 *
 * Unmatched answers are scored incorrect and belong in a review queue (the
 * growth path for the variant set) — this file only owns the match itself;
 * the caller is responsible for queuing a miss for review.
 *
 * Persian: `\b` matches nothing in Persian script, so tokenization uses
 * Unicode property escapes (`[\p{L}\p{M}\p{N}]`, `u` flag) rather than `\w`.
 *
 * Persian, part two: NFKC does **not** fold Persian-Indic (U+06F0-U+06F9) or
 * Arabic-Indic (U+0660-U+0669) digits to ASCII, and it does not unify the
 * Arabic and Persian forms of kaf and yeh. Both are keyboard-layout
 * differences rather than meaning differences, so a Persian learner answering
 * a question with Persian numerals was scored wrong against a Latin-numeral
 * key, with no symptom -- exactly the silent inversion this file exists to
 * prevent. Folding them is safe in this file's own terms: neither fold can
 * turn two *different* answers into the same string, so neither can produce a
 * false accept.
 */

/** Persian-Indic (U+06F0-U+06F9) and Arabic-Indic (U+0660-U+0669) digits. */
const INDIC_DIGITS = /[\u06F0-\u06F9\u0660-\u0669]/g;

/** Arabic letter forms a Persian keyboard writes differently. Same letter. */
const LETTER_VARIANTS = /[\u064A\u0649\u0643]/g;
const LETTER_VARIANT_MAP: Record<string, string> = {
  "ي": "ی", // Arabic yeh -> Farsi yeh
  "ى": "ی", // alef maksura -> Farsi yeh
  "ك": "ک", // Arabic kaf -> keheh
};

/** Harakat and tatweel: decoration, never meaning, in the answers we accept. */
const ARABIC_MARKS = /[\u064B-\u065F\u0670\u0640]/g;

export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .replace(INDIC_DIGITS, (d) => String(d.codePointAt(0)! & 0x0f))
    .replace(LETTER_VARIANTS, (c) => LETTER_VARIANT_MAP[c] ?? c)
    .replace(ARABIC_MARKS, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): Set<string> {
  return new Set(normalized.split(/[^\p{L}\p{M}\p{N}]+/gu).filter(Boolean));
}

export function matchAnswer(answer: string, answerVariants: string[], requiredTokens?: string[][]): boolean {
  const normalized = normalizeAnswer(answer);
  if (answerVariants.some((v) => normalizeAnswer(v) === normalized)) return true;
  if (requiredTokens?.length) {
    const tokens = tokenize(normalized);
    return requiredTokens.some((set) => set.every((t) => tokens.has(normalizeAnswer(t))));
  }
  return false;
}
