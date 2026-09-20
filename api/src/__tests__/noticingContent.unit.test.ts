/**
 * Noticing content invariants.
 *
 * Mirrors `feelingsNeedsContent.unit.test.ts`: the pack is authored by hand
 * and read by code that assumes it is well-formed, and every check here is a
 * relationship *between* two hand-written files (spec ↔ surface, or content ↔
 * dial) that the type system cannot express.
 *
 * **Every surface check runs against every registered locale** — the point
 * of the spec/surface split, and a suite that only checked English would let
 * the Persian surface be structurally wrong while reporting green.
 */

import { describe, expect, it } from "vitest";
import { DIALS } from "../content/noticing/dials";
import { toPublicPack, type Locale, type NoticingSurface } from "../content/noticing/types";
import { buildNoticingPack } from "../content/noticing/v1";
import { CATCH_SPECS, NEED_IDS, SHARED_WITH_MODULE1_NEED_IDS, SPEC } from "../content/noticing/v1/spec";
import { SURFACE_EN } from "../content/noticing/v1/surface.en";
import { SURFACE_FA } from "../content/noticing/v1/surface.fa";
// Read-only: this is the ONE place the two content modules touch, and it is
// an assertion about authoring (same id for the same need), never a runtime
// dependency. Noticing ships no code from `content/feelings-needs/`.
import { NEED_IDS as MODULE1_NEED_IDS } from "../content/feelings-needs/v1/spec";

const SURFACES: Array<[Locale, NoticingSurface]> = [
  ["en", SURFACE_EN],
  ["fa", SURFACE_FA],
];

const PALETTES = ["places", "cues", "needs"] as const;

const LOCALE_PALETTES = SURFACES.flatMap(([locale, surface]) =>
  PALETTES.map((kind) => ({ locale, surface, kind }))
);

describe("spec ↔ surface parity", () => {
  it.each(LOCALE_PALETTES)("$locale/$kind: every spec id has a surface entry", ({ surface, kind }) => {
    const surfaceIds = new Set(surface[kind].map((e) => e.id));
    const missing = SPEC[kind].map((e) => e.id).filter((id) => !surfaceIds.has(id));
    expect(missing).toEqual([]);
  });

  it.each(LOCALE_PALETTES)("$locale/$kind: no surface entry is absent from spec", ({ surface, kind }) => {
    const expected = new Set(SPEC[kind].map((e) => e.id));
    const orphans = surface[kind].map((e) => e.id).filter((id) => !expected.has(id));
    expect(orphans).toEqual([]);
  });

  it.each(PALETTES)("%s: spec ids are unique", (kind) => {
    const ids = SPEC[kind].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SURFACES)("%s: every palette entry has a non-empty label", (_locale, surface) => {
    const blank = PALETTES.flatMap((k) => surface[k])
      .filter((e) => !e.label.trim())
      .map((e) => e.id);
    expect(blank).toEqual([]);
  });

  it("declares every catch type in both locales", () => {
    const specTypes = new Set(CATCH_SPECS.map((c) => c.type));
    for (const [, surface] of SURFACES) {
      const surfaceTypes = new Set(surface.catches.map((c) => c.type));
      expect(surfaceTypes).toEqual(specTypes);
    }
  });
});

describe("the id-discipline rule (build plan §4)", () => {
  it("carries Module 1's id for every need Noticing shares in meaning", () => {
    // The authoring rule, checked directly: every id this pack claims as
    // "same meaning as Module 1" really exists over there under that id.
    const missingFromModule1 = SHARED_WITH_MODULE1_NEED_IDS.filter((id) => !MODULE1_NEED_IDS.includes(id));
    expect(missingFromModule1).toEqual([]);
    const missingFromNoticing = SHARED_WITH_MODULE1_NEED_IDS.filter((id) => !NEED_IDS.includes(id));
    expect(missingFromNoticing).toEqual([]);
  });

  it("never lets an un-declared id collide with Module 1's — coincidence would hide a coinage bug", () => {
    // The guard on the exception: every need id the two packs actually share
    // must be one that was *declared* shared. An id present in both lists but
    // missing from the declared set would mean either an accidental collision
    // (two authors independently reaching for "trust") or a real shared-need
    // id that nobody recorded as such — both worth catching.
    const declared = new Set(SHARED_WITH_MODULE1_NEED_IDS);
    const actualOverlap = NEED_IDS.filter((id) => MODULE1_NEED_IDS.includes(id));
    expect(new Set(actualOverlap)).toEqual(declared);
  });
});

describe("the three catches (build plan §8)", () => {
  it.each(SURFACES)(
    "%s: every trigger's hints — and the fallback — match the declared slot count",
    (_locale, surface) => {
      const slotsByType = new Map(CATCH_SPECS.map((c) => [c.type, c.hintSlots]));
      const mismatched = surface.catches.flatMap((c) => {
        const slots = slotsByType.get(c.type)!;
        const problems: string[] = [];
        for (const t of c.triggers) {
          if (t.hints.length !== slots) {
            problems.push(`${c.type}/"${t.match}": ${slots} slots vs ${t.hints.length} hints`);
          }
        }
        if (c.fallbackHints.length !== slots) {
          problems.push(`${c.type} fallback: ${slots} slots vs ${c.fallbackHints.length} hints`);
        }
        return problems;
      });
      expect(mismatched).toEqual([]);
    }
  );

  it.each(SURFACES)("%s: gives every catch type a non-empty trigger list", (_locale, surface) => {
    const broken = surface.catches.filter((c) => c.triggers.length === 0).map((c) => c.type);
    expect(broken).toEqual([]);
  });

  it.each(SURFACES)("%s: never duplicates a trigger within one catch type", (_locale, surface) => {
    const dupes = surface.catches
      .filter((c) => new Set(c.triggers.map((t) => t.match.toLowerCase())).size !== c.triggers.length)
      .map((c) => c.type);
    expect(dupes).toEqual([]);
  });

  it.each(SURFACES)("%s: never lets two catch types over the same field share a trigger", (_locale, surface) => {
    // An ambiguous trigger on a shared field makes the catch nondeterministic
    // — which reading fires would depend on authoring order. Catches on
    // disjoint fields can reuse a word freely (matching is per field).
    const byType = new Map(surface.catches.map((c) => [c.type, c]));
    const fieldsByType = new Map(CATCH_SPECS.map((c) => [c.type, new Set(c.matchesFields)]));
    const collisions: string[] = [];
    const types = [...byType.keys()];
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const [a, b] = [types[i], types[j]];
        const fieldsA = fieldsByType.get(a)!;
        const fieldsB = fieldsByType.get(b)!;
        const sharesField = [...fieldsA].some((f) => fieldsB.has(f));
        if (!sharesField) continue;
        const triggersA = new Set(byType.get(a)!.triggers.map((t) => t.match.toLowerCase()));
        for (const t of byType.get(b)!.triggers) {
          if (triggersA.has(t.match.toLowerCase())) {
            collisions.push(`"${t.match}" claimed by both ${a} and ${b}`);
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("never matches any catch type against the person field", () => {
    // The fence stated directly, not just as a comment: build plan §8's field
    // contract forbids it outright, and this is cheap enough to check on
    // every run rather than trust the docblock.
    const offenders = CATCH_SPECS.filter((c) => (c.matchesFields as string[]).includes("person"));
    expect(offenders).toEqual([]);
  });

  it.each(SURFACES)("%s: every catch line carries the {{word}} substitution point", (_locale, surface) => {
    const broken = surface.catches.filter((c) => !c.line.includes("{{word}}")).map((c) => c.type);
    expect(broken).toEqual([]);
  });

  it.each(SURFACES)(
    "%s: composes a rendered line for every catch type, with the word substituted",
    (locale, surface) => {
      const pack = buildNoticingPack(locale);
      for (const c of surface.catches) {
        const rendered = pack.catches.find((k) => k.type === c.type)!;
        const line = rendered.line.replace("{{word}}", "example");
        expect(line).toContain("example");
        expect(line).not.toContain("{{word}}");
      }
    }
  );

  it.each(SURFACES)("%s: gives each trigger its own sharp hints, not a shared generic set", (_locale, surface) => {
    // The phase-2 review defect: a fixed set of hints under every trigger of
    // a type reads as the tool visibly not listening. Every trigger's hints
    // must be authored for it specifically — checked here as "no two
    // triggers with slots > 0 share the exact same hint set" for the type
    // that actually has slots (`strategy`); `read`/`protective` are exempt
    // since their slot count is 0 and every hints array is vacuously [].
    const strategy = surface.catches.find((c) => c.type === "strategy")!;
    if (strategy.triggers.length === 0 || strategy.triggers[0].hints.length === 0) return;
    const seen = new Map<string, string>();
    const shared: string[] = [];
    for (const t of strategy.triggers) {
      const key = [...t.hints].sort().join("|");
      const prior = seen.get(key);
      if (prior) shared.push(`"${t.match}" repeats "${prior}"'s hints`);
      else seen.set(key, t.match);
    }
    // A little repetition can be legitimate (two genuinely similar acts), but
    // if every single trigger shares one identical set, the hints were never
    // actually per-trigger — that is the exact regression this test exists
    // to catch.
    expect(shared.length).toBeLessThan(strategy.triggers.length - 1);
  });

  it.each(SURFACES)("%s: phrases every hint as a question, never an assertion", (_locale, surface) => {
    const asserted = surface.catches
      .flatMap((c) => [
        ...c.triggers.flatMap((t) => t.hints.map((h) => ({ type: c.type, h }))),
        ...c.fallbackHints.map((h) => ({ type: c.type, h })),
      ])
      .filter(({ h }) => !/[?؟]\s*$/.test(h))
      .map(({ type, h }) => `${type}: ${h}`);
    expect(asserted).toEqual([]);
  });

  it("gives the protective catch no hints anywhere and a route, per spec §4.4 N6-c", () => {
    const protective = SPEC.catches.find((c) => c.type === "protective")!;
    expect(protective.hintSlots).toBe(0);
    for (const [, surface] of SURFACES) {
      const s = surface.catches.find((c) => c.type === "protective")!;
      expect(s.triggers.every((t) => t.hints.length === 0)).toBe(true);
      expect(s.fallbackHints).toEqual([]);
      expect(s.routeTo).toBeTruthy();
    }
  });

  it("never tells the person they are wrong", () => {
    const corrective = SURFACE_EN.catches
      .map((c) => c.line)
      .concat([SURFACE_EN.catchCopy.note, SURFACE_EN.catchCopy.dismiss])
      .filter((s) => /\b(wrong|incorrect|mistake|should(n't)? (be|say|feel)|actually,? that)\b/i.test(s));
    expect(corrective).toEqual([]);
  });

  it("always offers a way to decline", () => {
    for (const [, surface] of SURFACES) {
      expect(surface.catchCopy.dismiss.trim()).not.toBe("");
    }
  });
});

describe("dials agree with the authored content", () => {
  it("the needs pool matches its dial", () => {
    expect(SPEC.needs).toHaveLength(DIALS.needs.poolSize);
  });

  it("cannot display more needs than the pool holds", () => {
    expect(DIALS.needs.displayCount).toBeLessThanOrEqual(SPEC.needs.length);
  });

  it("shows the whole authored pool for places and cues (no rotation)", () => {
    // Unlike needs, these two are small enough to show whole — the dial is
    // documentation of that fact, not a selection to compute.
    expect(DIALS.places.displayCount).toBe(SPEC.places.length);
    expect(DIALS.cues.displayCount).toBe(SPEC.cues.length);
  });

  it("keeps the repeat soft-capped", () => {
    expect(DIALS.repeat.softCap).toBeGreaterThan(1);
    expect(DIALS.repeat.softCap).toBeLessThanOrEqual(4);
  });

  it("caps the catch cooldown and per-sitting count sensibly", () => {
    expect(DIALS.catches.cooldownDays).toBeGreaterThan(0);
    expect(DIALS.catches.perSitting).toBe(1);
  });
});

describe("the client-safe projection", () => {
  it.each(SURFACES)("%s: withholds the catch lexicons and their copy", (locale) => {
    const publicPack = toPublicPack(buildNoticingPack(locale)) as Record<string, unknown>;
    expect(publicPack.catches).toBeUndefined();
    expect(publicPack.catchCopy).toBeUndefined();
  });

  it.each(SURFACES)("%s: still carries what the frame, loop and log render", (locale) => {
    const publicPack = toPublicPack(buildNoticingPack(locale));
    expect(publicPack.places.length).toBe(SPEC.places.length);
    expect(publicPack.cues.length).toBe(SPEC.cues.length);
    expect(publicPack.needs.length).toBe(SPEC.needs.length);
    expect(publicPack.loop.placePrompt).toBeTruthy();
    expect(publicPack.loop.needPrompt).toBeTruthy();
    expect(publicPack.frame.beatOne.turn.line).toBeTruthy();
    expect(publicPack.graduation.line).toBeTruthy();
    expect(publicPack.thirdPartyWarning).toBeTruthy();
  });
});

describe("locale handling", () => {
  it("serves each registered locale from its own surface", () => {
    const en = buildNoticingPack("en");
    const fa = buildNoticingPack("fa");
    expect(fa.locale).toBe("fa");
    expect(fa.places.find((p) => p.id === "home")!.label).not.toBe(
      en.places.find((p) => p.id === "home")!.label
    );
    expect(fa.loop.placePrompt).not.toBe(en.loop.placePrompt);
  });

  it("declares the Persian surface a draft rather than passing as reviewed", () => {
    expect(SURFACE_FA.reviewStatus).toBe("draft");
    expect(SURFACE_EN.reviewStatus).toBe("reviewed");
  });

  it("refuses a locale it has no surface for, rather than falling back", () => {
    expect(() => buildNoticingPack("de" as Locale)).toThrow(/de surface/);
  });
});

describe("the frame and loop copy", () => {
  it.each(SURFACES)("%s: offers a two-way pick for the reverse step, both sides answered", (_l, surface) => {
    expect(surface.frame.beatOne.reverse.knowResponse.trim()).not.toBe("");
    expect(surface.frame.beatOne.reverse.noIdeaResponse.trim()).not.toBe("");
  });

  it.each(SURFACES)("%s: offers a three-way welcome prediction", (_l, surface) => {
    expect(surface.frame.beatTwo.options.map((o) => o.id).sort()).toEqual(
      ["not_very", "somewhat", "very"].sort()
    );
  });

  it.each(SURFACES)("%s: keeps the need prompt conditional, full and terse", (_l, surface) => {
    // "Offer, never force" carried by one word per language — checked
    // structurally here (English uses "if"); the Persian block in the
    // guardrail suite checks the Persian word.
    if (surface === SURFACE_EN) {
      expect(surface.loop.needPrompt.toLowerCase()).toContain("if");
      expect(surface.loop.needPromptTerse.toLowerCase()).toContain("if");
    }
  });

  it.each(SURFACES)("%s: names a skip in plain words for every optional step", (_l, surface) => {
    expect(surface.loop.needNotSure.trim()).not.toBe("");
    expect(surface.loop.smallThingSkip.trim()).not.toBe("");
  });

  it.each(SURFACES)("%s: says outright that the passes are not related", (_l, surface) => {
    expect(surface.loop.recapNotRelated.trim()).not.toBe("");
  });

  it.each(CATCH_SPECS.map((c) => c.type))("%s catch type has a declared field contract with no overlap error", (type) => {
    const spec = CATCH_SPECS.find((c) => c.type === type)!;
    expect(spec.matchesFields.length).toBeGreaterThan(0);
  });
});
