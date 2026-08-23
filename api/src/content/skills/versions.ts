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
import { buildDecompositionPack, ITEM_SPECS as DECOMPOSITION_SPECS_V1 } from "./decomposition/v1";
import type { DecompositionItemSpec, DecompositionPack } from "./decomposition/types";
import { buildVerificationPack, ITEM_SPECS as VERIFICATION_SPECS_V1 } from "./verification/v1";
import type { VerificationItemSpec, VerificationPack } from "./verification/types";
import { buildDelegationPack, ITEM_SPECS as DELEGATION_SPECS_V1 } from "./delegation/v1";
import type { DelegationItemSpec, DelegationPack } from "./delegation/types";
import { buildMonitoringPack, ITEM_SPECS as MONITORING_SPECS_V1 } from "./monitoring/v1";
import type { MonitoringItemSpec, MonitoringPack } from "./monitoring/types";
import type { EvidenceItemSpec, EvidencePack, Locale, SkillKey } from "./types";

/** The version a new learner is enrolled on. */
export const CURRENT_VERSION: Record<SkillKey, string> = {
  evidence: "evidence/v2",
  // Clarity Lab is P1 — see 06-specs/00-skills-engine.md §14.
  clarity: "clarity/v1",
  decomposition: "decomposition/v1",
  verification: "verification/v1",
  delegation: "delegation/v1",
  monitoring: "monitoring/v1",
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

export type DecompositionVersion = {
  build: (locale: Locale) => DecompositionPack;
  specs: DecompositionItemSpec[];
};

export const DECOMPOSITION_VERSIONS: Record<string, DecompositionVersion> = {
  "decomposition/v1": { build: buildDecompositionPack, specs: DECOMPOSITION_SPECS_V1 },
};

export const ENROLLABLE_DECOMPOSITION_VERSIONS = ["decomposition/v1"];

export type VerificationVersion = {
  build: (locale: Locale) => VerificationPack;
  specs: VerificationItemSpec[];
};

export const VERIFICATION_VERSIONS: Record<string, VerificationVersion> = {
  "verification/v1": { build: buildVerificationPack, specs: VERIFICATION_SPECS_V1 },
};

export const ENROLLABLE_VERIFICATION_VERSIONS = ["verification/v1"];

export type DelegationVersion = {
  build: (locale: Locale) => DelegationPack;
  specs: DelegationItemSpec[];
};

export const DELEGATION_VERSIONS: Record<string, DelegationVersion> = {
  "delegation/v1": { build: buildDelegationPack, specs: DELEGATION_SPECS_V1 },
};

export const ENROLLABLE_DELEGATION_VERSIONS = ["delegation/v1"];

export type MonitoringVersion = {
  build: (locale: Locale) => MonitoringPack;
  specs: MonitoringItemSpec[];
};

export const MONITORING_VERSIONS: Record<string, MonitoringVersion> = {
  "monitoring/v1": { build: buildMonitoringPack, specs: MONITORING_SPECS_V1 },
};

export const ENROLLABLE_MONITORING_VERSIONS = ["monitoring/v1"];
