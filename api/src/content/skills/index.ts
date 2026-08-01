/**
 * Skill content registry.
 *
 * Packs are keyed by `contentVersion` and never mutated in place. A learner is
 * pinned to the version they started on (`SkillProfile.contentVersion`), so a
 * content bump mid-programme cannot silently change what their scores mean.
 */

import { buildEvidencePack, CONTENT_VERSION as EVIDENCE_V1 } from "./evidence/v1";
import type { EvidencePack, Locale, SkillKey } from "./types";

/** The version a new learner is enrolled on. */
export const CURRENT_VERSION: Record<SkillKey, string> = {
  evidence: EVIDENCE_V1,
  // Clarity Lab is P1 — see 06-specs/00-skills-engine.md §14.
  clarity: "clarity/v1",
};

const BUILDERS: Record<string, (locale: Locale) => EvidencePack> = {
  [EVIDENCE_V1]: buildEvidencePack,
};

const cache = new Map<string, EvidencePack>();

export function getEvidencePack(contentVersion: string, locale: Locale): EvidencePack {
  const cacheKey = `${contentVersion}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const build = BUILDERS[contentVersion];
  if (!build) {
    throw new Error(
      `Unknown skill content version "${contentVersion}". Versions are never deleted — ` +
        `a learner pinned to an old version must still be able to finish their programme.`
    );
  }
  const pack = build(locale);
  cache.set(cacheKey, pack);
  return pack;
}

export * from "./types";
export { validateEvidenceContent, isServable, isProbeReady } from "./validate";
