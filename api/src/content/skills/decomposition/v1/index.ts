/** Decomposition Lab `v1` — assembles locale-invariant specs with a locale surface. */

import type { DecompositionPack, Locale } from "../types";
import { CONTENT_VERSION, ITEM_SPECS, MODULE_ORDER } from "./spec";
import { RUBRIC_VERSION } from "./rubric";
import { COSTUME_ASIDE_EN, ITEM_SURFACES_EN, MODULES_EN } from "./surface.en";
import { COSTUME_ASIDE_FA, ITEM_SURFACES_FA, MODULES_FA } from "./surface.fa";

const SURFACES = {
  en: { items: ITEM_SURFACES_EN, modules: MODULES_EN, aside: COSTUME_ASIDE_EN, reviewStatus: "reviewed" as const },
  fa: { items: ITEM_SURFACES_FA, modules: MODULES_FA, aside: COSTUME_ASIDE_FA, reviewStatus: "draft" as const },
};

export function buildDecompositionPack(locale: Locale): DecompositionPack {
  const surface = SURFACES[locale];
  const surfaceById = new Map(surface.items.map((s) => [s.itemId, s]));

  const items = ITEM_SPECS.map((spec) => {
    const itemSurface = surfaceById.get(spec.itemId);
    if (!itemSurface) {
      throw new Error(
        `Missing ${locale} surface for decomposition item "${spec.itemId}". Every itemId must exist in every locale.`
      );
    }
    return { ...spec, surface: itemSurface };
  });

  return {
    skillKey: "decomposition",
    contentVersion: CONTENT_VERSION,
    rubricVersion: RUBRIC_VERSION,
    locale,
    reviewStatus: surface.reviewStatus,
    modules: MODULE_ORDER.map((key) => {
      const mod = surface.modules.find((m) => m.moduleKey === key);
      if (!mod) throw new Error(`Missing ${locale} surface for decomposition module "${key}".`);
      return mod;
    }),
    items,
    costumeAside: surface.aside,
  };
}

export { CONTENT_VERSION, ITEM_SPECS, ITEM_SPEC_BY_ID, MODULE_ORDER } from "./spec";
export {
  RUBRIC,
  RUBRIC_VERSION,
  RUBRIC_MAX_TOTAL,
  CRITERION_BY_ID,
  RUBRIC_CRITERIA_BY_MODULE,
  OFFLINE_CRITERIA,
  JUDGE_ASSISTED_CRITERIA,
} from "./rubric";
