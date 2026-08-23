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
 */

export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFKC")
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
