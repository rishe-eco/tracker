/**
 * Reflect: the two catches (build plan §5 B3).
 *
 * 1. **The interpretation offer**, when the reality check opens: the person's
 *    own story is matched against an authored lexicon (four families, no model)
 *    and, on a hit, the lexicon's word and the person's own sentence go back.
 *    Nothing else of the lexicon leaves the server (PD-13, §6.5).
 * 2. **The faux-feeling offer**, when a committed feeling differs from the one
 *    stored: Feelings & Needs' own detector and copy, borrowed (D-7).
 *
 * Each is held to once per entry (`*SurfacedAt` on the entry) and to a cooldown
 * (`ReflectState.lastCatchAt`), and both are written when the offer is
 * SURFACED, not when it is taken: declining is client-side, so the surface is
 * the only moment the server can act on (the reasoning of `noticing/catches.ts`).
 *
 * **The matcher is a copy** of `noticing/catches.ts`, never an import (build
 * plan §0.3: Reflect shares no code with Noticing, and a fence holds that).
 * `ARABIC_FOLDS` and `normalizeForMatch` are byte-identical to it, and
 * `reflectContent.unit.test.ts` holds a THIRD copy to prove no trigger nests
 * across families: change all three together, or none.
 *
 * Never Feelings & Needs' whole-decision function or its allowance gate: they
 * count that pillar's loops and read its tables (D-7). Only `detectFauxFeeling`
 * and `composeCatch` are borrowed, and the import fence says so.
 */

import type { PrismaClient } from "@prisma/client";
import { DIALS, getReflectPack, type ReflectPack } from "../../content/reflect";
import { getFeelingsNeedsPack } from "../../content/feelings-needs";
import { composeCatch, detectFauxFeeling } from "../feelingsNeeds/distinctions";

// ─── The matcher (a copy; see the docblock) ──────────────────────────────────

/** Escape a trigger for use inside a RegExp. */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Combining marks: Arabic harakat, and anything NFC left decomposed. */
const COMBINING_MARKS = /\p{M}+/gu;

/**
 * Characters that are never correct Persian but are what an Arabic keyboard —
 * or a copy-paste — produces. Folding them is safe in a way that folding
 * real Persian letters is not.
 */
const ARABIC_FOLDS: Array<[RegExp, string]> = [
  [/[يى]/g, "ی"], // ي (Arabic yeh), ى (alef maksura) → ی
  [/ك/g, "ک"], //          ك (Arabic kaf)                  → ک
  [/[أإٱ]/g, "ا"], // أ إ ٱ                      → ا
  [/[ةۀ]/g, "ه"], //  ة (teh marbuta), ۀ              → ه
  [/ـ/g, ""], //                ـ (tatweel), decorative only
];

/**
 * A curly apostrophe (U+2019), what phone keyboards type, folds to the straight
 * one the lexicons are authored in, so `didn’t care` meets `didn't care`.
 */
const CURLY_APOSTROPHE = /’/g;

/** Put a string into the one form the matcher compares in. */
export function normalizeForMatch(s: string): string {
  let out = s.normalize("NFC").toLowerCase();
  for (const [re, to] of ARABIC_FOLDS) out = out.replace(re, to);
  return out
    .replace(CURLY_APOSTROPHE, "'")
    .replace(COMBINING_MARKS, "")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A letter-ish run for the boundary lookarounds. Not `\b`, which never fires in Persian. */
const LETTERISH = "[\\p{L}\\p{M}\\p{N}_]";

type CompiledTrigger = { match: string; weight: number; re: RegExp };

/** Compiled triggers, cached per pack object. Every family's triggers in one list: the offer names no family. */
const COMPILED = new WeakMap<ReflectPack, CompiledTrigger[]>();

function compile(pack: ReflectPack): CompiledTrigger[] {
  const cached = COMPILED.get(pack);
  if (cached) return cached;
  const compiled: CompiledTrigger[] = [];
  for (const family of pack.lexicon) {
    for (const match of family.triggers) {
      const normalized = normalizeForMatch(match);
      if (!normalized) continue;
      compiled.push({
        match,
        weight: normalized.length,
        re: new RegExp(`(?<!${LETTERISH})${escapeRegExp(normalized)}(?!${LETTERISH})`, "u"),
      });
    }
  }
  COMPILED.set(pack, compiled);
  return compiled;
}

/** Sentence ends: `.`, `!`, `?`, the Arabic question mark, and line breaks. */
const SENTENCE_END = /[.!?؟\r\n]+/;

/**
 * The first sentence of the person's story that holds the longest trigger, and
 * the trigger as the lexicon writes it (D-13, PD-13).
 *
 * The ORIGINAL story is split first, then each sentence normalized, so the
 * sentence returned is the person's own words (trimmed, terminator dropped,
 * nothing inside changed). A trigger that spans a sentence break doesn't match.
 * Longest wins across the whole story; on a tie the earlier sentence does.
 */
export function detectInterpretation(
  pack: ReflectPack,
  story: string | null | undefined
): { word: string; sentence: string } | null {
  if (!story) return null;
  const triggers = compile(pack);
  let best: { word: string; sentence: string; weight: number } | null = null;
  for (const raw of story.split(SENTENCE_END)) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const normalized = normalizeForMatch(sentence);
    if (!normalized) continue;
    for (const t of triggers) {
      if (!t.re.test(normalized)) continue;
      if (!best || t.weight > best.weight) best = { word: t.match, sentence, weight: t.weight };
    }
  }
  return best ? { word: best.word, sentence: best.sentence } : null;
}

// ─── The cooldown ────────────────────────────────────────────────────────────

type Kind = "interpretation" | "faux";
type LastCatchAt = Partial<Record<Kind, string>>;

/** Defensive, as Noticing's: a corrupt value reads as no cooldown. */
function parseLastCatchAt(raw: string | null | undefined): LastCatchAt {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function offCooldown(last: LastCatchAt, kind: Kind): boolean {
  const at = last[kind];
  if (typeof at !== "string") return true;
  const ms = new Date(at).getTime();
  if (Number.isNaN(ms)) return true;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24) >= DIALS.catches[kind].cooldownDays;
}

// ─── The two offers ──────────────────────────────────────────────────────────

type EntryRow = {
  id: string;
  story: string | null;
  fauxSurfacedAt: Date | null;
  interpretationSurfacedAt: Date | null;
};

/**
 * The interpretation offer for a forward move into the reality check, or null.
 * Writes, in one transaction, the entry's `interpretationSurfacedAt` and the
 * cooldown, only on a hit. The caller holds the user lock.
 */
export async function interpretationOfferFor(prisma: PrismaClient, userId: string, entry: EntryRow) {
  if (entry.interpretationSurfacedAt != null) return null;
  const state = await prisma.reflectState.findUnique({ where: { userId } });
  if (!state) return null;
  const last = parseLastCatchAt(state.lastCatchAt);
  if (!offCooldown(last, "interpretation")) return null;
  // Practice content, in the practice locale whatever the request's (PD-7, D-16).
  const pack = getReflectPack(state.contentVersion, DIALS.practiceLocale);
  const hit = detectInterpretation(pack, entry.story);
  if (!hit) return null;
  const now = new Date();
  await prisma.$transaction([
    prisma.reflectEntry.update({ where: { id: entry.id }, data: { interpretationSurfacedAt: now } }),
    prisma.reflectState.update({
      where: { userId },
      data: { lastCatchAt: JSON.stringify({ ...last, interpretation: now.toISOString() }) },
    }),
  ]);
  return { word: hit.word, sentence: hit.sentence };
}

/**
 * The faux-feeling offer for a feeling just committed, or null. The caller has
 * already decided the feeling differs from the stored one. Writes, in one
 * transaction, the entry's `fauxSurfacedAt` and the cooldown, only on an offer.
 */
export async function fauxOfferFor(
  prisma: PrismaClient,
  userId: string,
  entry: EntryRow,
  position: number,
  feeling: string
) {
  if (entry.fauxSurfacedAt != null) return null;
  const state = await prisma.reflectState.findUnique({ where: { userId } });
  if (!state) return null;
  const last = parseLastCatchAt(state.lastCatchAt);
  if (!offCooldown(last, "faux")) return null;
  // The pinned F&N version, from the row already read, in the practice locale (PD-7, D-16).
  const fnPack = getFeelingsNeedsPack(state.fnContentVersion, DIALS.practiceLocale);
  const hit = detectFauxFeeling(fnPack, feeling);
  if (!hit) return null;
  const composed = composeCatch(fnPack, hit.conceptId);
  if (!composed) return null;
  const now = new Date();
  await prisma.$transaction([
    prisma.reflectEntry.update({ where: { id: entry.id }, data: { fauxSurfacedAt: now } }),
    prisma.reflectState.update({
      where: { userId },
      data: { lastCatchAt: JSON.stringify({ ...last, faux: now.toISOString() }) },
    }),
  ]);
  return { position, ...composed };
}
