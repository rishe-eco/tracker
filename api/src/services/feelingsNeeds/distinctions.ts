/**
 * Feelings & Needs — the distinction catch (P5).
 *
 * Plan §4.3, §6. When the person names a faux-feeling — an evaluative word
 * wearing a feeling's clothes ("ignored", "let down") — the app gently offers
 * what might be underneath it: the feeling, and the need.
 *
 * This runs on an authored lexicon and nothing else. No model, no classifier,
 * no training data (plan §6) — the whole detector is the trigger list in the
 * content pack, which is why the module has no inference dependency at all.
 *
 * The mechanism constrains the design more than it might look:
 *
 * - **A catch, not a quiz.** Variation theory works because the contrast is
 *   drawn on the person's own material at the moment they produce it. A drill
 *   produces defensiveness and abstract, performative processing instead.
 * - **Distributed, not exhaustive.** Firing on every instance turns the catch
 *   into a spellchecker for feelings. The dials space the touches out.
 * - **Never before the loop is established.** B is a refinement on top of A,
 *   never the opening move — you cannot refine a distinction the person is not
 *   yet drawing.
 */

import type { PrismaClient } from "@prisma/client";
import {
  DIALS,
  renderCatch,
  type FeelingsNeedsPack,
} from "../../content/feelings-needs";

export type SurfacedCatch = {
  conceptId: string;
  line: string;
  feelingHints: string[];
  needHints: string[];
  feelingHintsLabel: string;
  needHintsLabel: string;
  dismiss: string;
  note: string;
};

/** Escape a trigger for use inside a RegExp. */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Combining marks: Arabic harakat, and anything NFC left decomposed. */
const COMBINING_MARKS = /\p{M}+/gu;

/**
 * Characters that are never correct Persian but are what an Arabic keyboard —
 * or a copy-paste — produces. Folding them is safe in a way that folding real
 * Persian letters is not.
 */
const ARABIC_FOLDS: Array<[RegExp, string]> = [
  [/[يى]/g, "ی"], // ي (Arabic yeh), ى (alef maksura) → ی
  [/ك/g, "ک"], //          ك (Arabic kaf)                  → ک
  [/[أإٱ]/g, "ا"], // أ إ ٱ                      → ا
  [/[ةۀ]/g, "ه"], //  ة (teh marbuta), ۀ              → ه
  [/ـ/g, ""], //                ـ (tatweel), decorative only
];

/**
 * Put a string into the one form the matcher compares in.
 *
 * Applied identically to the trigger and to what the person typed, so it can
 * only ever make matching more forgiving — never change which concept wins.
 *
 * Persian needs this and English does not, but there is one code path rather
 * than two: a matcher with a Persian branch is a matcher whose Persian branch
 * rots. Every step below is a no-op on English input.
 *
 * - **ZWNJ becomes a space.** U+200C joins the parts of a Persian compound
 *   (`نادیده‌گرفته`), and people type it, a space, or nothing, interchangeably.
 *   Collapsing it to a space makes the first two forms equal; where a word is
 *   commonly written solid, the surface lists that variant explicitly.
 * - **Diacritics go.** Harakat are optional in writing and almost never typed.
 * - **Arabic look-alikes fold** to their Persian letters (see above).
 *
 * What is deliberately *not* folded: آ → ا. Alef madda is a distinct Persian
 * letter, and folding it would silently merge words that differ only there.
 * The cost is that a trigger needing both spellings has to list both — a
 * problem that announces itself, unlike a wrong catch.
 */
export function normalizeForMatch(s: string): string {
  let out = s.normalize("NFC").toLowerCase();
  for (const [re, to] of ARABIC_FOLDS) out = out.replace(re, to);
  return out
    .replace(COMBINING_MARKS, "")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A letter-ish run, for the boundary lookarounds below.
 *
 * `\b` cannot be used here. It is defined against `\w` — ASCII letters, digits
 * and underscore — so in Persian *every* character is a non-word character and
 * `\bناديده\b` matches a boundary on both sides of nothing: the trigger never
 * fires. Unicode property escapes are the fix, and they also close a latent
 * English gap (`\bused\b` never fires in "used2", which it arguably should).
 *
 * Note what this does *not* do: build a class out of the Arabic block. That is
 * the trap `04-conventions.md` §7b records — U+0600–U+06FF contains ، ؛ ؟,
 * which would then read as letters and block a match on a phrase that ends in
 * ordinary punctuation.
 */
const LETTERISH = "[\\p{L}\\p{M}\\p{N}_]";

/** One compiled trigger, with the concept it belongs to and its sort weight. */
type CompiledTrigger = { conceptId: string; trigger: string; re: RegExp; weight: number };

/**
 * Compiled triggers, cached per pack. A pack is a module-level constant, so
 * this compiles once per locale for the life of the process instead of once per
 * committed feeling — which matters now that a second locale exists and the
 * Persian trigger list is the longer of the two.
 */
const COMPILED = new WeakMap<FeelingsNeedsPack, CompiledTrigger[]>();

function compile(pack: FeelingsNeedsPack): CompiledTrigger[] {
  const cached = COMPILED.get(pack);
  if (cached) return cached;

  const compiled: CompiledTrigger[] = [];
  for (const concept of pack.lexicon) {
    for (const trigger of concept.triggers) {
      const normalized = normalizeForMatch(trigger);
      if (!normalized) continue;
      compiled.push({
        conceptId: concept.id,
        trigger,
        weight: normalized.length,
        re: new RegExp(
          `(?<!${LETTERISH})${escapeRegExp(normalized)}(?!${LETTERISH})`,
          "u"
        ),
      });
    }
  }

  COMPILED.set(pack, compiled);
  return compiled;
}

/**
 * Find the faux-feeling in a named feeling, if there is one.
 *
 * The matching contract is documented on `LexiconConceptSurface` and enforced
 * here:
 *
 * - **Word boundaries**, so "used" does not fire inside "unused" and "judged"
 *   does not fire inside "prejudged". See `LETTERISH` for why not `\b`.
 * - **Longest match wins.** Triggers nest ("cheated" inside "cheated on"); the
 *   longer one is the more specific reading. A content test keeps nesting from
 *   ever crossing between two concepts, where this would be a silent misread.
 * - **Case-insensitive**, and insensitive to the Persian spelling variance
 *   `normalizeForMatch` folds away, because this runs on something a person
 *   typed.
 *
 * Callers must only pass the feeling field — the palette word chosen, or the
 * short phrase typed into the "other" escape. Several triggers are ordinary
 * words that are unambiguous as a named feeling and would over-fire in prose.
 */
export function detectFauxFeeling(
  pack: FeelingsNeedsPack,
  feeling: string | null | undefined
): { conceptId: string; trigger: string } | null {
  if (!feeling) return null;
  const text = normalizeForMatch(feeling);
  if (!text) return null;

  let best: CompiledTrigger | null = null;

  for (const candidate of compile(pack)) {
    if (!candidate.re.test(text)) continue;
    if (!best || candidate.weight > best.weight) best = candidate;
  }

  return best ? { conceptId: best.conceptId, trigger: best.trigger } : null;
}

/**
 * Whether a catch is allowed to fire for this person right now.
 *
 * Two gates, both dials:
 *
 * `minLoopsBeforeCatch` — the loop has to be established first. Catching a
 * faux-feeling in week one is refining something the person has not started
 * doing, and it lands as correction rather than contrast. Counted in completed
 * passes, since a pass is one loop.
 *
 * `catchCooldownPasses` — touches are distributed. Someone who habitually
 * reaches for "ignored" would otherwise meet the same card every single day,
 * which is the drill this is defined against.
 */
export async function catchAllowed(prisma: PrismaClient, userId: string): Promise<boolean> {
  const completedPasses = await prisma.loopEntry.count({
    where: { sitting: { userId, completedAt: { not: null } } },
  });
  if (completedPasses < DIALS.distinctions.minLoopsBeforeCatch) return false;

  const lastCaught = await prisma.loopEntry.findFirst({
    where: { sitting: { userId }, distinctionCaught: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastCaught) return true;

  const passesSince = await prisma.loopEntry.count({
    where: { sitting: { userId }, createdAt: { gt: lastCaught.createdAt } },
  });
  return passesSince >= DIALS.distinctions.catchCooldownPasses;
}

/** Assemble what the UI needs to show a catch. */
export function composeCatch(pack: FeelingsNeedsPack, conceptId: string): SurfacedCatch | null {
  const rendered = renderCatch(pack, conceptId);
  if (!rendered) return null;
  return {
    conceptId,
    line: rendered.line,
    feelingHints: rendered.feelingHints,
    needHints: rendered.needHints,
    feelingHintsLabel: pack.catch.feelingHintsLabel,
    needHintsLabel: pack.catch.needHintsLabel,
    dismiss: pack.catch.dismiss,
    note: pack.catch.note,
  };
}

/**
 * The whole decision for one committed feeling: is it a faux-feeling, is a
 * catch due, and what should be shown.
 *
 * Returns null far more often than not, which is the point.
 */
export async function maybeCatch(
  prisma: PrismaClient,
  userId: string,
  pack: FeelingsNeedsPack,
  feeling: string | null | undefined
): Promise<SurfacedCatch | null> {
  const hit = detectFauxFeeling(pack, feeling);
  if (!hit) return null;
  if (!(await catchAllowed(prisma, userId))) return null;
  return composeCatch(pack, hit.conceptId);
}
