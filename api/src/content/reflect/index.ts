/**
 * Reflect content registry.
 *
 * Mirrors `content/noticing/index.ts`: packs are keyed by `contentVersion`,
 * built once per (version, locale) and cached, never mutated in place. A
 * user's `ReflectState` pins the version they enrolled on, so a later content
 * bump cannot change the prompts or the lexicon under someone mid-practice.
 *
 * Unlike a lookup with a default, this refuses: an unknown version or an
 * unknown locale throws. Serving another language's prompts, or another
 * version's lexicon, is a silent wrong answer.
 */

import { buildReflectPack, CONTENT_VERSION as V1 } from "./v1";
import type { Locale, ReflectPack } from "./types";

/** The version a new user is enrolled on. */
export const CURRENT_VERSION = V1;

type Builder = (locale: Locale) => ReflectPack;

/** Versions are never deleted: a user pinned to an old one must still be served. */
const VERSIONS: Record<string, Builder> = {
  [V1]: buildReflectPack,
};

const LOCALES: readonly Locale[] = ["en", "fa"];

const cache = new Map<string, ReflectPack>();

export function getReflectPack(contentVersion: string, locale: Locale): ReflectPack {
  if (!LOCALES.includes(locale)) {
    throw new Error(`Unknown Reflect locale "${String(locale)}". There is no fallback to another language.`);
  }
  const cacheKey = `${contentVersion}:${locale}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const build = Object.prototype.hasOwnProperty.call(VERSIONS, contentVersion)
    ? VERSIONS[contentVersion]
    : undefined;
  if (!build) {
    throw new Error(
      `Unknown Reflect content version "${contentVersion}". Versions are never deleted ` +
        `so a user pinned to an old version must still be served.`
    );
  }
  const pack = build(locale);
  cache.set(cacheKey, pack);
  return pack;
}

export * from "./types";
export { DIALS } from "./dials";
