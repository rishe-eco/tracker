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
