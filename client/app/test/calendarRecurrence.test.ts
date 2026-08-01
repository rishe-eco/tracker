import { describe, it, expect } from "vitest";
import {
  dateMatchesRepeatFromAnchor,
  intervalOccursOnDate,
  getIntervalOccurrenceTimes,
} from "~/components/calendar/useCalendarItems";

// Anchor: Monday 2025-01-06 UTC noon
const ANCHOR = new Date("2025-01-06T12:00:00.000Z");

function makeIv(overrides: Partial<{
  customRepeatDates: string[];
  customRepeatRule: string | null;
  repeatValue: number;
  repeatUnit: string | null;
  endTime: string | null;
  createdAt: string;
  predictedToDoTime: string | null;
}> = {}) {
  return {
    customRepeatDates: [] as string[],
    customRepeatRule: null as string | null,
    repeatValue: 1,
    repeatUnit: "day" as string | null,
    endTime: null as string | null,
    createdAt: "2025-01-06T12:00:00.000Z",
    predictedToDoTime: null as string | null,
    ...overrides,
  };
}

describe("dateMatchesRepeatFromAnchor", () => {
  it("matches anchor date itself (N=0)", () => {
    const date = new Date("2025-01-06T12:00:00.000Z");
    expect(dateMatchesRepeatFromAnchor(ANCHOR, date, 1, "day")).toBe(true);
  });

  it("matches every day with repeatValue=1, unit=day", () => {
    const day2 = new Date("2025-01-07T12:00:00.000Z");
    expect(dateMatchesRepeatFromAnchor(ANCHOR, day2, 1, "day")).toBe(true);
  });

  it("skips off-cycle days with repeatValue=2", () => {
    const day1 = new Date("2025-01-07T12:00:00.000Z"); // +1 day (odd)
    const day2 = new Date("2025-01-08T12:00:00.000Z"); // +2 days (even ✓)
    expect(dateMatchesRepeatFromAnchor(ANCHOR, day1, 2, "day")).toBe(false);
    expect(dateMatchesRepeatFromAnchor(ANCHOR, day2, 2, "day")).toBe(true);
  });

  it("matches every 7 days for unit=week", () => {
    const week1 = new Date("2025-01-13T12:00:00.000Z"); // +7
    const week2 = new Date("2025-01-20T12:00:00.000Z"); // +14
    expect(dateMatchesRepeatFromAnchor(ANCHOR, week1, 1, "week")).toBe(true);
    expect(dateMatchesRepeatFromAnchor(ANCHOR, week2, 1, "week")).toBe(true);
  });

  it("fails on non-week-multiple days for unit=week", () => {
    const day8 = new Date("2025-01-14T12:00:00.000Z"); // +8
    expect(dateMatchesRepeatFromAnchor(ANCHOR, day8, 1, "week")).toBe(false);
  });

  it("matches same day next month for unit=month", () => {
    const nextMonth = new Date("2025-02-06T12:00:00.000Z");
    expect(dateMatchesRepeatFromAnchor(ANCHOR, nextMonth, 1, "month")).toBe(true);
  });

  it("fails on different day-of-month for unit=month", () => {
    const wrongDay = new Date("2025-02-07T12:00:00.000Z");
    expect(dateMatchesRepeatFromAnchor(ANCHOR, wrongDay, 1, "month")).toBe(false);
  });

  it("returns false for dates before anchor", () => {
    const before = new Date("2025-01-05T12:00:00.000Z");
    expect(dateMatchesRepeatFromAnchor(ANCHOR, before, 1, "day")).toBe(false);
  });
});

describe("intervalOccursOnDate", () => {
  it("occurs every day for daily interval anchored in the past", () => {
    const iv = makeIv({ repeatUnit: "day", repeatValue: 1 });
    expect(intervalOccursOnDate(iv, "2025-01-07")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-03-10")).toBe(true);
  });

  it("matches customRepeatDates exactly", () => {
    const iv = makeIv({
      customRepeatDates: ["2025-03-15T00:00:00.000Z", "2025-06-01T00:00:00.000Z"],
      repeatUnit: null,
    });
    expect(intervalOccursOnDate(iv, "2025-03-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-03-16")).toBe(false);
  });

  it("does not occur after endTime", () => {
    const iv = makeIv({
      repeatUnit: "day",
      repeatValue: 1,
      endTime: "2025-01-08T23:59:59.000Z",
    });
    expect(intervalOccursOnDate(iv, "2025-01-08")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-09")).toBe(false);
  });

  it("matches correct day-of-week for customRepeatRule week", () => {
    const iv = makeIv({
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [1] }), // Mondays
      repeatUnit: null,
    });
    expect(intervalOccursOnDate(iv, "2025-01-06")).toBe(true);  // Monday
    expect(intervalOccursOnDate(iv, "2025-01-07")).toBe(false); // Tuesday
  });

  it("matches correct day-of-month for customRepeatRule month", () => {
    const iv = makeIv({
      customRepeatRule: JSON.stringify({ unit: "month", daysOfMonth: [15] }),
      repeatUnit: null,
    });
    expect(intervalOccursOnDate(iv, "2025-01-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-16")).toBe(false);
  });
});

describe("getIntervalOccurrenceTimes", () => {
  it("falls back to 09:00 when no rule and no predictedToDoTime", () => {
    expect(getIntervalOccurrenceTimes({ customRepeatRule: null, predictedToDoTime: null }))
      .toEqual(["09:00"]);
  });

  it("uses predictedToDoTime when no customRepeatRule blocks", () => {
    expect(getIntervalOccurrenceTimes({ customRepeatRule: null, predictedToDoTime: "14:30" }))
      .toEqual(["14:30"]);
  });

  it("extracts timeOfDayBlocks from customRepeatRule", () => {
    const rule = JSON.stringify({ unit: "day", timeOfDayBlocks: ["08:00", "17:00"] });
    expect(getIntervalOccurrenceTimes({ customRepeatRule: rule, predictedToDoTime: null }))
      .toEqual(["08:00", "17:00"]);
  });

  it("ignores invalid time formats in timeOfDayBlocks", () => {
    const rule = JSON.stringify({ timeOfDayBlocks: ["09:00", "bad", "14:00"] });
    expect(getIntervalOccurrenceTimes({ customRepeatRule: rule, predictedToDoTime: null }))
      .toEqual(["09:00", "14:00"]);
  });
});
