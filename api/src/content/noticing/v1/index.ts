/**
 * Noticing `v1` — assembles the locale-invariant spec with a locale surface
 * into a full pack. Mirrors `content/feelings-needs/v1/index.ts`.
 */

import type { CatchLexiconSpec, CatchTypeId, Locale, NoticingPack, NoticingSurface } from "../types";
import { CATCH_SPECS, CONTENT_VERSION, SPEC } from "./spec";
import { SURFACE_EN } from "./surface.en";
import { SURFACE_FA } from "./surface.fa";

const SPEC_BY_TYPE = new Map<CatchTypeId, CatchLexiconSpec>(CATCH_SPECS.map((c) => [c.type, c]));

/**
 * Still typed as partial, now that both locales are here — the next locale
 * added to the `Locale` union lands in this map missing, and the guard below
 * turns that into a sentence saying what to do rather than an `undefined`
 * three frames deeper.
 */
const SURFACES: Partial<Record<Locale, NoticingSurface>> = {
  en: SURFACE_EN,
  fa: SURFACE_FA,
};

/** Build the pack for a locale. Throws on a missing surface rather than falling back. */
export function buildNoticingPack(locale: Locale): NoticingPack {
  const surface = SURFACES[locale];
  if (!surface) {
    throw new Error(
      `No ${locale} surface for ${CONTENT_VERSION}. Author surface.${locale}.ts against ` +
        `the shared spec — falling back to another language would hand someone a ` +
        `vocabulary exercise in a language they are not noticing in.`
    );
  }

  // Each catch type carries its hint-slot count and field contract through
  // from the spec, so locales stay structurally matched and phase 5's matcher
  // reads the contract from one place rather than reimplementing it.
  const catches = surface.catches.map((c) => {
    const spec = SPEC_BY_TYPE.get(c.type);
    if (!spec) {
      throw new Error(
        `Catch type "${c.type}" is realized in the ${locale} surface but not declared in ` +
          `the ${CONTENT_VERSION} spec. Every catch type must be declared in the spec.`
      );
    }
    return { ...c, hintSlots: spec.hintSlots, matchesFields: spec.matchesFields };
  });

  return {
    contentVersion: CONTENT_VERSION,
    locale,
    reviewStatus: surface.reviewStatus,
    places: surface.places,
    cues: surface.cues,
    needs: surface.needs,
    frame: surface.frame,
    loop: surface.loop,
    catches,
    catchCopy: surface.catchCopy,
    capacity: surface.capacity,
    graduation: surface.graduation,
    thirdPartyWarning: surface.thirdPartyWarning,
  };
}

export { CONTENT_VERSION, SPEC } from "./spec";
