/**
 * Localised criterion evidence.
 *
 * Every lab returns, per criterion, a short line saying *why* that level was
 * awarded. Persona review pass 3 (canon `05-reviews/01-six-lab-review-2026-08-24.md`,
 * blocker 2) found those lines hardcoded in English in four labs — so a
 * Persian learner read a wholly Persian screen whose only explanation of the
 * score was in English, and in Verification that English string was promoted
 * to the reveal headline.
 *
 * The fix keeps the wire format a plain `String!`: the server already knows
 * the request locale (D-22 — locale per request, never stored) and the
 * content packs are already per-locale, so the string is resolved server-side
 * exactly where the item surface is. No schema change, no client change.
 *
 * A table is authored content, not code, which is why the tables live in
 * `content/skills/<lab>/v1/evidence.ts` next to the surfaces they explain.
 */

import type { Locale } from "../../content/skills/types";

export type EvidenceVars = Record<string, string | number>;

/** Every key must be present in every locale — the `Record` makes that a type error to forget. */
export type EvidenceTable<K extends string> = Record<Locale, Record<K, string>>;

/** `{name}` placeholders. Unknown names are left as written rather than blanked. */
function interpolate(template: string, vars?: EvidenceVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

/**
 * Builds the `ev(locale, key, vars)` accessor for one lab's table.
 *
 * Falls back to `en` for a missing locale rather than throwing: an evidence
 * line is an explanation, and a wrong-language explanation beats a crash on
 * the reveal. A *missing key* cannot happen — `EvidenceTable` requires the
 * full key set per locale.
 */
export function makeEvidence<K extends string>(table: EvidenceTable<K>) {
  return function ev(locale: Locale, key: K, vars?: EvidenceVars): string {
    const perLocale = table[locale] ?? table.en;
    return interpolate(perLocale[key] ?? table.en[key], vars);
  };
}

/**
 * Picks between a singular and a plural key. English needs the distinction;
 * Persian does not agree a noun with a preceding number, so both `fa`
 * templates are simply written the same. Doing it as a key choice rather than
 * a string choice keeps every word a learner reads inside the content pack --
 * which is what stops the `(s)` artifacts pass 3 found in the surface copy
 * from reappearing on this path.
 */
export function pluralKey<K extends string>(n: number, one: K, other: K): K {
  return n === 1 ? one : other;
}
