/**
 * Noticing — the three in-context catches (N6, tier 3).
 *
 * Spec §4.4, build plan §5 phase 5, §8. Three authored lexicons, no model, no
 * classifier — the whole detector is the trigger list content/noticing/v1
 * already ships. Modeled on `feelingsNeeds/distinctions.ts` (word-boundary
 * matching, longest-match-wins, a catch that offers rather than corrects) —
 * read that file for the precedent; shares no code with it (build plan §3,
 * §4), because Noticing's contract differs in two structural ways:
 *
 * 1. **Three types, matched per field, never against `person`.**
 *    `matchesFields` on each catch's spec (`content/noticing/types.ts`) is
 *    the field contract, authored in phase 2 for this module to read rather
 *    than reimplement: `read` matches only `observation`; `strategy` matches
 *    `need` and `smallThing`; `protective` matches `smallThing` and
 *    `motiveNote`. `"person"` never appears in any of them — a fence, not an
 *    optimization, asserted directly in `noticingCatches.unit.test.ts` and
 *    never merely trusted from the docblock.
 *
 * 2. **The cooldown is per-type and day-based, kept in
 *    `NoticingState.lastCatchAt` rather than derived from prior entries**
 *    (build plan §6 delta 3). Two reasons recorded there, restated here
 *    because they decide where the write happens below:
 *    - The cooldown answers "how many days since this TYPE last touched
 *      someone", which a three-key JSON map answers directly; deriving it
 *      would mean a date-bounded join through sittings with per-row JSON
 *      parsing on every single evaluation.
 *    - **A catch that is surfaced and then declined is still a touch.**
 *      Declining happens entirely client-side (dismiss is a local UI action,
 *      never a mutation — same as Module 1's), so nothing server-side ever
 *      learns whether a surfaced catch was accepted or waved off. The only
 *      moment the server can act on is the surface itself, so `lastCatchAt`
 *      is written THEN, unconditionally — never on some later "accepted"
 *      signal that doesn't exist.
 *
 * `NoticingEntry.caughtTypes` is a different thing and must not be read as a
 * cooldown source: it is the one-catch-per-PASS gate (an entry that already
 * carries a catch never gets a second, on any field, ever) and the raw
 * material for spec §12's learning signal (whether `read` fires less over
 * time on the same person's text) — an entry-level fact, never aggregated,
 * never itself consulted to decide timing.
 */

import type { PrismaClient } from "@prisma/client";
import {
  DIALS,
  renderCatch,
  type CatchTypeId,
  type NoticingEntryField,
  type NoticingPack,
} from "../../content/noticing";

export type SurfacedCatch = {
  type: CatchTypeId;
  line: string;
  hints: string[];
  dismiss: string;
  note: string;
  routeTo?: string;
};

/** Escape a trigger for use inside a RegExp. */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Combining marks: Arabic harakat, and anything NFC left decomposed. */
const COMBINING_MARKS = /\p{M}+/gu;

/**
 * Characters that are never correct Persian but are what an Arabic keyboard —
 * or a copy-paste — produces. Folding them is safe in a way that folding
 * real Persian letters is not. Copied from `feelingsNeeds/distinctions.ts`'s
 * own table rather than imported (build plan §3, §4) — the prototype's
 * practice content is English-only (spec §2), but phase 2 authored the `fa`
 * catch lexicons as a structurally complete draft, and this matcher runs
 * against whatever locale pack the caller passes it.
 */
const ARABIC_FOLDS: Array<[RegExp, string]> = [
  [/[يى]/g, "ی"], // ي (Arabic yeh), ى (alef maksura) → ی
  [/ك/g, "ک"], //          ك (Arabic kaf)                  → ک
  [/[أإٱ]/g, "ا"], // أ إ ٱ                      → ا
  [/[ةۀ]/g, "ه"], //  ة (teh marbuta), ۀ              → ه
  [/ـ/g, ""], //                ـ (tatweel), decorative only
];

/** Put a string into the one form the matcher compares in. See the sibling function in `feelingsNeeds/distinctions.ts` for the full reasoning; identical logic, kept independent per build plan §3, §4. */
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
 * A letter-ish run, for the boundary lookarounds below. Not `\b`, which is
 * defined against `\w` (ASCII only) and never fires a boundary in Persian at
 * all — see `feelingsNeeds/distinctions.ts`'s own note on this; same fix,
 * same reason, kept as an independent copy.
 */
const LETTERISH = "[\\p{L}\\p{M}\\p{N}_]";

type CompiledTrigger = { match: string; hints: string[]; weight: number; re: RegExp };

/**
 * Compiled triggers, cached per pack and keyed by catch type. A pack is a
 * module-level constant (`content/noticing/index.ts`'s cache), so this
 * compiles once per (version, locale) for the process lifetime rather than
 * once per committed field.
 */
const COMPILED = new WeakMap<NoticingPack, Map<CatchTypeId, CompiledTrigger[]>>();

function compile(pack: NoticingPack): Map<CatchTypeId, CompiledTrigger[]> {
  const cached = COMPILED.get(pack);
  if (cached) return cached;

  const byType = new Map<CatchTypeId, CompiledTrigger[]>();
  for (const lexicon of pack.catches) {
    const compiled: CompiledTrigger[] = [];
    for (const trigger of lexicon.triggers) {
      const normalized = normalizeForMatch(trigger.match);
      if (!normalized) continue;
      compiled.push({
        match: trigger.match,
        hints: trigger.hints,
        weight: normalized.length,
        re: new RegExp(`(?<!${LETTERISH})${escapeRegExp(normalized)}(?!${LETTERISH})`, "u"),
      });
    }
    byType.set(lexicon.type, compiled);
  }

  COMPILED.set(pack, byType);
  return byType;
}

/**
 * Find the sharpest trigger of one catch TYPE in one field's text, if there
 * is one. Word boundaries so "used" does not fire inside "unused"; longest
 * match wins where triggers nest within the same type — `read`'s own list
 * has a real instance of this ("being dramatic" contains "dramatic"), which
 * is exactly the case this exists to get right rather than assume away.
 *
 * Callers must only ever pass a field this catch TYPE's `matchesFields`
 * actually claims — enforced by `maybeCatch` below, not by this function,
 * which has no way to know which field its caller is holding.
 */
export function detectCatch(pack: NoticingPack, type: CatchTypeId, text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = normalizeForMatch(text);
  if (!normalized) return null;

  const triggers = compile(pack).get(type) ?? [];
  let best: CompiledTrigger | null = null;
  for (const candidate of triggers) {
    if (!candidate.re.test(normalized)) continue;
    if (!best || candidate.weight > best.weight) best = candidate;
  }
  return best?.match ?? null;
}

/**
 * When two catch types both claim the same field (only `strategy` and
 * `protective` share one: `smallThing`), which gets first look if both
 * would fire on the same text. Protective first: it is the motive check
 * ("should", "guilty", "the least I can do"), and spec §5's own failure
 * modes (guilt accumulation, savior framing) are about acting from
 * obligation — surfacing that ahead of a strategy-to-need refinement means
 * the motive question is in front of the person before the concrete act
 * gets any further attention. `read` has no field overlap with the other
 * two (it is the only type that touches `observation`), so its position
 * here is a placeholder for completeness, not a live choice.
 */
const CATCH_PRIORITY: CatchTypeId[] = ["protective", "strategy", "read"];

function parseLastCatchAt(raw: string | null | undefined): Partial<Record<CatchTypeId, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseCaughtTypes(raw: string | null | undefined): CatchTypeId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Whether this catch TYPE is off cooldown right now — days since it was last SURFACED, not accepted. */
function offCooldown(lastCatchAt: Partial<Record<CatchTypeId, string>>, type: CatchTypeId): boolean {
  const last = lastCatchAt[type];
  if (!last) return true;
  const lastMs = new Date(last).getTime();
  if (Number.isNaN(lastMs)) return true; // corrupt data must not wedge the gate shut forever
  const days = (Date.now() - lastMs) / (1000 * 60 * 60 * 24);
  return days >= DIALS.catches.cooldownDays;
}

/**
 * Record that a catch was just SURFACED — the only write this module ever
 * makes to `lastCatchAt`, and it happens unconditionally at surface time
 * (see the file docblock on why acceptance can never be the trigger).
 * `caughtTypes` on the entry is a separate write for a separate job (the
 * one-per-pass gate and the learning signal) — both land in one transaction
 * so a crash between them can't leave the cooldown started but the pass not
 * marked, or the reverse.
 */
async function recordSurfaced(
  prisma: PrismaClient,
  userId: string,
  entryId: string,
  type: CatchTypeId,
  pack: NoticingPack,
  lastCatchAt: Partial<Record<CatchTypeId, string>>
) {
  const nextLastCatchAt = JSON.stringify({ ...lastCatchAt, [type]: new Date().toISOString() });
  await prisma.$transaction([
    prisma.noticingState.upsert({
      where: { userId },
      create: { userId, contentVersion: pack.contentVersion, lastCatchAt: nextLastCatchAt },
      update: { lastCatchAt: nextLastCatchAt },
    }),
    prisma.noticingEntry.update({
      where: { id: entryId },
      data: { caughtTypes: JSON.stringify([type]) },
    }),
  ]);
}

/**
 * The whole decision for one commit: given the field(s) just freshly
 * written, is a catch due, and which one.
 *
 * `changedFields` must carry only fields actually being committed THIS
 * call — never a blanket re-scan of the whole entry on every unrelated
 * field update. The catch fires at the moment a word is named (same timing
 * `feelingsNeeds/distinctions.ts` depends on), and re-scanning untouched
 * fields on every later step would both violate that timing and risk
 * re-surfacing the same trigger the person already saw and moved past.
 *
 * Returns null far more often than not — the whole point (three gates, all
 * of which usually say no): one per pass, one per sitting, and per-type
 * cooldown.
 */
export async function maybeCatch(
  prisma: PrismaClient,
  userId: string,
  pack: NoticingPack,
  entry: { id: string; sittingId: string; caughtTypes: string | null },
  changedFields: Partial<Record<NoticingEntryField, string | null>>
): Promise<SurfacedCatch | null> {
  // One per pass, permanently — a pass that already carries a catch does
  // not get a second one later, on a different field, in the same pass.
  if (parseCaughtTypes(entry.caughtTypes).length > 0) return null;

  const changedFieldSet = new Set(Object.keys(changedFields) as NoticingEntryField[]);
  if (changedFieldSet.size === 0) return null;

  // One per sitting (DIALS.catches.perSitting), across every pass in it —
  // checked before the more expensive matching below, since it is the
  // cheapest gate to fail on a sitting that has already had its one catch.
  const sittingCatches = await prisma.noticingEntry.count({
    where: { sittingId: entry.sittingId, caughtTypes: { not: null } },
  });
  if (sittingCatches >= DIALS.catches.perSitting) return null;

  const state = await prisma.noticingState.findUnique({ where: { userId }, select: { lastCatchAt: true } });
  const lastCatchAt = parseLastCatchAt(state?.lastCatchAt);

  for (const type of CATCH_PRIORITY) {
    const lexicon = pack.catches.find((c) => c.type === type);
    if (!lexicon) continue;

    // Only the fields THIS type's own contract claims, and only among the
    // ones just written. "person" can never appear in matchesFields (phase
    // 2's content suite and the phase-5 suite both hold this), so it is
    // never a candidate here regardless of what changedFields carries.
    const fields = lexicon.matchesFields.filter((f) => changedFieldSet.has(f));
    if (fields.length === 0) continue;

    let matched: string | null = null;
    for (const field of fields) {
      matched = detectCatch(pack, type, changedFields[field]);
      if (matched) break;
    }
    if (!matched) continue;

    if (!offCooldown(lastCatchAt, type)) continue;

    const rendered = renderCatch(pack, type, matched);
    if (!rendered) continue; // defensive only: type came from pack.catches itself

    await recordSurfaced(prisma, userId, entry.id, type, pack, lastCatchAt);
    return { type, line: rendered.line, hints: rendered.hints, dismiss: rendered.dismiss, note: rendered.note, routeTo: rendered.routeTo };
  }

  return null;
}
