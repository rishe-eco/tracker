/**
 * Feelings & Needs `v1` — assembles the locale-invariant spec with a locale
 * surface into a full pack. Mirrors the skills-engine `buildEvidencePack`.
 */

import type {
  FeelingsNeedsPack,
  FeelingsNeedsSurface,
  Locale,
  PaletteTier,
} from "../types";
import {
  CONTENT_VERSION,
  FEELING_SPECS,
  LEXICON_CATEGORY_BY_ID,
  lexiconForLocale,
  SPEC,
} from "./spec";
import { SURFACE_EN } from "./surface.en";
import { SURFACE_FA } from "./surface.fa";

const TIER_BY_FEELING_ID = new Map<string, PaletteTier | undefined>(
  FEELING_SPECS.map((f) => [f.id, f.tier])
);

/**
 * Still typed as partial, now that both locales are here.
 *
 * Not vestigial: the next locale added to the `Locale` union will land in this
 * map missing, and the guard below is what turns that into a sentence saying
 * what to do rather than an `undefined` three frames deeper. Keeping it means
 * the compiler cannot decide the error path is unreachable and stop typing it.
 */
const SURFACES: Partial<Record<Locale, FeelingsNeedsSurface>> = {
  en: SURFACE_EN,
  fa: SURFACE_FA,
};

/** Build the pack for a locale. Throws on a missing surface rather than falling back. */
export function buildFeelingsNeedsPack(locale: Locale): FeelingsNeedsPack {
  const surface = SURFACES[locale];
  if (!surface) {
    throw new Error(
      `No ${locale} surface for ${CONTENT_VERSION}. Author surface.${locale}.ts against ` +
        `the shared spec — falling back to another language would hand someone a ` +
        `vocabulary exercise in a language they are not feeling in.`
    );
  }

  // Feelings carry their tier weighting from the spec onto the surface labels.
  const feelings = surface.feelings.map((f) => ({ ...f, tier: TIER_BY_FEELING_ID.get(f.id) }));

  // Each concept carries its family through, so the catch line can be composed
  // without a second lookup at call time.
  //
  // Two failures are distinguished here, because they mean different things. A
  // concept absent from the spec is an authoring slip. A concept present in the
  // spec but not claimed by *this* locale is the locale scoping being ignored —
  // a Persian-only judgment realized in English, which would fire the catch on
  // a word no English speaker would type.
  const claimed = new Set(lexiconForLocale(locale).map((c) => c.id));
  const lexicon = surface.lexicon.map((c) => {
    const category = LEXICON_CATEGORY_BY_ID.get(c.id);
    if (!category) {
      throw new Error(
        `Lexicon concept "${c.id}" exists in the ${locale} surface but not in the ` +
          `${CONTENT_VERSION} spec. Every concept must be declared in the spec — ` +
          `that is what keeps the locales structurally matched.`
      );
    }
    if (!claimed.has(c.id)) {
      throw new Error(
        `Lexicon concept "${c.id}" is realized in the ${locale} surface but its spec ` +
          `entry does not list ${locale} in \`locales\`. Either add the locale to the ` +
          `spec (the judgment really is made in this language) or drop the surface ` +
          `entry — a concept one language does not have is not a gap to fill.`
      );
    }
    return { ...c, category };
  });

  return {
    contentVersion: CONTENT_VERSION,
    locale,
    reviewStatus: surface.reviewStatus,
    locations: surface.locations,
    textures: surface.textures,
    feelings,
    needs: surface.needs,
    frame: surface.frame,
    loop: surface.loop,
    catch: surface.catch,
    graduation: surface.graduation,
    lexiconCategories: surface.lexiconCategories,
    lexicon,
  };
}

export { CONTENT_VERSION, SPEC } from "./spec";
