/** Evidence Lab `v2` — assembles locale-invariant specs with a locale surface. */

import type { EvidencePack, Locale } from "../../types";
import { CONTENT_VERSION, ITEM_SPECS, MODULE_ORDER } from "./spec";
import { ITEM_SURFACES_EN, MODULES_EN } from "./surface.en";
import { ITEM_SURFACES_FA, MODULES_FA } from "./surface.fa";

const SURFACES = {
  en: { items: ITEM_SURFACES_EN, modules: MODULES_EN, reviewStatus: "reviewed" as const },
  fa: { items: ITEM_SURFACES_FA, modules: MODULES_FA, reviewStatus: "draft" as const },
};

/**
 * Build the pack for a locale. Throws on a missing surface rather than falling
 * back: a silent English fallback inside a Persian session is exactly the
 * "bilingual label over a monolingual product" failure this design exists to
 * prevent. The validator catches it at build time; this is the last line.
 */
export function buildEvidencePack(locale: Locale): EvidencePack {
  const surface = SURFACES[locale];
  const surfaceById = new Map(surface.items.map((s) => [s.itemId, s]));

  const items = ITEM_SPECS.map((spec) => {
    const itemSurface = surfaceById.get(spec.itemId);
    if (!itemSurface) {
      throw new Error(
        `Missing ${locale} surface for item "${spec.itemId}" in ${CONTENT_VERSION}. ` +
          `Every itemId must exist in every locale — see content-pack parity in validate.ts.`
      );
    }
    return { ...spec, surface: itemSurface };
  });

  return {
    skillKey: "evidence",
    contentVersion: CONTENT_VERSION,
    locale,
    reviewStatus: surface.reviewStatus,
    modules: MODULE_ORDER.map((key) => {
      const mod = surface.modules.find((m) => m.moduleKey === key);
      if (!mod) throw new Error(`Missing ${locale} surface for module "${key}" in ${CONTENT_VERSION}.`);
      return mod;
    }),
    items,
  };
}

export { CONTENT_VERSION, ITEM_SPECS, ITEM_SPEC_BY_ID, MODULE_ORDER, EXPECTED_VERDICT } from "./spec";
