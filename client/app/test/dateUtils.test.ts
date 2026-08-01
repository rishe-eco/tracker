import { describe, it, expect } from "vitest";
import { toLocalDateString, addDaysToDateKey, parseDateOnly } from "~/utils/dateUtils";

describe("toLocalDateString", () => {
  it("formats a date as YYYY-MM-DD using local timezone", () => {
    const d = new Date(2025, 2, 15); // March 15, 2025 (local)
    expect(toLocalDateString(d)).toBe("2025-03-15");
  });

  it("formats Jan 1 correctly", () => {
    const d = new Date(2025, 0, 1);
    expect(toLocalDateString(d)).toBe("2025-01-01");
  });
});

describe("addDaysToDateKey", () => {
  it("adds days within the same month", () => {
    expect(addDaysToDateKey("2025-06-10", 5)).toBe("2025-06-15");
  });

  it("crosses a month boundary", () => {
    expect(addDaysToDateKey("2025-01-30", 3)).toBe("2025-02-02");
  });

  it("crosses a year boundary", () => {
    expect(addDaysToDateKey("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("supports negative n", () => {
    expect(addDaysToDateKey("2025-06-10", -3)).toBe("2025-06-07");
  });

  it("adding 0 returns the same dateKey", () => {
    expect(addDaysToDateKey("2025-06-10", 0)).toBe("2025-06-10");
  });
});

describe("parseDateOnly", () => {
  it("parses an ISO UTC string and returns local midnight for that calendar day", () => {
    // "2025-03-15T00:00:00.000Z" → calendar day March 15 preserved
    const result = parseDateOnly("2025-03-15T00:00:00.000Z");
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2); // March = 2
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("parses a numeric timestamp", () => {
    const ts = new Date("2025-06-01T00:00:00.000Z").getTime();
    const result = parseDateOnly(ts);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5); // June = 5
    expect(result.getDate()).toBe(1);
  });

  it("parses a numeric timestamp as a string", () => {
    const ts = String(new Date("2025-06-01T00:00:00.000Z").getTime());
    const result = parseDateOnly(ts);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(1);
  });

  it("re-parsing an already-parsed Date preserves the local date", () => {
    const original = new Date(2025, 5, 1); // local June 1
    const result = parseDateOnly(original);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(0);
  });

  it("returns local midnight (hours=0) for any input", () => {
    const result = parseDateOnly("2025-09-20T15:30:00.000Z");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});
