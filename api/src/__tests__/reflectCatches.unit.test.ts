/**
 * Reflect's interpretation matcher (B3; AC-31, AC-28).
 *
 * Pure: a pack and a story in, a word and a sentence out. The real draft `fa`
 * pack is used for the Persian cases; the nesting case uses a small fixture
 * pack, because neither v1 lexicon holds two triggers nested within one family.
 * The compiled cache is keyed per pack object, so a fixture is honest.
 */

import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, getReflectPack, type ReflectPack } from "../content/reflect";
import { detectInterpretation, normalizeForMatch } from "../services/reflect/catches";

const en = getReflectPack(CURRENT_VERSION, "en");
const fa = getReflectPack(CURRENT_VERSION, "fa");

function fixture(triggers: string[]): ReflectPack {
  return { ...en, lexicon: [{ family: "label", triggers }] };
}

describe("word boundaries (AC-31)", () => {
  it("never does not fire inside nevertheless", () => {
    expect(detectInterpretation(en, "It rained. Nevertheless we went out.")).toBeNull();
    expect(detectInterpretation(en, "She never called.")).toMatchObject({ word: "never" });
  });

  it("a trigger inside a longer word does not match, at either end", () => {
    expect(detectInterpretation(en, "The coldest morning.")).toBeNull();
    expect(detectInterpretation(en, "Her scold was loud.")).toBeNull();
    expect(detectInterpretation(en, "He was cold.")).toMatchObject({ word: "cold" });
  });

  it("an empty or missing story matches nothing", () => {
    expect(detectInterpretation(en, null)).toBeNull();
    expect(detectInterpretation(en, "")).toBeNull();
    expect(detectInterpretation(en, " . ! \n ")).toBeNull();
  });
});

describe("the longest trigger wins (AC-31)", () => {
  const nested = fixture(["dramatic", "being dramatic", "so dramatic"]);

  it("a nested trigger picks the longer one", () => {
    expect(detectInterpretation(nested, "She was being dramatic again.")).toEqual({
      word: "being dramatic",
      sentence: "She was being dramatic again",
    });
  });

  it("the longest across sentences wins, even from a later sentence", () => {
    const r = detectInterpretation(nested, "It was dramatic. Then she was being dramatic.");
    expect(r).toEqual({ word: "being dramatic", sentence: "Then she was being dramatic" });
  });

  it("on a tie the earlier sentence is returned", () => {
    const r = detectInterpretation(fixture(["rude", "lazy"]), "He was rude. He was lazy.");
    expect(r).toEqual({ word: "rude", sentence: "He was rude" });
  });

  it("a trigger that spans a sentence break does not match", () => {
    expect(detectInterpretation(en, "Nobody. Knew.")).toMatchObject({ word: "nobody" });
    expect(detectInterpretation(fixture(["on purpose"]), "He did it on. Purpose.")).toBeNull();
    expect(detectInterpretation(fixture(["on purpose"]), "He did it on\npurpose")).toBeNull();
  });
});

describe("sentences (D-13, PD-13)", () => {
  it("splits on . ! ? ؟ and line breaks, and returns the person's own words", () => {
    for (const [story, sentence] of [
      ["Fine! She is selfish? Yes.", "She is selfish"],
      ["Fine.\n  He is   LAZY  \nOk", "He is   LAZY"],
      ["اول. او خودخواه است؟ نه", "او خودخواه است"],
    ]) {
      expect(detectInterpretation(story.includes("اول") ? fa : en, story)?.sentence).toBe(sentence);
    }
  });

  it("the sentence is the original text, with combining marks before the trigger left alone", () => {
    const story = "We met at the café on Rue de Sèvres. The owner is selfish.";
    expect(detectInterpretation(en, story)).toEqual({ word: "selfish", sentence: "The owner is selfish" });
    const marked = "The café owner was Rude today.";
    const r = detectInterpretation(en, marked);
    expect(r).toEqual({ word: "rude", sentence: "The café owner was Rude today" });
  });

  it("the word is the lexicon's form, not the person's", () => {
    expect(detectInterpretation(en, "He IGNORED ME at lunch.")?.word).toBe("ignored me");
  });
});

describe("Persian (AC-31, against the draft fa lexicon)", () => {
  const word = (story: string) => detectInterpretation(fa, story)?.word;

  it("matches with a ZWNJ, with a space, and joined", () => {
    expect(word("او هیچ‌وقت نیامد.")).toBeTruthy();
    expect(word("او هیچ وقت نیامد.")).toBeTruthy();
    expect(word("او هیچوقت نیامد.")).toBeTruthy();
  });

  it("matches Arabic-keyboard letters against the Persian spelling", () => {
    // ي and ك in place of ی and ک.
    expect(word("او كنترل‌گر است.")).toBeTruthy();
    expect(word("هيچ‌كس نبود.")).toBeTruthy();
  });

  it("a Persian word boundary is not \\b", () => {
    expect(word("مغروری نکرد.")).toBeUndefined();
    expect(word("او مغرور بود.")).toBe("مغرور");
  });
});

describe("the fold", () => {
  it("normalizes case, Arabic letters, tatweel, combining marks, ZWNJ and whitespace", () => {
    expect(normalizeForMatch("  CAFE\n\tAU ")).toBe("cafe au");
    expect(normalizeForMatch("كَيْف")).toBe("کیف"); // the harakat are dropped
    expect(normalizeForMatch("كيف")).toBe("کیف");
    expect(normalizeForMatch("می‌خواست")).toBe("می خواست");
    expect(normalizeForMatch("جـمـله")).toBe("جمله");
  });
});
