import { describe, expect, it } from "vitest";
import { matchAnswer, normalizeAnswer } from "../services/skills/monitoring/answerMatch";

describe("normalizeAnswer", () => {
  it("collapses case, punctuation, and whitespace", () => {
    expect(normalizeAnswer("  Paris, France!  ")).toBe("paris france");
  });

  it("normalizes Persian text consistently (NFKC, no \\b assumption)", () => {
    expect(normalizeAnswer("پاریس، فرانسه")).toBe(normalizeAnswer("پاریس فرانسه"));
  });
});

describe("matchAnswer — no fuzzy matching (build plan §4.2)", () => {
  it("matches an exact variant regardless of case/punctuation", () => {
    expect(matchAnswer("PARIS!!", ["Paris", "City of Paris"])).toBe(true);
  });

  it("matches a Persian variant the same way", () => {
    expect(matchAnswer("پاریس", ["پاریس", "شهر پاریس"])).toBe(true);
  });

  it("rejects a close-but-wrong answer — no edit distance", () => {
    expect(matchAnswer("Pariz", ["Paris"])).toBe(false);
  });

  it("rejects an unrelated answer", () => {
    expect(matchAnswer("London", ["Paris", "City of Paris"])).toBe(false);
  });

  it("matches via requiredTokens when every token in a set is present", () => {
    expect(matchAnswer("it is roughly 300000 km per second", [], [["300000"]])).toBe(true);
  });

  it("does not match requiredTokens when a token is missing", () => {
    expect(matchAnswer("it is very fast", [], [["300000"]])).toBe(false);
  });

  it("tokenizes Persian script correctly (Unicode property escapes, not \\b)", () => {
    expect(matchAnswer("تقریبا 300000 کیلومتر بر ثانیه", [], [["300000"]])).toBe(true);
  });
});

describe("normalizeAnswer — Persian numerals and keyboard variants", () => {
  it("folds Persian-Indic digits to ASCII (NFKC does not)", () => {
    expect(normalizeAnswer("۱۰۰")).toBe("100");
    expect(normalizeAnswer("۳۰۰۰۰۰")).toBe("300000");
  });

  it("folds Arabic-Indic digits to ASCII", () => {
    expect(normalizeAnswer("١٠٠")).toBe("100");
  });

  it("unifies the Arabic and Persian forms of yeh and kaf", () => {
    expect(normalizeAnswer("رياضي")).toBe(normalizeAnswer("ریاضی"));
    expect(normalizeAnswer("كتاب")).toBe(normalizeAnswer("کتاب"));
  });

  it("drops harakat and tatweel", () => {
    expect(normalizeAnswer("كِتــاب")).toBe(normalizeAnswer("کتاب"));
  });
});

describe("matchAnswer — a Persian learner against a Latin-numeral key", () => {
  it("matches Persian numerals against an ASCII answer variant", () => {
    expect(matchAnswer("۱۰۰", ["100", "صد", "100 درجه"])).toBe(true);
    expect(matchAnswer("۱۰۰ درجه", ["100", "صد", "100 درجه"])).toBe(true);
  });

  it("matches Persian numerals against an ASCII requiredToken", () => {
    expect(matchAnswer("تقریبا ۳۰۰۰۰۰ کیلومتر بر ثانیه", [], [["300000"]])).toBe(true);
  });

  it("still rejects a wrong number written in Persian numerals", () => {
    expect(matchAnswer("۹۹", ["100"])).toBe(false);
  });
});
