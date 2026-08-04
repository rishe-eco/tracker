/**
 * The language of the person making the request.
 *
 * Read off `Accept-Language` and put on the GraphQL context, so a resolver that
 * serves authored content can serve it in the right language.
 *
 * **Why the header and not a column.** The authority on what language someone
 * wants is the app they are looking at — i18next owns that setting on the
 * client. A `locale` column beside it would be a second copy of a preference,
 * free to disagree with the first, and the disagreement would show up as a
 * person who switched the app to Persian and kept being handed English words.
 * Same rule as `LoopState`: prefer deriving from the authoritative record over
 * storing a summary of it (`01-data-model.md`).
 *
 * `Accept-Language` rather than a bespoke `X-Locale` because it is the standard
 * for exactly this, it is CORS-safelisted (so it needs no preflight and no CORS
 * config), and a personal-access-token caller that sends a real browser header
 * still gets a sensible answer out of it.
 *
 * Note the asymmetry this creates and does not resolve: the *UI* strings come
 * from the client bundle, the *content* strings come from the server. Both are
 * driven by the same setting, but they are two mechanisms, and a locale is only
 * fully present when both have it.
 */

/**
 * Locales the server can serve content in.
 *
 * Structurally identical to the `Locale` union in each content pack
 * (`content/feelings-needs/types.ts`, `content/skills/*`), which is what makes
 * the value assignable to them. Adding a locale means adding it here *and*
 * authoring the surface — this list is what the server admits to supporting,
 * not what it has words for.
 */
export const SUPPORTED_LOCALES = ["en", "fa"] as const;

export type RequestLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: RequestLocale = "en";

function isSupported(tag: string): tag is RequestLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag);
}

/**
 * Pick a locale from an `Accept-Language` value.
 *
 * Deliberately not full RFC 9110 quality-value negotiation. The client sends one
 * tag; everything else this sees is a browser default, where taking the tags in
 * the order given and returning the first one we support is both what q-values
 * would usually decide anyway and easy to be sure of. Region subtags are dropped
 * (`fa-IR` → `fa`) — the content is authored per language, not per region.
 *
 * Falls back to English rather than throwing. An unparseable header is not worth
 * failing a request over, and an unsupported language is a real state: someone
 * whose browser asks for German gets English, and finds out from the copy rather
 * than from an error.
 */
export function parseRequestLocale(header: unknown): RequestLocale {
  if (typeof header !== "string") return DEFAULT_LOCALE;

  for (const part of header.split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase();
    if (!tag || tag === "*") continue;
    const language = tag.split("-")[0]!;
    if (isSupported(language)) return language;
  }

  return DEFAULT_LOCALE;
}

/** Read the locale off an Express-shaped request. */
export function requestLocale(req: any): RequestLocale {
  return parseRequestLocale(req?.headers?.["accept-language"]);
}
