/**
 * The distinction-catch matcher (P5).
 *
 * This function *is* the detector — there is no model behind it — so its edge
 * cases are the feature's edge cases. The matching contract it implements is
 * documented on `LexiconConceptSurface`; these are the tests that hold it to it.
 */

import { describe, expect, it } from "vitest";
import {
  composeCatch,
  detectFauxFeeling,
  normalizeForMatch,
} from "../services/feelingsNeeds/distinctions";
import { buildFeelingsNeedsPack } from "../content/feelings-needs/v1";
import { lexiconForLocale, SPEC } from "../content/feelings-needs/v1/spec";
import { SURFACE_EN } from "../content/feelings-needs/v1/surface.en";

const pack = buildFeelingsNeedsPack("en");
const detect = (text: string | null | undefined) => detectFauxFeeling(pack, text);

describe("what it catches", () => {
  it.each([
    ["ignored", "ignored"],
    ["let down", "let_down"],
    ["taken for granted", "taken_for_granted"],
    ["manipulated", "manipulated"],
    ["unappreciated", "unappreciated"],
  ])("catches %s", (text, conceptId) => {
    expect(detect(text)?.conceptId).toBe(conceptId);
  });

  it("catches regardless of case, because a person typed it", () => {
    expect(detect("Ignored")?.conceptId).toBe("ignored");
    expect(detect("LET DOWN")?.conceptId).toBe("let_down");
  });

  it("catches a trigger sitting inside a short phrase", () => {
    // The escape hatch takes a phrase, not just a word: "kind of dismissed".
    expect(detect("kind of dismissed")?.conceptId).toBe("dismissed");
    expect(detect("really let down by that")?.conceptId).toBe("let_down");
  });

  it("tolerates surrounding whitespace", () => {
    expect(detect("  ignored  ")?.conceptId).toBe("ignored");
  });
});

describe("what it leaves alone", () => {
  it("says nothing about a real feeling", () => {
    for (const id of ["calm", "uneasy", "grateful", "overwhelmed", "hurt"]) {
      expect(detect(id)).toBeNull();
    }
  });

  it("never fires on any word in the feeling palette", () => {
    // The palette is authored to hold real feelings only. If a faux-feeling
    // ever slipped into it, every palette pick would trigger a catch — the
    // drill this feature is defined against.
    const firing = SPEC.feelings
      .map((f) => SURFACE_EN.feelings.find((s) => s.id === f.id)!)
      .filter((f) => detect(f.label) !== null || detect(f.id) !== null)
      .map((f) => f.id);
    expect(firing).toEqual([]);
  });

  it("respects word boundaries rather than matching substrings", () => {
    // "used" is a trigger and an ordinary English word. Substring matching
    // would fire it inside "unused" and "confused".
    expect(detect("unused")).toBeNull();
    expect(detect("confused")).toBeNull();
    expect(detect("prejudged")).toBeNull();
    // But it must still catch the real thing.
    expect(detect("used")?.conceptId).toBe("used");
  });

  it("returns null for empty input", () => {
    expect(detect(null)).toBeNull();
    expect(detect(undefined)).toBeNull();
    expect(detect("")).toBeNull();
    expect(detect("   ")).toBeNull();
  });

  it("returns null for a word that is simply not in the lexicon", () => {
    expect(detect("wistful")).toBeNull();
  });
});

describe("when triggers overlap", () => {
  it("prefers the longest match", () => {
    // "cheated" nests inside "cheated on". The longer one is the more specific
    // reading, and picking by authoring order instead would be arbitrary.
    const hit = detect("cheated on");
    expect(hit?.trigger).toBe("cheated on");
    expect(hit?.conceptId).toBe("cheated");
  });

  it("still catches the shorter one on its own", () => {
    expect(detect("cheated")?.trigger).toBe("cheated");
  });
});

describe("the composed catch", () => {
  it("quotes the person's own word back and offers, never asserts", () => {
    const surfaced = composeCatch(pack, "ignored");
    expect(surfaced).not.toBeNull();
    expect(surfaced!.line).toContain("ignored");
    // Every hint is a question. An assertion would be the app substituting its
    // taxonomy for the person's reading — off-pillar by the decision test.
    expect(surfaced!.feelingHints.every((h) => h.endsWith("?"))).toBe(true);
    expect(surfaced!.needHints.every((h) => h.endsWith("?"))).toBe(true);
  });

  it("always carries a way to decline it", () => {
    const surfaced = composeCatch(pack, "ignored");
    expect(surfaced!.dismiss.trim()).not.toBe("");
  });

  it.each(["en", "fa"] as const)("composes for every concept %s realizes", (locale) => {
    // Scoped by locale, not the whole spec: since the Persian-only concepts were
    // added, "every concept in the lexicon" is a different set per language. The
    // English pack having no detector for «بی‌معرفتی» is the design, not a gap.
    const localePack = buildFeelingsNeedsPack(locale);
    const broken = lexiconForLocale(locale)
      .map((c) => ({ id: c.id, out: composeCatch(localePack, c.id) }))
      .filter(({ out }) => !out || !out.line || out.line.includes("{{"))
      .map(({ id }) => id);
    expect(broken).toEqual([]);
  });

  it("returns null for an unknown concept", () => {
    expect(composeCatch(pack, "nope")).toBeNull();
  });
});

// ─── Persian ─────────────────────────────────────────────────────────────────

/**
 * The matcher in Persian.
 *
 * These exist because the original matcher could not have worked here at all,
 * and would have failed silently: it bounded triggers with `\b`, which is
 * defined against ASCII `\w`, so in Persian every character is a non-word
 * character and no trigger could ever match. Nothing would have thrown — the
 * catch would simply never fire, in the one language where nobody testing in
 * English would notice.
 */
describe("the matcher in Persian", () => {
  const faPack = buildFeelingsNeedsPack("fa");
  const detectFa = (text: string | null | undefined) => detectFauxFeeling(faPack, text);

  it.each([
    ["نادیده گرفته شدم", "ignored"],
    ["قالم گذاشت", "let_down"],
    ["جدی گرفته نشدم", "dismissed"],
    ["تحقیر شدم", "put_down"],
    ["خیانت کرد", "betrayed"],
  ])("catches %s", (text, conceptId) => {
    expect(detectFa(text)?.conceptId).toBe(conceptId);
  });

  it("catches a trigger inside a short phrase, as the escape hatch allows", () => {
    expect(detectFa("یک جوری نادیده گرفته شدم")?.conceptId).toBe("ignored");
  });

  it("is not blocked by Persian punctuation sitting against the word", () => {
    // The trap `04-conventions.md` §7b records: a word-boundary class built from
    // the Arabic block would include ، ؛ ؟ (U+060C/061B/061F — all *below* the
    // first letter at U+0621), which would then read as letters and block the
    // match. Unicode letter properties do not have that hole.
    expect(detectFa("تهدید، و بعد سکوت")?.conceptId).toBe("threatened");
    expect(detectFa("قلدری؟")?.conceptId).toBe("bullied");
  });

  it("reads ZWNJ, a space and nothing as the same joiner", () => {
    // U+200C joins the parts of a Persian compound, and people type it, a
    // space, or neither, interchangeably. All three have to reach one concept or
    // the catch fires for some typists and not others.
    expect(detectFa("بی‌احترامی")?.conceptId).toBe("disrespected");
    expect(detectFa("بی احترامی")?.conceptId).toBe("disrespected");
  });

  it("folds the Arabic letters an Arabic keyboard produces", () => {
    // ي (U+064A) and ك (U+0643) are not Persian letters, but they are what a
    // great many keyboards and pasted strings contain. Someone typing on one is
    // not typing a different feeling.
    expect(detectFa("بازي داد")?.conceptId).toBe("manipulated");
    expect(detectFa("كوچكم كرد")?.conceptId).toBe("belittled");
  });

  it("ignores diacritics, which are optional in writing and rarely typed", () => {
    expect(detectFa("تَحقیر")?.conceptId).toBe("put_down");
  });

  it("still requires a boundary — a suffix is a different word", () => {
    // «آزار» is harassed. «آزارم داد» keeps the boundary and matches; but the
    // matcher must not fire on a longer word that merely starts the same way.
    expect(detectFa("آزار دیدم")?.conceptId).toBe("harassed");
    expect(detectFa("گزگز")).toBeNull();
  });

  it("prefers the more specific reading where two concepts nest", () => {
    // Longest-match doing semantic work rather than tie-breaking: feeling you
    // have to is a different state from being made to, and the two share a stem.
    expect(detectFa("مجبورم")?.conceptId).toBe("obligated");
    expect(detectFa("مجبورم کردند")?.conceptId).toBe("coerced");
  });

  it("stays quiet on a plain feeling, in either script", () => {
    // The catch is a distributed touch, not an annotation pass. A person naming
    // a feeling well must not be interrupted.
    expect(detectFa("غمگین")).toBeNull();
    expect(detectFa("خیلی بی‌رمق")).toBeNull();
    expect(detectFa("")).toBeNull();
  });

  it("does not leak across locales", () => {
    // An English trigger must not fire against the Persian pack, and vice versa.
    // They are separate detectors that happen to share a spec.
    expect(detectFa("ignored")).toBeNull();
    expect(detectFauxFeeling(pack, "نادیده گرفته شدم")).toBeNull();
  });
});

describe("normalizeForMatch", () => {
  it("leaves ordinary English alone apart from case", () => {
    expect(normalizeForMatch("Taken For Granted")).toBe("taken for granted");
  });

  it("collapses ZWNJ and runs of whitespace to one space", () => {
    expect(normalizeForMatch("بی‌احترامی")).toBe("بی احترامی");
    expect(normalizeForMatch("  دو   کلمه  ")).toBe("دو کلمه");
  });

  it("folds Arabic look-alikes to their Persian letters", () => {
    expect(normalizeForMatch("كي")).toBe("کی");
  });

  it("keeps آ distinct from ا", () => {
    // Deliberately not folded: alef madda is a separate Persian letter, and
    // folding it would silently merge words that differ only there. The cost is
    // that a trigger needing both spellings lists both — a problem that
    // announces itself, unlike a wrong catch.
    expect(normalizeForMatch("آزار")).not.toBe(normalizeForMatch("ازار"));
  });
});

/**
 * The six Persian-only concepts.
 *
 * These are the part of the lexicon with no English counterpart and no published
 * Persian source — authored from usage, because the Persian NVC centre publishes
 * a feelings list and not a faux-feelings one. So they get their own tests: what
 * each one catches, and — more importantly — that adding them did not blur the
 * concepts they sit next to.
 */
describe("Persian-only faux-feelings", () => {
  const faPack = buildFeelingsNeedsPack("fa");
  const detectFa = (text: string | null | undefined) => detectFauxFeeling(faPack, text);

  it.each([
    ["بی‌معرفتی کرد", "fa_no_loyalty"],
    ["تحویلم نگرفت", "fa_not_received"],
    ["غریبی کرد", "fa_treated_as_stranger"],
    ["آدم حسابم نکرد", "fa_not_counted"],
    ["جلوی همه ضایعم کرد", "fa_face_lost"],
    ["منت گذاشت", "fa_favour_held_over"],
  ])("catches %s", (text, conceptId) => {
    expect(detectFa(text)?.conceptId).toBe(conceptId);
  });

  it("keeps each one distinct from the English concept it sits nearest", () => {
    // The risk in adding these was not that they would fail to fire — it was
    // that they would swallow their neighbours. Each pair below is a distinction
    // the lexicon now has to hold:
    //
    //   بی‌معرفتی (a verdict on character) vs قال گذاشتن (a broken promise)
    //   تحویل نگرفتن (warmth withheld)     vs نادیده گرفتن (not noticed at all)
    //   آدم حساب نکردن (standing)          vs جدی نگرفتن (one remark brushed off)
    //   ضایع شدن (exposed in public)       vs تحقیر (what someone did to you)
    //   منت گذاشتن (a kindness weighed)    vs مجبور کردن (being made to)
    expect(detectFa("قالم گذاشت")?.conceptId).toBe("let_down");
    expect(detectFa("نادیده گرفته شدم")?.conceptId).toBe("ignored");
    expect(detectFa("جدی نگرفت")?.conceptId).toBe("dismissed");
    expect(detectFa("تحقیر شدم")?.conceptId).toBe("put_down");
    expect(detectFa("مجبورم کردند")?.conceptId).toBe("coerced");
  });

  it("reads سرکوفت as a favour held over, not as humiliation", () => {
    // This one was wrong before the Persian-only concepts existed: سرکوفت was a
    // `put_down` trigger, but a سرکوفت is specifically a past kindness or fault
    // thrown back at you — the منت move. The hints differ accordingly, and that
    // is the whole point of getting it right: put_down points at dignity,
    // fa_favour_held_over points at wanting the generosity to have been free.
    expect(detectFa("سرکوفت زد")?.conceptId).toBe("fa_favour_held_over");
    const surfaced = composeCatch(faPack, "fa_favour_held_over");
    expect(surfaced!.needHints.some((h) => h.includes("اختیار"))).toBe(true);
  });

  it("still leaves genuine Persian feeling words alone", () => {
    // The admission test cuts both ways. «دلتنگ» (missing someone) and «دلگیر»
    // (quietly hurt) look like they belong in a list of relationship complaints
    // and are in fact felt states — catching them would be the app telling
    // someone their feeling is a judgment.
    expect(detectFa("دلتنگ")).toBeNull();
    expect(detectFa("دلگیر")).toBeNull();
    expect(detectFa("دلم گرفته")).toBeNull();
  });

  it("does not exist in English", () => {
    // Locale scoping, from the matcher's side: the English pack has no detector
    // for these, because English has no word for them. A pack that had somehow
    // acquired one would mean the scoping was being ignored.
    const enConcepts = new Set(buildFeelingsNeedsPack("en").lexicon.map((c) => c.id));
    for (const id of [
      "fa_no_loyalty",
      "fa_not_received",
      "fa_treated_as_stranger",
      "fa_not_counted",
      "fa_face_lost",
      "fa_favour_held_over",
    ]) {
      expect(enConcepts.has(id)).toBe(false);
    }
  });
});
