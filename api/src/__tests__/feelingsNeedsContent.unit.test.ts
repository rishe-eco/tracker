/**
 * Feelings & Needs content invariants.
 *
 * The pack is authored by hand and read by code that assumes it is well-formed —
 * the loop looks palette ids up by id, the catch composes a line from a family
 * template, and the display dials assume the pools are at least as big as the
 * numbers in `dials.ts`. None of that is expressible in the type system, because
 * every one of these is a relationship *between* two hand-written files.
 *
 * These are the checks that would otherwise be run once, by hand, on the day the
 * content was written. The lexicon is 39 shared concepts plus 6 Persian-only
 * ones, across a few hundred triggers in two scripts; this is what keeps the next
 * one from quietly breaking any of them.
 *
 * **Every surface check runs against every registered locale.** That is the
 * point of the spec/surface split, and a suite that only checked English would
 * have let the Persian surface be structurally wrong while reporting green — the
 * one failure mode the split was supposed to make impossible.
 */

import { describe, expect, it } from "vitest";
import { DIALS } from "../content/feelings-needs/dials";
import {
  carryLabelOf,
  renderCatch,
  toPublicPack,
  type FeelingsNeedsSurface,
  type Locale,
} from "../content/feelings-needs/types";
import { buildFeelingsNeedsPack } from "../content/feelings-needs/v1";
import { LEXICON_SPECS, lexiconForLocale, SPEC } from "../content/feelings-needs/v1/spec";
import { SURFACE_EN } from "../content/feelings-needs/v1/surface.en";
import { SURFACE_FA } from "../content/feelings-needs/v1/surface.fa";
import { detectFauxFeeling } from "../services/feelingsNeeds/distinctions";

/**
 * Every locale the module ships words for. Adding a locale here is what makes
 * the rest of this file apply to it — so a new surface arrives with the whole
 * invariant suite already pointed at it, rather than a note to write tests.
 */
const SURFACES: Array<[Locale, FeelingsNeedsSurface]> = [
  ["en", SURFACE_EN],
  ["fa", SURFACE_FA],
];

const PALETTES = ["locations", "textures", "feelings", "needs"] as const;
const KINDS = [...PALETTES, "lexicon" as const];

/** Cross product, so `it.each` can name both the locale and the palette. */
const LOCALE_KINDS = SURFACES.flatMap(([locale, surface]) =>
  KINDS.map((kind) => ({ locale, surface, kind }))
);

/**
 * What a given locale is expected to realize for a given kind.
 *
 * Palettes are locale-invariant, so this is just the spec. The lexicon is the one
 * exception: a faux-feeling is a claim about words in a language, and some
 * concepts are scoped to the locales that actually make that judgment (see the
 * note on `LexiconConceptSpec.locales`). Read through `lexiconForLocale` rather
 * than reimplemented, so the tests and the pack builder cannot disagree about
 * what a surface owes.
 */
const expectedIds = (kind: (typeof KINDS)[number], locale: Locale): string[] =>
  kind === "lexicon"
    ? lexiconForLocale(locale).map((c) => c.id)
    : (SPEC[kind] as { id: string }[]).map((e) => e.id);

describe("spec ↔ surface parity", () => {
  it.each(LOCALE_KINDS)(
    "$locale/$kind: every spec id has a surface entry",
    ({ surface, kind, locale }) => {
      const surfaceIds = new Set((surface[kind] as { id: string }[]).map((e) => e.id));
      const missing = expectedIds(kind, locale).filter((id) => !surfaceIds.has(id));
      expect(missing).toEqual([]);
    }
  );

  it.each(LOCALE_KINDS)(
    "$locale/$kind: no surface entry is absent from spec",
    ({ surface, kind, locale }) => {
      const expected = new Set(expectedIds(kind, locale));
      const orphans = (surface[kind] as { id: string }[])
        .map((e) => e.id)
        .filter((id) => !expected.has(id));
      expect(orphans).toEqual([]);
    }
  );

  it("scopes a concept to a locale only when the other locale really lacks it", () => {
    // The guard on the exception. Locale scoping exists because Persian makes
    // judgments English has no word for — not as an escape hatch for a concept
    // that was awkward to translate. So: every scoped concept must be scoped to
    // a locale that actually realizes it, and English must not have quietly
    // acquired scoping (which would mean the exception had become the rule).
    const scoped = SPEC.lexicon.filter((c) => c.locales !== undefined);
    expect(scoped.length).toBeGreaterThan(0);
    for (const concept of scoped) {
      expect(concept.locales!.length).toBeGreaterThan(0);
      for (const locale of concept.locales!) {
        const surface = SURFACES.find(([l]) => l === locale)?.[1];
        expect(surface, `${concept.id} claims ${locale}, which has no surface`).toBeDefined();
        expect(surface!.lexicon.map((c) => c.id)).toContain(concept.id);
      }
    }
    expect(lexiconForLocale("en").every((c) => c.locales === undefined)).toBe(true);
  });

  it.each(KINDS)("%s: spec ids are unique", (kind) => {
    const ids = (SPEC[kind] as { id: string }[]).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SURFACES)("%s: every palette entry has a non-empty label", (_locale, surface) => {
    const blank = PALETTES.flatMap((k) => surface[k])
      .filter((e) => !e.label.trim())
      .map((e) => e.id);
    expect(blank).toEqual([]);
  });

  it.each(SURFACES)("%s: the two locales offer the same words per beat", (_locale, surface) => {
    // Not required by the code, but required for the locales to be comparable:
    // if the Persian frame offered a different six feelings, a difference in how
    // the frame lands would be unattributable — content or translation?
    expect(surface.frame.place.locationIds).toEqual(SURFACE_EN.frame.place.locationIds);
    expect(surface.frame.texture.textureIds).toEqual(SURFACE_EN.frame.texture.textureIds);
    expect(surface.frame.name.feelingIds).toEqual(SURFACE_EN.frame.name.feelingIds);
  });
});

describe("the lexicon (P5's whole detector)", () => {
  it.each(SURFACES)("%s: declares hint slots that match the hints authored", (_locale, surface) => {
    // The slot counts are what keep the locales structurally matched. They are
    // only worth anything if they are true in each one.
    const surfaceById = new Map(surface.lexicon.map((l) => [l.id, l]));
    const mismatched = LEXICON_SPECS.flatMap((c) => {
      const s = surfaceById.get(c.id);
      if (!s) return [];
      const problems: string[] = [];
      if (s.feelingHints.length !== c.feelingSlots) {
        problems.push(`${c.id}: ${c.feelingSlots} feeling slots vs ${s.feelingHints.length} hints`);
      }
      if (s.needHints.length !== c.needSlots) {
        problems.push(`${c.id}: ${c.needSlots} need slots vs ${s.needHints.length} hints`);
      }
      return problems;
    });
    expect(mismatched).toEqual([]);
  });

  it.each(SURFACES)("%s: assigns every concept to a family with catch copy", (_locale, surface) => {
    const families = new Set(surface.lexiconCategories.map((c) => c.id));
    const unhoused = LEXICON_SPECS.filter((c) => !families.has(c.category)).map((c) => c.id);
    expect(unhoused).toEqual([]);
  });

  it.each(SURFACES)("%s: gives every concept a trigger and a display word", (_locale, surface) => {
    const broken = surface.lexicon
      .filter((l) => l.triggers.length === 0 || !l.word.trim())
      .map((l) => l.id);
    expect(broken).toEqual([]);
  });

  it.each(SURFACES)("%s: never lets two concepts claim the same trigger", (_locale, surface) => {
    // An ambiguous trigger makes the catch nondeterministic: which reading the
    // person is offered would depend on authoring order.
    const owner = new Map<string, string>();
    const collisions: string[] = [];
    for (const l of surface.lexicon) {
      for (const t of l.triggers) {
        const prev = owner.get(t);
        if (prev) collisions.push(`"${t}" claimed by ${prev} and ${l.id}`);
        else owner.set(t, l.id);
      }
    }
    expect(collisions).toEqual([]);
  });

  it.each(SURFACES)("%s: every trigger resolves to its own concept", (locale, surface) => {
    // The invariant that matters, stated directly and checked with the real
    // matcher rather than a proxy for it: whatever else a trigger overlaps, a
    // person who types exactly that trigger gets the reading it belongs to.
    //
    // This replaces a blanket ban on triggers nesting across concepts. That ban
    // was free in English and wrong in Persian: «مجبورم» (feeling you have to)
    // nests inside «مجبورم کردند» (being made to), and those are two different
    // things that longest-match-wins separates correctly. Banning the overlap
    // would have cost the more common of the two its trigger.
    const pack = buildFeelingsNeedsPack(locale);
    const misread = surface.lexicon.flatMap((concept) =>
      concept.triggers
        .map((t) => ({ t, hit: detectFauxFeeling(pack, t) }))
        .filter(({ hit }) => hit?.conceptId !== concept.id)
        .map(({ t, hit }) => `"${t}" (${concept.id}) resolves to ${hit?.conceptId ?? "nothing"}`)
    );
    expect(misread).toEqual([]);
  });

  it.each(SURFACES)("%s: no palette word can ever trigger a catch", (locale, surface) => {
    // The catch fires on what the person names. If a word the app itself offered
    // could trigger one, the app would be correcting its own suggestion — which
    // reads as a trap rather than a distinction.
    const pack = buildFeelingsNeedsPack(locale);
    const caught = PALETTES.flatMap((k) => surface[k])
      .map((e) => ({ e, hit: detectFauxFeeling(pack, e.label) }))
      .filter(({ hit }) => hit !== null)
      .map(({ e, hit }) => `${e.id} ("${e.label}") fires ${hit!.conceptId}`);
    expect(caught).toEqual([]);
  });
});

describe("catch composition", () => {
  it.each(SURFACES)("%s: every family template carries {{word}}", (_locale, surface) => {
    const broken = surface.lexiconCategories
      .filter((c) => !c.catchTemplate.includes("{{word}}"))
      .map((c) => c.id);
    expect(broken).toEqual([]);
    expect(surface.catch.genericTemplate).toContain("{{word}}");
  });

  it.each(SURFACES)("%s: composes for every concept, no placeholder left", (locale, surface) => {
    const pack = buildFeelingsNeedsPack(locale);
    const unrendered = surface.lexicon
      .map((c) => ({ id: c.id, rendered: renderCatch(pack, c.id) }))
      .filter(({ rendered }) => rendered === null || rendered.line.includes("{{word}}"))
      .map(({ id }) => id);
    expect(unrendered).toEqual([]);
  });

  it.each(SURFACES)("%s: substitutes the concept's own word", (locale, surface) => {
    const pack = buildFeelingsNeedsPack(locale);
    const concept = surface.lexicon.find((c) => c.id === "taken_for_granted")!;
    const result = renderCatch(pack, "taken_for_granted");
    expect(result).not.toBeNull();
    expect(result!.line).toContain(concept.word);
    expect(result!.feelingHints).toHaveLength(2);
    expect(result!.needHints).toHaveLength(2);
  });

  it.each(SURFACES)("%s: offers hints as questions, never assertions", (_locale, surface) => {
    // A hint that asserted ("you're hurt") would substitute the app's taxonomy
    // for the person's own reading. Both locales mark the question the same way
    // structurally — «؟» is the Persian question mark, U+061F.
    const asserted = surface.lexicon
      .flatMap((c) => [...c.feelingHints, ...c.needHints])
      .filter((h) => !/[?؟]\s*$/.test(h));
    expect(asserted).toEqual([]);
  });

  it("returns null for a concept that does not exist", () => {
    expect(renderCatch(buildFeelingsNeedsPack("en"), "not-a-concept")).toBeNull();
  });
});

describe("the loop and frame copy", () => {
  it.each(SURFACES)("%s: carries the placeholders the wizard substitutes", (_locale, surface) => {
    expect(surface.loop.textureCarry).toContain("{{place}}");
    expect(surface.loop.nameCarry).toContain("{{texture}}");
    expect(surface.loop.needCarry).toContain("{{feeling}}");
  });

  it.each(SURFACES)("%s: every location has a carried form", (_locale, surface) => {
    // The carry template is bare — "{{place}} —" — so the preposition and (in
    // Persian) the possessive suffix come from the word itself. A location
    // without a carryLabel renders the chip label into a sentence that has no
    // preposition left, which is the bug this replaced: the template used to say
    // "in your {{place}} —", and `hard_to_place` turned that into "in your hard
    // to place —".
    const bare = surface.locations.filter((l) => !l.carryLabel?.trim()).map((l) => l.id);
    expect(bare).toEqual([]);
  });

  it.each(SURFACES)("%s: the carried sentence never reads as a fragment", (_locale, surface) => {
    // Weak by necessity — grammar is not checkable here — but it pins the one
    // case that actually broke: the carried form of "hard to place" must not be
    // the chip label, because the chip label is the thing that does not compose.
    const hardToPlace = surface.locations.find((l) => l.id === "hard_to_place")!;
    expect(carryLabelOf(hardToPlace)).not.toBe(hardToPlace.label);
  });

  it.each(SURFACES)("%s: references only palette ids that exist", (_locale, surface) => {
    const locations = new Set(SPEC.locations.map((l) => l.id));
    const textures = new Set(SPEC.textures.map((t) => t.id));
    const feelings = new Set(SPEC.feelings.map((f) => f.id));
    const dangling = [
      ...surface.frame.place.locationIds.filter((id) => !locations.has(id)),
      ...surface.frame.texture.textureIds.filter((id) => !textures.has(id)),
      ...surface.frame.name.feelingIds.filter((id) => !feelings.has(id)),
    ];
    expect(dangling).toEqual([]);
  });

  it.each(SURFACES)("%s: answers each beat's question from its own palette", (_locale, surface) => {
    // This is the bug this test exists for. The frame asked "Where does it sit
    // in your body?" and offered *texture* words — heavy, tight, hollow. Each
    // half was fine; together they were a question and an answer set about
    // different things, met at the moment the person is first asked to attend
    // inward. Drawing each beat's options from its own palette is what makes
    // that impossible to reintroduce.
    const locations = new Set(SPEC.locations.map((l) => l.id));
    const textures = new Set(SPEC.textures.map((t) => t.id));

    expect(surface.frame.place.locationIds.every((id) => locations.has(id))).toBe(true);
    expect(surface.frame.place.locationIds.some((id) => textures.has(id))).toBe(false);
    expect(surface.frame.texture.textureIds.every((id) => textures.has(id))).toBe(true);
    expect(surface.frame.texture.textureIds.some((id) => locations.has(id))).toBe(false);
  });

  it.each(SURFACES)("%s: offers a way to answer where without pinning a spot", (_l, surface) => {
    // P2's third failure mode: blankness at "where do you feel it" is
    // information, not failure. It needs a chip, not a skip.
    expect(surface.frame.place.locationIds).toContain("hard_to_place");
  });

  it.each(SURFACES)("%s: offers enough words that a first attempt lands one", (_l, surface) => {
    // P1 failure mode (b): an early loop that fails to land any word teaches
    // the opposite of what the frame is for.
    expect(surface.frame.name.feelingIds.length).toBeGreaterThanOrEqual(4);
    expect(surface.frame.place.locationIds.length).toBeGreaterThanOrEqual(4);
    expect(surface.frame.texture.textureIds.length).toBeGreaterThanOrEqual(4);
  });

  it.each(SURFACES)("%s: no copy anywhere asks why", (_locale, surface) => {
    // "Keep moving" (plan §10). The why-question is the rumination the loop is
    // built to route around, so it must not appear even once, in either
    // language. «چرا» is the Persian.
    const everyString = JSON.stringify(surface);
    expect(everyString).not.toMatch(/\bwhy\b/i);
    expect(everyString).not.toContain("چرا");
  });
});

describe("the Persian surface specifically", () => {
  const all = JSON.stringify(SURFACE_FA);

  it("is informal throughout — تو/کن, never شما/کنید", () => {
    // `04-conventions.md` §7b. Mixing registers is worse in Persian than in
    // English, and the app was formal until the 2026-08-01 revision (D-20). The
    // section also warns that no regex separates the imperative کنید from the
    // subjunctive کنی, so this checks only the unambiguously formal forms.
    const formal = ["شما", "کنید", "بکنید", "نکنید", "بگیرید", "ببینید", "بنویسید", "امتحان کنید"];
    expect(formal.filter((f) => all.includes(f))).toEqual([]);
  });

  it("keeps the need prompt conditional", () => {
    // "Offer, never force" is carried by one word in each language. A need the
    // person recites instead of recognizes is worse than no need at all, so the
    // «اگر» has to survive both the prompt and its withdrawn form (P7).
    expect(SURFACE_FA.loop.needPrompt).toContain("اگر");
    expect(SURFACE_FA.loop.needPromptTerse).toContain("اگر");
  });

  it("declares itself a draft rather than passing as reviewed", () => {
    // A draft locale is a known state, surfaced not hidden. The client shows a
    // banner off the back of this; flipping it to "reviewed" without a native
    // pass is what the banner exists to prevent.
    expect(SURFACE_FA.reviewStatus).toBe("draft");
  });

  it("uses one Persian word per concept", () => {
    // Rule 7c. The app once had three words for "action" across three files.
    // «نوبت» is a sitting and «حلقه» is the loop — matching what the client
    // already ships in locales/fa/common.json.
    expect(SURFACE_FA.loop.recapHeading).toContain("نوبت");
    expect(SURFACE_FA.loop.addAnotherCapped).toContain("نوبت");
    expect(SURFACE_FA.loop.done).toContain("حلقه");

    // «نشست» is the other candidate for "sitting", and must not appear as a
    // noun. Matched on word boundaries, not as a substring — a plain
    // `.includes` flags «نشسته» ("it sits") in the body prompt, which is the
    // verb and entirely correct. Same trap the matcher had to be fixed for, and
    // the one `04-conventions.md` §7b records.
    expect(all).not.toMatch(/(?<![\p{L}‌])نشست(?![\p{L}‌])/u);
  });

  it("keeps the texture palette bodily, not emotional", () => {
    // The trap the surface header warns about: Persian slides from sensation to
    // feeling readily («دلم گرفته» is both), and a feeling word in the texture
    // palette collapses the body step into naming the feeling twice — the one
    // thing P2 exists to prevent. Checked as a disjointness property, which is
    // what "two honest lists" reduces to.
    const feelings = new Set(SURFACE_FA.feelings.map((f) => f.label));
    const overlap = SURFACE_FA.textures.filter((t) => feelings.has(t.label)).map((t) => t.label);
    expect(overlap).toEqual([]);
  });

  it("writes no Arabic look-alikes that would need normalizing away", () => {
    // ي ك ة are Arabic letters that are never correct in Persian. The matcher
    // folds them so a person typing on an Arabic keyboard still gets a catch —
    // but the authored content itself should be clean, or the folding is load
    // bearing for our own text and a change to it would move our own triggers.
    expect(all).not.toMatch(/[يكةى]/);
  });
});

describe("dials agree with the authored content", () => {
  it.each([
    ["locations", DIALS.palette.locationPoolSize],
    ["textures", DIALS.palette.texturePoolSize],
    ["feelings", DIALS.palette.feelingPoolSize],
    ["needs", DIALS.palette.needPoolSize],
  ] as const)("%s pool matches its dial", (kind, expected) => {
    expect(SPEC[kind]).toHaveLength(expected);
  });

  it.each([
    ["locations", DIALS.palette.locationDisplayCount],
    ["textures", DIALS.palette.textureDisplayCount],
    ["feelings", DIALS.palette.feelingDisplayCount],
    ["needs", DIALS.palette.needDisplayCount],
  ] as const)("%s: cannot display more than the pool holds", (kind, shown) => {
    expect(shown).toBeLessThanOrEqual(SPEC[kind].length);
  });

  it("has enough early-tier feelings to fill a first screen", () => {
    // Otherwise broaden-tier words leak into loop 1 and the early-win weighting
    // that P1 depends on is silently gone.
    const early = SPEC.feelings.filter((f) => f.tier === "early");
    expect(early.length).toBeGreaterThanOrEqual(DIALS.palette.feelingDisplayCount);
  });

  it("weights the broaden tier wide enough to name hard states", () => {
    const broaden = SPEC.feelings.filter((f) => f.tier === "broaden").map((f) => f.id);
    // Not an arbitrary list: a palette that cannot name these is one that only
    // wants to hear mild things.
    expect(broaden).toEqual(expect.arrayContaining(["sad", "irritated", "anxious", "ashamed"]));
  });

  it("keeps the repeat soft-capped", () => {
    expect(DIALS.repeat.softCap).toBeGreaterThan(1);
    expect(DIALS.repeat.softCap).toBeLessThanOrEqual(4);
  });
});

describe("the client-safe projection", () => {
  it.each(SURFACES)("%s: withholds the lexicon and its catch copy", (locale) => {
    const publicPack = toPublicPack(buildFeelingsNeedsPack(locale)) as Record<string, unknown>;
    // The triggers are not a secret, but detection is a server concern and an
    // unused list in a browser bundle is a list that invites client-side
    // detection later.
    expect(publicPack.lexicon).toBeUndefined();
    expect(publicPack.lexiconCategories).toBeUndefined();
    expect(publicPack.catch).toBeUndefined();
  });

  it.each(SURFACES)("%s: still carries what the loop and frame render", (locale) => {
    const publicPack = toPublicPack(buildFeelingsNeedsPack(locale));
    expect(publicPack.locations.length).toBe(SPEC.locations.length);
    expect(publicPack.textures.length).toBe(SPEC.textures.length);
    expect(publicPack.loop.placePrompt).toBeTruthy();
    expect(publicPack.loop.texturePrompt).toBeTruthy();
    expect(publicPack.frame.payoff.line).toBeTruthy();
    expect(publicPack.graduation.line).toBeTruthy();
  });

  it.each(SURFACES)("%s: carries the tier weighting onto the feeling labels", (locale) => {
    const pack = buildFeelingsNeedsPack(locale);
    expect(pack.feelings.find((f) => f.id === "at_ease")?.tier).toBe("early");
    expect(pack.feelings.find((f) => f.id === "sad")?.tier).toBe("broaden");
  });
});

describe("locale handling", () => {
  it("serves each registered locale from its own surface", () => {
    // The check that the pack is not quietly falling back: the two locales must
    // return genuinely different words for the same id.
    const en = buildFeelingsNeedsPack("en");
    const fa = buildFeelingsNeedsPack("fa");
    expect(fa.locale).toBe("fa");
    expect(fa.locations.find((l) => l.id === "chest")!.label).not.toBe(
      en.locations.find((l) => l.id === "chest")!.label
    );
    expect(fa.loop.placePrompt).not.toBe(en.loop.placePrompt);
  });

  it("refuses a locale it has no surface for, rather than falling back", () => {
    // A silent fallback into another language is exactly the "bilingual label
    // over a monolingual product" failure the spec/surface split exists to
    // prevent. The guard has to stay real for the next locale added.
    expect(() => buildFeelingsNeedsPack("de" as Locale)).toThrow(/de surface/);
  });
});
