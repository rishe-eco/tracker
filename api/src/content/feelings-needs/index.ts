/**
 * Feelings & Needs content registry.
 *
 * Mirrors the skills content registry: packs are keyed by `contentVersion`,
 * built once per (version, locale) and cached, never mutated in place. A user's
 * LoopState pins the version they started on, so a later content bump cannot
 * silently change the material under them.
 */

import { buildFeelingsNeedsPack, CONTENT_VERSION as V1 } from "./v1";
import type { FeelingsNeedsPack, Locale } from "./types";

/** The version a new user is enrolled on. */
export const CURRENT_VERSION = V1;

type Builder = (locale: Locale) => FeelingsNeedsPack;

/** Versions are never deleted — a user pinned to an old one must still be served. */
const VERSIONS: Record<string, Builder> = {
  [V1]: buildFeelingsNeedsPack,
};

const cache = new Map<string, FeelingsNeedsPack>();

export function getFeelingsNeedsPack(contentVersion: string, locale: Locale): FeelingsNeedsPack {
  const cacheKey = `${contentVersion}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const build = VERSIONS[contentVersion];
  if (!build) {
    throw new Error(
      `Unknown Feelings & Needs content version "${contentVersion}". Versions are never ` +
        `deleted — a user pinned to an old version must still finish on it.`
    );
  }
  const pack = build(locale);
  cache.set(cacheKey, pack);
  return pack;
}

export * from "./types";
export { DIALS } from "./dials";
