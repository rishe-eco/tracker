/**
 * Noticing content registry.
 *
 * Mirrors `content/feelings-needs/index.ts`: packs are keyed by
 * `contentVersion`, built once per (version, locale) and cached, never
 * mutated in place. A user's `NoticingState` pins the version they enrolled
 * on, so a later content bump cannot silently change the place/cue/need
 * vocabulary out from under someone mid-practice (build plan §3).
 */

import { buildNoticingPack, CONTENT_VERSION as V1 } from "./v1";
import type { Locale, NoticingPack } from "./types";

/** The version a new user is enrolled on. */
export const CURRENT_VERSION = V1;

type Builder = (locale: Locale) => NoticingPack;

/** Versions are never deleted — a user pinned to an old one must still be served. */
const VERSIONS: Record<string, Builder> = {
  [V1]: buildNoticingPack,
};

const cache = new Map<string, NoticingPack>();

export function getNoticingPack(contentVersion: string, locale: Locale): NoticingPack {
  const cacheKey = `${contentVersion}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const build = VERSIONS[contentVersion];
  if (!build) {
    throw new Error(
      `Unknown Noticing content version "${contentVersion}". Versions are never deleted ` +
        `— a user pinned to an old version must still finish on it.`
    );
  }
  const pack = build(locale);
  cache.set(cacheKey, pack);
  return pack;
}

export * from "./types";
export { DIALS } from "./dials";
