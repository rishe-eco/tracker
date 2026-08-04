/**
 * Picking a locale off `Accept-Language`.
 *
 * Small surface, but it is the whole path by which a Persian-speaking person
 * gets Persian content — and its failure mode is silent. A header that does not
 * parse falls back to English, which looks exactly like a working app to
 * everyone testing in English.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, parseRequestLocale, requestLocale } from "../graphql/requestLocale";

describe("parseRequestLocale", () => {
  it("takes a single tag the client sent", () => {
    expect(parseRequestLocale("fa")).toBe("fa");
    expect(parseRequestLocale("en")).toBe("en");
  });

  it("drops the region subtag", () => {
    // Content is authored per language, not per region: fa-IR and fa-AF read the
    // same words. Treating them as different locales would mean authoring twice
    // to say the same thing.
    expect(parseRequestLocale("fa-IR")).toBe("fa");
    expect(parseRequestLocale("en-GB")).toBe("en");
  });

  it("is case-insensitive, since the header is not normalised anywhere", () => {
    expect(parseRequestLocale("FA-ir")).toBe("fa");
  });

  it("takes the first supported tag out of a real browser header", () => {
    // A personal-access-token caller sends whatever its HTTP client sends. Order
    // is honoured rather than q-values parsed — for a list of two or three tags
    // those agree, and the simpler rule is the one that can be verified.
    expect(parseRequestLocale("fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("fa");
    expect(parseRequestLocale("de-DE,de;q=0.9,en;q=0.8")).toBe("en");
  });

  it("skips languages it has no words for rather than failing", () => {
    // Someone whose browser asks for German gets English and finds out from the
    // copy. An error would be a worse answer to a request that is perfectly fine.
    expect(parseRequestLocale("de")).toBe(DEFAULT_LOCALE);
    expect(parseRequestLocale("*")).toBe(DEFAULT_LOCALE);
    expect(parseRequestLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("falls back on anything that is not a string", () => {
    expect(parseRequestLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(parseRequestLocale(null)).toBe(DEFAULT_LOCALE);
    expect(parseRequestLocale(["fa"])).toBe(DEFAULT_LOCALE);
  });

  it("does not confuse a language whose name contains a supported tag", () => {
    // "fanti" starts with "fa". Splitting on "-" and comparing whole tags is
    // what keeps that from reading as Persian.
    expect(parseRequestLocale("fanti")).toBe(DEFAULT_LOCALE);
    expect(parseRequestLocale("enm")).toBe(DEFAULT_LOCALE);
  });
});

describe("requestLocale", () => {
  it("reads the lower-cased header key Express provides", () => {
    expect(requestLocale({ headers: { "accept-language": "fa" } })).toBe("fa");
  });

  it("survives a request with no headers at all", () => {
    expect(requestLocale({})).toBe(DEFAULT_LOCALE);
    expect(requestLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});
