/**
 * Reflect `v1`: assembles the locale-invariant spec with a locale surface
 * into a full pack. Mirrors `content/noticing/v1/index.ts`.
 */

import type { Locale, ReflectPack, ReflectSurface } from "../types";
import { CONTENT_VERSION, FAMILY_SPECS } from "./spec";
import { SURFACE_EN } from "./surface.en";
import { SURFACE_FA } from "./surface.fa";

const SURFACES: Partial<Record<Locale, ReflectSurface>> = {
  en: SURFACE_EN,
  fa: SURFACE_FA,
};

/** Build the pack for a locale. Throws on a missing surface rather than falling back. */
export function buildReflectPack(locale: Locale): ReflectPack {
  const surface = SURFACES[locale];
  if (!surface) {
    throw new Error(
      `No ${locale} surface for ${CONTENT_VERSION}. Author surface.${locale}.ts against ` +
        `the shared spec; falling back to another language would hand someone a ` +
        `recount in a language they are not recounting in.`
    );
  }

  const declared = new Set<string>(FAMILY_SPECS.map((f) => f.id));
  for (const { family } of surface.lexicon) {
    if (!declared.has(family)) {
      throw new Error(
        `Lexicon family "${family}" is realized in the ${locale} surface but not declared in ` +
          `the ${CONTENT_VERSION} spec.`
      );
    }
  }

  return { contentVersion: CONTENT_VERSION, locale, ...surface };
}

export { CONTENT_VERSION, SPEC } from "./spec";
