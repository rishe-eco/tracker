import { describe, it, expect } from "vitest";
import { actionTagIdsMatchTheme } from "../services/timeThemes";

describe("actionTagIdsMatchTheme (time-themes.md §2 — surfacing overlap)", () => {
  it("is true when at least one tag overlaps", () => {
    expect(actionTagIdsMatchTheme(["a", "b"], ["b", "c"])).toBe(true);
  });

  it("is true for an exact single-tag match", () => {
    expect(actionTagIdsMatchTheme(["a"], ["a"])).toBe(true);
  });

  it("is false when there is no overlap", () => {
    expect(actionTagIdsMatchTheme(["a", "b"], ["c", "d"])).toBe(false);
  });

  it("is false when the action has no tags", () => {
    expect(actionTagIdsMatchTheme([], ["a"])).toBe(false);
  });

  it("is false when the theme has no tags", () => {
    expect(actionTagIdsMatchTheme(["a"], [])).toBe(false);
  });

  it("is false when both sides are empty", () => {
    expect(actionTagIdsMatchTheme([], [])).toBe(false);
  });

  it("never blocks — it is a pure predicate with no side effect on either list", () => {
    const actionTags = ["a"];
    const themeTags = ["b"];
    actionTagIdsMatchTheme(actionTags, themeTags);
    expect(actionTags).toEqual(["a"]);
    expect(themeTags).toEqual(["b"]);
  });
});
