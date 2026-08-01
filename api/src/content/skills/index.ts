/**
 * Skill content registry.
 *
 * Packs are keyed by `contentVersion` and never mutated in place. A learner is
 * pinned to the version they started on (`SkillProfile.contentVersion`), so a
 * content bump mid-programme cannot silently change what their scores mean.
 */

import { EVIDENCE_VERSIONS } from "./versions";
import type { EvidencePack, Locale } from "./types";

const cache = new Map<string, EvidencePack>();

export function getEvidencePack(contentVersion: string, locale: Locale): EvidencePack {
  const cacheKey = `${contentVersion}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const version = EVIDENCE_VERSIONS[contentVersion];
  if (!version) {
    throw new Error(
      `Unknown skill content version "${contentVersion}". Versions are never deleted — ` +
        `a learner pinned to an old version must still be able to finish their programme.`
    );
  }
  const pack = version.build(locale);
  cache.set(cacheKey, pack);
  return pack;
}

export * from "./types";
export { CURRENT_VERSION, ENROLLABLE_EVIDENCE_VERSIONS, EVIDENCE_VERSIONS } from "./versions";
export { validateEvidenceContent, isServable, isProbeReady } from "./validate";
