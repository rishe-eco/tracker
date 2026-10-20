import { describe, it, expect } from "vitest";
import {
  isProjectDone,
  isValidDateKey,
  rangesOverlap,
  validateRange,
  validateTitle,
} from "../services/focusPeriods";

describe("isValidDateKey", () => {
  it("accepts real calendar days", () => {
    expect(isValidDateKey("2026-10-20")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true); // leap year
  });

  it("refuses days that don't exist, and anything not YYYY-MM-DD", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2027-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("2026-00-10")).toBe(false);
    expect(isValidDateKey("2026-1-5")).toBe(false);
    expect(isValidDateKey("1405-05-24T00:00:00Z")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
    expect(isValidDateKey(20261020)).toBe(false);
  });
});

describe("validateRange", () => {
  it("allows a same-day range and a longer one", () => {
    expect(() => validateRange("2026-03-01", "2026-03-01")).not.toThrow();
    expect(() => validateRange("2026-03-01", "2026-03-14")).not.toThrow();
  });

  it("refuses an end before the start", () => {
    expect(() => validateRange("2026-03-02", "2026-03-01")).toThrow(
      "End date must be on or after the start date."
    );
  });

  it("refuses an invalid key on either side, naming it", () => {
    expect(() => validateRange("2026-02-30", "2026-03-01")).toThrow("Invalid date: 2026-02-30.");
    expect(() => validateRange("2026-03-01", "soon")).toThrow("Invalid date: soon.");
  });

  it("compares across month and year boundaries", () => {
    expect(() => validateRange("2025-12-31", "2026-01-01")).not.toThrow();
    expect(() => validateRange("2026-01-01", "2025-12-31")).toThrow();
  });
});

describe("rangesOverlap (inclusive on both ends)", () => {
  it("is true for a single shared day", () => {
    expect(rangesOverlap("2026-03-01", "2026-03-10", "2026-03-10", "2026-03-20")).toBe(true);
    expect(rangesOverlap("2026-03-10", "2026-03-20", "2026-03-01", "2026-03-10")).toBe(true);
  });

  it("is false the day after the end, or the day before the start", () => {
    expect(rangesOverlap("2026-03-01", "2026-03-10", "2026-03-11", "2026-03-20")).toBe(false);
    expect(rangesOverlap("2026-03-11", "2026-03-20", "2026-03-01", "2026-03-10")).toBe(false);
  });

  it("is true when one contains the other, and for identical ranges", () => {
    expect(rangesOverlap("2026-03-01", "2026-03-31", "2026-03-10", "2026-03-12")).toBe(true);
    expect(rangesOverlap("2026-03-10", "2026-03-12", "2026-03-01", "2026-03-31")).toBe(true);
    expect(rangesOverlap("2026-03-05", "2026-03-05", "2026-03-05", "2026-03-05")).toBe(true);
  });
});

describe("isProjectDone (mirrors getProjectStatus 'Done' in ProjectPreview.tsx)", () => {
  it("is false with no actions", () => {
    expect(isProjectDone([])).toBe(false);
  });

  it("is false while any action is undone", () => {
    expect(isProjectDone([{ done: true }, { done: false }])).toBe(false);
    expect(isProjectDone([{ done: false }])).toBe(false);
  });

  it("is true when there is at least one action and all are done", () => {
    expect(isProjectDone([{ done: true }])).toBe(true);
    expect(isProjectDone([{ done: true }, { done: true }])).toBe(true);
  });
});

describe("validateTitle", () => {
  it("trims, and keeps 1 to 120 characters", () => {
    expect(validateTitle("  Ship it  ")).toBe("Ship it");
    expect(validateTitle("a")).toBe("a");
    expect(validateTitle("a".repeat(120))).toHaveLength(120);
  });

  it("refuses blank and over-long titles", () => {
    expect(() => validateTitle("")).toThrow("Title is required.");
    expect(() => validateTitle("   ")).toThrow("Title is required.");
    expect(() => validateTitle("a".repeat(121))).toThrow("at most 120 characters");
  });
});
