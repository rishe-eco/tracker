/**
 * Deterministic decomposition detectors — D1 (whole-statement) and D4
 * (`doneWhen` boundedness). No model, no key, no network.
 *
 * Build plan §4.2, §4.3. Two rules make these safe to run on both locales,
 * where Clarity's detectors could not be:
 *
 * 1. **Word boundaries are not `\b`.** `\b` is defined against ASCII `\w`, so
 *    in Persian every character is a non-word character and a `\b…\b` pattern
 *    matches nothing — silently. This exact bug disabled the Feelings & Needs
 *    faux-feeling matcher for the whole locale (conventions §7). Every lexicon
 *    match here uses Unicode property escapes (`[\p{L}\p{M}\p{N}]` in
 *    lookarounds, `u` flag) instead.
 * 2. **A lexicon, not a parser.** Boundedness is a heuristic that must be
 *    conservative and legible, not a grammar — a per-locale word list is
 *    honest where a grammar would be a pretence.
 */

import type { Locale } from "../../../content/skills/decomposition/types";

export type DetectorLevel = 0 | 1 | 2;

// ─── D1: the whole-statement detector ──────────────────────────────────────

export type WholeStatementInput = {
  statement: string;
  doneWhen: string;
  /** The item's own prompt/scenario text, in the same locale — for the near-copy check. */
  itemPrompt: string;
  /** True if any `node_added` event exists before the `whole_stated` event. */
  pieceExistedFirst: boolean;
  locale: Locale;
};

export type D1Result = { level: DetectorLevel; evidence: string };

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

function tokenSet(text: string): Set<string> {
  return new Set((text.toLowerCase().match(WORD) ?? []).filter((t) => t.length > 1));
}

/** Jaccard overlap of the two token sets — a restated prompt looks like near-total overlap. */
function tokenOverlap(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const t of setA) if (setB.has(t)) shared++;
  return shared / new Set([...setA, ...setB]).size;
}

const NEAR_COPY_THRESHOLD = 0.6;

export function scoreWholeStatement(input: WholeStatementInput): D1Result {
  const statement = input.statement.trim();
  const doneWhen = input.doneWhen.trim();

  if (!statement || input.pieceExistedFirst) {
    return {
      level: 0,
      evidence: input.pieceExistedFirst
        ? "A piece was added before the whole was stated."
        : "No statement of the undivided problem.",
    };
  }

  const isNearCopy = tokenOverlap(statement, input.itemPrompt) >= NEAR_COPY_THRESHOLD;
  if (isNearCopy) {
    return { level: 1, evidence: "The statement closely restates the prompt rather than reframing it." };
  }

  const doneWhenBounded = doneWhen.length > 0 && isBounded(doneWhen, input.locale);
  if (!doneWhen) return { level: 1, evidence: "No done condition was given for the whole." };
  if (!doneWhenBounded) return { level: 1, evidence: "The done condition is present but not bounded — no date, count, or state-change verb." };

  return { level: 2, evidence: `Stated first, bounded: "${doneWhen}".` };
}

// ─── D4: `doneWhen` boundedness ────────────────────────────────────────────

/**
 * State-change verbs — conservative and legible, not exhaustive. A verb list
 * can only ever be wrong by being too narrow (a real bounded condition reads
 * as unbounded), never by asserting a false bound, which is the safer
 * direction for a detector that only ever *reports absence* (build plan §1.2:
 * no green "checkable" affirmation, this is what that rule protects).
 */
const EN_STATE_CHANGE_VERBS = [
  "booked", "cancelled", "canceled", "signed", "sent", "paid", "handed back", "confirmed",
  "submitted", "secured", "arrived", "returned", "published", "delivered", "installed",
  "renewed", "mailed", "filed", "packed", "listed", "registered",
];

const FA_STATE_CHANGE_VERBS = [
  "رزرو شد", "لغو شد", "امضا شد", "ارسال شد", "پرداخت شد", "تأیید شد", "تایید شد",
  "تحویل داده شد", "ثبت شد", "دریافت شد", "برگردانده شد", "منتشر شد", "تمدید شد",
  "نصب شد", "پست شد", "بسته‌بندی شد", "لیست شد", "جابه‌جا شد", "جابجا شد", "تمام شد",
];

/** Weekday or an explicit deadline preposition + date, e.g. "by the 12th", "before Friday". */
const EN_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const EN_DEADLINE_DATE = /\b(by|before|until|no later than)\s+(the\s+)?\d/iu;

/** Digits, or English number words attached to a countable noun. */
const EN_NUMERIC_BOUND = /\b\d+\b|\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+\p{L}+/iu;
/** Western digits only, per conventions §7d — this pack never emits Persian/Arabic-Indic numerals. */
const FA_NUMERIC_BOUND = /\d+/;

function hasWordFrom(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((phrase) => {
    // Build the lookaround from Unicode letter/mark/number classes, not `\b` —
    // `\b` matches nothing against Persian and, for a multi-word English phrase
    // like "handed back", would also fail at the internal space boundary.
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "iu");
    return pattern.test(lower);
  });
}

function isBounded(doneWhen: string, locale: Locale): boolean {
  if (locale === "fa") {
    if (hasWordFrom(doneWhen, FA_STATE_CHANGE_VERBS)) return true;
    if (FA_NUMERIC_BOUND.test(doneWhen)) return true;
    return false;
  }

  if (hasWordFrom(doneWhen, EN_STATE_CHANGE_VERBS)) return true;
  if (EN_NUMERIC_BOUND.test(doneWhen)) return true;
  if (hasWordFrom(doneWhen, EN_WEEKDAYS)) return true;
  if (EN_DEADLINE_DATE.test(doneWhen)) return true;
  return false;
}

export { isBounded };

export type LeafForD4 = {
  id: string;
  doneWhen: string;
  /** True if the key marks this leaf's matched piece as atomic and it was split (has children). */
  splitAnAtomicPiece: boolean;
};

/**
 * D4 on free-authored (breakdown/repair-fix) structures: every leaf needs a
 * bounded `doneWhen`, and nothing the key marks atomic may have been split.
 * Arrangement items are scored differently (`keyScoring.ts` — labels are
 * authored, so this reduces to "did they avoid the monolith/atomic decoys").
 */
export function scoreD4FreeAuthoring(leaves: LeafForD4[], locale: Locale): D1Result {
  let faults = 0;
  const findings: string[] = [];

  const unbounded = leaves.filter((l) => !isBounded(l.doneWhen, locale));
  if (unbounded.length > 0) {
    faults += unbounded.length >= 2 ? 2 : 1;
    findings.push(`${unbounded.length} leaf/leaves with no bounded done condition.`);
  }

  const shattered = leaves.filter((l) => l.splitAnAtomicPiece);
  if (shattered.length > 0) {
    faults += 1;
    findings.push(`${shattered.length} piece(s) split that the key marks atomic.`);
  }

  const level: DetectorLevel = faults === 0 ? 2 : faults === 1 ? 1 : 0;
  return { level, evidence: findings.length ? findings.join(" ") : "Every leaf has a bounded done condition." };
}
