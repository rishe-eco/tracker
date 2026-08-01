/**
 * Content-version registry.
 *
 * Its own module because both the pack loader (`index.ts`) and the validator
 * need it, and the validator must be able to check *any* version rather than
 * whichever one happened to be current when it was written.
 *
 * Versions are never deleted. A learner pinned to an older version must still be
 * able to finish the programme, and any attempt already recorded against it must
 * still resolve its item — `SkillAttempt.contentVersion` is what that lookup
 * uses.
 */

import { buildEvidencePack as buildV1, ITEM_SPECS as SPECS_V1 } from "./evidence/v1";
import { buildEvidencePack as buildV2, ITEM_SPECS as SPECS_V2 } from "./evidence/v2";
import type { EvidenceItemSpec, EvidencePack, Locale, SkillKey } from "./types";

/** The version a new learner is enrolled on. */
export const CURRENT_VERSION: Record<SkillKey, string> = {
  evidence: "evidence/v2",
  // Clarity Lab is P1 — see 06-specs/00-skills-engine.md §14.
  clarity: "clarity/v1",
};

export type EvidenceVersion = {
  build: (locale: Locale) => EvidencePack;
  specs: EvidenceItemSpec[];
};

export const EVIDENCE_VERSIONS: Record<string, EvidenceVersion> = {
  "evidence/v1": { build: buildV1, specs: SPECS_V1 },
  "evidence/v2": { build: buildV2, specs: SPECS_V2 },
};

/**
 * Versions a learner may be *moved onto*. v1's items are software-specific and
 * were superseded for audience reasons, not corrected — nobody should be
 * enrolled on it again, but everyone already on it must still be served.
 */
export const ENROLLABLE_EVIDENCE_VERSIONS = ["evidence/v2"];
