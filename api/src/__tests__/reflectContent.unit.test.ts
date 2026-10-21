/**
 * Reflect content invariants (B1; AC-19, AC-28, AC-42).
 *
 * The pack is authored by hand in two languages and read by code that assumes
 * it is well-formed. Every check here is a relationship between two
 * hand-written files, or a refusal in the authoring, that the type system
 * cannot express.
 */

import { describe, expect, it } from "vitest";
import { DIALS } from "../content/reflect/dials";
import { CURRENT_VERSION, getReflectPack, type Locale, type ReflectSurface } from "../content/reflect";
import { FAMILY_SPECS } from "../content/reflect/v1/spec";
import { SURFACE_EN } from "../content/reflect/v1/surface.en";
import { SURFACE_FA } from "../content/reflect/v1/surface.fa";

const SURFACES: Array<[Locale, ReflectSurface]> = [
  ["en", SURFACE_EN],
  ["fa", SURFACE_FA],
];

/**
 * The matcher's fold, copied from `normalizeForMatch` and `ARABIC_FOLDS` in
 * `services/noticing/catches.ts`. Copied, never imported: Reflect's tests do
 * not depend on Noticing's service (build plan §0.3), and B3's matcher will be
 * its own copy of the same fold. If B3's fold changes, change this one.
 */
const ARABIC_FOLDS: Array<[RegExp, string]> = [
  [/[يى]/g, "ی"],
  [/ك/g, "ک"],
  [/[أإٱ]/g, "ا"],
  [/[ةۀ]/g, "ه"],
  [/ـ/g, ""],
];
function normalize(s: string): string {
  let out = s.normalize("NFC").toLowerCase();
  for (const [re, to] of ARABIC_FOLDS) out = out.replace(re, to);
  return out
    .replace(/\p{M}+/gu, "")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every leaf path of the surface, except the lexicon, with the string at it. */
function leaves(value: unknown, path = ""): Array<[string, unknown]> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [[path, value]];
}

function surfaceLeaves(surface: ReflectSurface): Array<[string, unknown]> {
  const { lexicon: _lexicon, ...rest } = surface;
  return leaves(rest);
}

function prompts(surface: ReflectSurface): Array<[string, string]> {
  return surfaceLeaves(surface).filter((l): l is [string, string] => typeof l[1] === "string");
}

describe("the pack's two surfaces (AC-42)", () => {
  it("every en key has a fa key, and the reverse", () => {
    const en = surfaceLeaves(SURFACE_EN).map(([k]) => k);
    const fa = surfaceLeaves(SURFACE_FA).map(([k]) => k);
    expect(en.filter((k) => !fa.includes(k))).toEqual([]);
    expect(fa.filter((k) => !en.includes(k))).toEqual([]);
  });

  it.each(SURFACES)("%s: every string is non-empty", (_locale, surface) => {
    const blank = prompts(surface)
      .filter(([, s]) => !s.trim())
      .map(([k]) => k);
    expect(blank).toEqual([]);
  });

  it("en ships reviewed and fa ships draft", () => {
    expect(SURFACE_EN.reviewStatus).toBe("reviewed");
    expect(SURFACE_FA.reviewStatus).toBe("draft");
  });

  it.each(SURFACES)("%s: the offer line has its {word} slot", (_locale, surface) => {
    expect(surface.interpretation.offerLine).toContain("{word}");
  });

  it.each(SURFACES)("%s: holds practice content only, not the interface strings of plan §6.5", (_locale, surface) => {
    // The soft-line and bound sentences are interface strings, keys in common.json (§6.5).
    expect(Object.keys(surface.story).sort()).toEqual(["scenePrompt", "scenePlaceholder", "storyPrompt"].sort());
  });

  it("en carries the labels the spec names (§4.5, §4.6; plates 3 to 7 agree)", () => {
    expect(SURFACE_EN.feelings).toMatchObject({
      whenLabel: "When",
      feelingLabel: "Feeling",
      needLabel: "Need",
      metLabel: "Met or unmet?",
      metOptions: { met: "Met", unmet: "Unmet", not_sure: "Not sure" },
    });
    expect(SURFACE_EN.reality).toMatchObject({
      readingLabel: "A reading in it",
      cameraLabel: "What a camera would have caught there",
    });
    expect(SURFACE_EN.interpretation).toMatchObject({ useLabel: "Use this", dismissLabel: "Not this one" });
  });
});

describe("no prompt asks why (AC-19)", () => {
  it.each(SURFACES)("%s: no string outside the lexicon holds a forbidden word", (locale, surface) => {
    const offenders = prompts(surface)
      .filter(([, s]) => {
        if (locale === "en") return /\bwhy\b/i.test(s) || /deepest/i.test(s);
        // Persian is checked on the normalized text, so a ZWNJ or a space between
        // the two halves of the second word fails the same way.
        const n = normalize(s);
        return n.includes("چرا") || /عمیق\s?ترین/.test(n);
      })
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it("the scan reaches the strings it is meant to (a guard on the guard)", () => {
    const keys = prompts(SURFACE_EN).map(([k]) => k);
    for (const expected of [
      "story.storyPrompt",
      "feelings.prompt",
      "reality.prompt",
      "close.prompt",
      "reality.readingLabel",
      "reality.cameraLabel",
      "interpretation.offerLine",
      "interpretation.useLabel",
      "interpretation.dismissLabel",
    ]) {
      expect(keys).toContain(expected);
    }
    expect(keys.some((k) => k.startsWith("lexicon"))).toBe(false);
  });
});

describe("the interpretation lexicon (AC-28)", () => {
  const families = FAMILY_SPECS.map((f) => f.id);

  it.each(SURFACES)("%s: realizes exactly the spec's four families", (_locale, surface) => {
    expect(surface.lexicon.map((l) => l.family).sort()).toEqual([...families].sort());
    expect(families).toHaveLength(4);
  });

  it.each(SURFACES.flatMap(([locale, surface]) => families.map((family) => ({ locale, surface, family }))))(
    "$locale/$family: at least 8 non-blank triggers",
    ({ surface, family }) => {
      const triggers = surface.lexicon.find((l) => l.family === family)!.triggers;
      expect(triggers.filter((t) => normalize(t)).length).toBeGreaterThanOrEqual(8);
      expect(triggers.every((t) => t.trim() === t && t.length > 0)).toBe(true);
    }
  );

  it.each(SURFACES)("%s: no trigger nests across two families", (_locale, surface) => {
    // After normalization, no trigger of one family equals, or appears inside, a
    // trigger of another. Within a family, duplicates are the variants.
    const all = surface.lexicon.flatMap((l) => l.triggers.map((t) => ({ family: l.family, t: normalize(t) })));
    const clashes: string[] = [];
    for (const a of all) {
      for (const b of all) {
        if (a.family === b.family) continue;
        if (a.t === b.t || a.t.includes(b.t)) clashes.push(`${a.family}:"${a.t}" vs ${b.family}:"${b.t}"`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("fa carries the joined spelling beside the ZWNJ one, which the fold does not cover", () => {
    const all = SURFACE_FA.lexicon.flatMap((l) => l.triggers);
    expect(all).toContain("می‌خواست");
    expect(all).toContain("میخواست");
    // The fold turns ZWNJ into a space, so the joined form is a different string.
    expect(normalize("می‌خواست")).not.toBe(normalize("میخواست"));
  });
});

describe("the registry", () => {
  it.each(["en", "fa"] as Locale[])("serves %s on the current version", (locale) => {
    const pack = getReflectPack(CURRENT_VERSION, locale);
    expect(pack.locale).toBe(locale);
    expect(pack.contentVersion).toBe("reflect/v1");
    expect(getReflectPack(CURRENT_VERSION, locale)).toBe(pack);
  });

  it("refuses an unknown version rather than falling back", () => {
    expect(() => getReflectPack("reflect/v0", "en")).toThrow(/Unknown Reflect content version/);
    expect(() => getReflectPack("toString", "en")).toThrow(/Unknown Reflect content version/);
  });

  it("refuses an unknown locale rather than falling back", () => {
    expect(() => getReflectPack(CURRENT_VERSION, "de" as Locale)).toThrow(/Unknown Reflect locale/);
  });
});

describe("the dials", () => {
  it("fix the bounds the plan names (§6.4, PD-7, PD-10)", () => {
    expect(DIALS.limits).toEqual({ scene: 140, story: 5000, whenText: 280, reading: 280, camera: 280, ownWord: 60, close: 1000 });
    expect(DIALS.momentsCap).toBe(3);
    expect(DIALS.readingsCap).toBe(3);
    expect(DIALS.storySoftLine).toBe(1500);
    expect(DIALS.practiceLocale).toBe("en");
    expect(DIALS.catches.interpretation.cooldownDays).toBe(2);
    expect(DIALS.catches.faux.cooldownDays).toBe(7);
  });
});
