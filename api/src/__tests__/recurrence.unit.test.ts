import { describe, it, expect } from "vitest";
import {
  getGatheringDateKeys,
  intervalOccursOnDate,
  dateMatchesRepeatFromAnchor,
  getIntervalOccurrencesForDate,
} from "../services/actionGathering";

// Anchor: Monday 2025-01-06
const MON = new Date("2025-01-06T12:00:00.000Z");

function makeInterval(overrides: Partial<{
  customRepeatDates: string | null;
  customRepeatRule: string | null;
  repeatValue: number;
  repeatUnit: string | null;
  endTime: Date | null;
  createdAt: Date;
}>) {
  return {
    customRepeatDates: null,
    customRepeatRule: null,
    repeatValue: 1,
    repeatUnit: "day",
    endTime: null,
    createdAt: MON,
    ...overrides,
  };
}

describe("getGatheringDateKeys", () => {
  it("returns today, today+1, today+2", () => {
    expect(getGatheringDateKeys("2025-01-06")).toEqual([
      "2025-01-06",
      "2025-01-07",
      "2025-01-08",
    ]);
  });

  it("handles month boundary correctly", () => {
    expect(getGatheringDateKeys("2025-01-31")).toEqual([
      "2025-01-31",
      "2025-02-01",
      "2025-02-02",
    ]);
  });
});

describe("intervalOccursOnDate — daily repeat", () => {
  it("matches every day with repeatUnit=day, repeatValue=1", () => {
    const iv = makeInterval({ repeatUnit: "day", repeatValue: 1 });
    expect(intervalOccursOnDate(iv, "2025-01-07")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-10")).toBe(true);
  });

  it("matches every other day with repeatValue=2", () => {
    const iv = makeInterval({ repeatUnit: "day", repeatValue: 2 });
    // anchor=Mon Jan 6; +2 days = Jan 8 ✓, +3 days = Jan 9 ✗
    expect(intervalOccursOnDate(iv, "2025-01-08")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-09")).toBe(false);
  });

  it("does not occur before anchor date", () => {
    const iv = makeInterval({ repeatUnit: "day", repeatValue: 1 });
    expect(intervalOccursOnDate(iv, "2025-01-05")).toBe(false);
  });
});

describe("intervalOccursOnDate — weekly repeat", () => {
  it("matches exactly 1 week after anchor", () => {
    const iv = makeInterval({ repeatUnit: "week", repeatValue: 1 });
    expect(intervalOccursOnDate(iv, "2025-01-13")).toBe(true); // +7 days
    expect(intervalOccursOnDate(iv, "2025-01-14")).toBe(false); // +8 days
  });

  it("every 2 weeks skips odd weeks", () => {
    const iv = makeInterval({ repeatUnit: "week", repeatValue: 2 });
    expect(intervalOccursOnDate(iv, "2025-01-20")).toBe(true);  // +14 days
    expect(intervalOccursOnDate(iv, "2025-01-13")).toBe(false); // +7 days
  });
});

describe("intervalOccursOnDate — endTime cutoff", () => {
  it("does not occur after endTime", () => {
    const iv = makeInterval({
      repeatUnit: "day",
      repeatValue: 1,
      endTime: new Date("2025-01-08T00:00:00.000Z"),
    });
    expect(intervalOccursOnDate(iv, "2025-01-07")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-09")).toBe(false);
  });
});

describe("intervalOccursOnDate — customRepeatDates", () => {
  it("matches only the listed dates", () => {
    const iv = makeInterval({
      customRepeatDates: JSON.stringify(["2025-03-15T00:00:00.000Z", "2025-06-01T00:00:00.000Z"]),
      repeatUnit: null,
    });
    expect(intervalOccursOnDate(iv, "2025-03-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-06-01")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-03-16")).toBe(false);
  });
});

describe("intervalOccursOnDate — customRepeatRule week", () => {
  it("matches correct day-of-week (Monday=1)", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [1] }), // every Monday
      repeatUnit: null,
    });
    expect(intervalOccursOnDate(iv, "2025-01-06")).toBe(true);  // Monday
    expect(intervalOccursOnDate(iv, "2025-01-07")).toBe(false); // Tuesday
    expect(intervalOccursOnDate(iv, "2025-01-13")).toBe(true);  // next Monday
  });
});

// The combination the interval form actually sends: repeatUnit="week" +
// repeatValue + customRepeatRule.daysOfWeek all set together. The suite above
// only ever exercised repeatUnit:null, which took an early return and never hit
// the anchor-cadence gate — which is where the "only fires on the creation
// weekday" bug lived.
describe("intervalOccursOnDate — weekly rule with repeatUnit (the form's real payload)", () => {
  // Anchor MON 2025-01-06.
  it("fires on a selected weekday that is NOT the creation weekday", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [2] }), // every Tuesday
      repeatUnit: "week",
      repeatValue: 1,
    });
    expect(intervalOccursOnDate(iv, "2025-01-07")).toBe(true);  // Tue, same week as creation
    expect(intervalOccursOnDate(iv, "2025-01-14")).toBe(true);  // Tue, next week
    expect(intervalOccursOnDate(iv, "2025-01-06")).toBe(false); // Mon not selected
  });

  it("fires on every selected weekday, not just the creation weekday", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [1, 4] }), // Mon & Thu
      repeatUnit: "week",
      repeatValue: 1,
    });
    expect(intervalOccursOnDate(iv, "2025-01-06")).toBe(true); // Mon (creation weekday)
    expect(intervalOccursOnDate(iv, "2025-01-09")).toBe(true); // Thu — was silently dropped
    expect(intervalOccursOnDate(iv, "2025-01-13")).toBe(true); // next Mon
    expect(intervalOccursOnDate(iv, "2025-01-16")).toBe(true); // next Thu
    expect(intervalOccursOnDate(iv, "2025-01-08")).toBe(false); // Wed not selected
  });

  it("honors every-2-weeks cadence on all selected days, anchored to the creation week", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [1, 4] }), // Mon & Thu
      repeatUnit: "week",
      repeatValue: 2,
    });
    // Creation week (Jan 6 is Mon): both fire.
    expect(intervalOccursOnDate(iv, "2025-01-06")).toBe(true); // Mon wk0
    expect(intervalOccursOnDate(iv, "2025-01-09")).toBe(true); // Thu wk0
    // Odd week: neither.
    expect(intervalOccursOnDate(iv, "2025-01-13")).toBe(false); // Mon wk1
    expect(intervalOccursOnDate(iv, "2025-01-16")).toBe(false); // Thu wk1
    // Week 2: both again.
    expect(intervalOccursOnDate(iv, "2025-01-20")).toBe(true); // Mon wk2
    expect(intervalOccursOnDate(iv, "2025-01-23")).toBe(true); // Thu wk2
  });

  it("does not fire before the creation date", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "week", daysOfWeek: [1] }), // every Monday
      repeatUnit: "week",
      repeatValue: 1,
      createdAt: new Date("2025-01-08T12:00:00.000Z"), // Wed
    });
    expect(intervalOccursOnDate(iv, "2025-01-06")).toBe(false); // Mon before creation
    expect(intervalOccursOnDate(iv, "2025-01-13")).toBe(true);  // first Mon on/after
  });
});

describe("intervalOccursOnDate — monthly rule with repeatUnit", () => {
  it("fires on the selected day-of-month even when it differs from the creation day", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "month", daysOfMonth: [15] }),
      repeatUnit: "month",
      repeatValue: 1,
      createdAt: new Date("2025-01-06T12:00:00.000Z"), // created on the 6th
    });
    expect(intervalOccursOnDate(iv, "2025-01-15")).toBe(true);  // was dropped (createdAt day = 6)
    expect(intervalOccursOnDate(iv, "2025-02-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-16")).toBe(false);
  });

  it("honors every-2-months cadence anchored to the creation month", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "month", daysOfMonth: [15] }),
      repeatUnit: "month",
      repeatValue: 2,
      createdAt: new Date("2025-01-06T12:00:00.000Z"),
    });
    expect(intervalOccursOnDate(iv, "2025-01-15")).toBe(true);  // month 0
    expect(intervalOccursOnDate(iv, "2025-02-15")).toBe(false); // month 1
    expect(intervalOccursOnDate(iv, "2025-03-15")).toBe(true);  // month 2
  });
});

describe("intervalOccursOnDate — yearly rule with repeatUnit", () => {
  it("fires on the selected month/day each year", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "year", months: [3], daysOfMonth: [15] }),
      repeatUnit: "year",
      repeatValue: 1,
      createdAt: new Date("2025-01-06T12:00:00.000Z"),
    });
    expect(intervalOccursOnDate(iv, "2025-03-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2026-03-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-03-16")).toBe(false);
    expect(intervalOccursOnDate(iv, "2025-04-15")).toBe(false);
  });

  it("honors every-2-years cadence anchored to the creation year", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "year", months: [3], daysOfMonth: [15] }),
      repeatUnit: "year",
      repeatValue: 2,
      createdAt: new Date("2025-01-06T12:00:00.000Z"),
    });
    expect(intervalOccursOnDate(iv, "2025-03-15")).toBe(true);  // year 0
    expect(intervalOccursOnDate(iv, "2026-03-15")).toBe(false); // year 1
    expect(intervalOccursOnDate(iv, "2027-03-15")).toBe(true);  // year 2
  });
});

describe("intervalOccursOnDate — customRepeatRule month", () => {
  it("matches the listed day-of-month", () => {
    const iv = makeInterval({
      customRepeatRule: JSON.stringify({ unit: "month", daysOfMonth: [15] }),
      repeatUnit: null,
    });
    expect(intervalOccursOnDate(iv, "2025-01-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-02-15")).toBe(true);
    expect(intervalOccursOnDate(iv, "2025-01-16")).toBe(false);
  });
});

describe("dateMatchesRepeatFromAnchor", () => {
  it("matches anchor date itself (N=0)", () => {
    expect(dateMatchesRepeatFromAnchor(MON, new Date("2025-01-06T12:00:00Z"), 1, "day")).toBe(true);
  });

  it("daily: matches every day", () => {
    const day7 = new Date("2025-01-13T12:00:00Z");
    expect(dateMatchesRepeatFromAnchor(MON, day7, 1, "day")).toBe(true);
  });

  it("weekly: matches every 7 days", () => {
    const week2 = new Date("2025-01-20T12:00:00Z"); // +14 days = 2 weeks
    expect(dateMatchesRepeatFromAnchor(MON, week2, 1, "week")).toBe(true);
    const day8 = new Date("2025-01-14T12:00:00Z");
    expect(dateMatchesRepeatFromAnchor(MON, day8, 1, "week")).toBe(false);
  });

  it("monthly: matches same day next month", () => {
    const nextMonth = new Date("2025-02-06T12:00:00Z");
    expect(dateMatchesRepeatFromAnchor(MON, nextMonth, 1, "month")).toBe(true);
    const wrongDay = new Date("2025-02-07T12:00:00Z");
    expect(dateMatchesRepeatFromAnchor(MON, wrongDay, 1, "month")).toBe(false);
  });

  it("returns false for dates before anchor", () => {
    const before = new Date("2025-01-05T12:00:00Z");
    expect(dateMatchesRepeatFromAnchor(MON, before, 1, "day")).toBe(false);
  });
});

describe("getIntervalOccurrencesForDate", () => {
  it("falls back to 09:00 when no rule or predictedToDoTime", () => {
    const result = getIntervalOccurrencesForDate({ customRepeatRule: null, predictedToDoTime: null });
    expect(result).toEqual([{ startTimeOfDay: "09:00" }]);
  });

  it("uses predictedToDoTime when no rule blocks", () => {
    const result = getIntervalOccurrencesForDate({ customRepeatRule: null, predictedToDoTime: "14:30" });
    expect(result).toEqual([{ startTimeOfDay: "14:30" }]);
  });

  it("extracts timeOfDayBlocks from customRepeatRule", () => {
    const rule = JSON.stringify({ unit: "day", timeOfDayBlocks: ["08:00", "17:00"] });
    const result = getIntervalOccurrencesForDate({ customRepeatRule: rule, predictedToDoTime: null });
    expect(result).toEqual([{ startTimeOfDay: "08:00" }, { startTimeOfDay: "17:00" }]);
  });
});
