import { describe, it, expect } from "vitest";
import {
  getCalendarLocale,
  getDateFns,
  getDatePattern,
  getWeekStart,
  TYPED_DATE_FORMAT,
} from "~/lib/dateSystem";
import { buildMonthGrid } from "~/lib/monthGrid";
import { toLocalDateString } from "~/utils/dateUtils";

/** 15 August 2026 is 24 Mordad 1405 — a Saturday in both calendars. */
const REFERENCE = new Date(2026, 7, 15);

const g = getDateFns("gregorian");
const j = getDateFns("jalali");

describe("the two function sets agree about instants", () => {
  it("reinterprets the same Date rather than moving it", () => {
    expect(g.format(REFERENCE, "yyyy-MM-dd")).toBe("2026-08-15");
    expect(j.format(REFERENCE, "yyyy-MM-dd")).toBe("1405-05-24");
  });

  it("returns a real Gregorian instant from Jalali month arithmetic", () => {
    // 1 Mordad 1405 is 23 July 2026 — the point of the whole design is that
    // this is an ordinary Date that everything downstream can handle.
    expect(toLocalDateString(j.startOfMonth(REFERENCE))).toBe("2026-07-23");
    expect(toLocalDateString(g.startOfMonth(REFERENCE))).toBe("2026-08-01");
  });

  it("keeps month lengths right, including the Jalali leap year", () => {
    // 1403 is a leap year (Esfand has 30 days); 1404 is not.
    expect(j.getDaysInMonth(j.newDate(1403, 11, 1))).toBe(30);
    expect(j.getDaysInMonth(j.newDate(1404, 11, 1))).toBe(29);
    // The first six Jalali months are 31 days, the next five are 30.
    expect(j.getDaysInMonth(j.newDate(1405, 0, 1))).toBe(31);
    expect(j.getDaysInMonth(j.newDate(1405, 6, 1))).toBe(30);
  });
});

describe("wire formats stay Gregorian", () => {
  it("does not let the calendar setting reach toLocalDateString", () => {
    // The single most damaging thing this feature could do is emit "1405-05-24"
    // as a dateKey. `dateUtils` is pinned to `date-fns` so it cannot.
    expect(toLocalDateString(REFERENCE)).toBe("2026-08-15");
  });
});

describe("digits are Latin in both calendars and both languages", () => {
  // Conventions §7d: no Persian or Arabic-Indic digits anywhere, and this is
  // the case most likely to reintroduce them.
  it.each([
    ["gregorian", "en"],
    ["gregorian", "fa"],
    ["jalali", "en"],
    ["jalali", "fa"],
  ] as const)("%s / %s", (calendar, language) => {
    const dfns = getDateFns(calendar);
    const locale = getCalendarLocale(calendar, language);
    const out = dfns.format(REFERENCE, "yyyy/MM/dd HH:mm", { locale });
    expect(out).toMatch(/^[\d/: ]+$/);
    expect(out).not.toMatch(/[۰-۹٠-٩]/);
  });
});

describe("named patterns", () => {
  it("puts the day before the month in Jalali and spells the month out", () => {
    expect(getDatePattern("gregorian", "dayMonthYear")).toBe("MMM d, yyyy");
    expect(getDatePattern("jalali", "dayMonthYear")).toBe("d MMMM yyyy");
  });

  it("renders the month name in the language, not the calendar", () => {
    const asFa = j.format(REFERENCE, getDatePattern("jalali", "dayMonthYear"), {
      locale: getCalendarLocale("jalali", "fa"),
    });
    const asEn = j.format(REFERENCE, getDatePattern("jalali", "dayMonthYear"), {
      locale: getCalendarLocale("jalali", "en"),
    });
    expect(asFa).toBe("24 مرداد 1405");
    expect(asEn).toBe("24 Mordad 1405");
  });
});

describe("typed date entry", () => {
  const parse = (value: string) => {
    const parsed = j.parse(value, TYPED_DATE_FORMAT, new Date());
    if (!j.isValid(parsed)) return null;
    const [y, m, d] = value.split("/").map(Number);
    if (j.getYear(parsed) !== y) return null;
    if (j.getMonth(parsed) + 1 !== m) return null;
    if (j.getDate(parsed) !== d) return null;
    return parsed;
  };

  it("accepts a real Jalali date and lands on the right Gregorian day", () => {
    expect(toLocalDateString(parse("1405/05/24")!)).toBe("2026-08-15");
  });

  it("rejects an impossible month or day", () => {
    expect(parse("1405/13/40")).toBeNull();
  });

  it("rejects a day that does not exist in that particular month", () => {
    // Mehr (month 7) has 30 days, so 31 Mehr must not silently roll into Aban.
    expect(parse("1405/07/31")).toBeNull();
  });

  it("rejects an unreal day in a common year", () => {
    // 1404 is not a leap year, so 30 Esfand does not exist.
    expect(parse("1404/12/30")).toBeNull();
    expect(parse("1403/12/30")).not.toBeNull();
  });
});

describe("week start follows the calendar, not the language", () => {
  it("starts the Jalali week on Saturday and the Gregorian week on Sunday", () => {
    expect(getWeekStart("jalali")).toBe(6);
    expect(getWeekStart("gregorian")).toBe(0);
  });
});

describe("buildMonthGrid", () => {
  it("covers the whole month in complete weeks", () => {
    for (const [dfns, weekStart] of [
      [g, getWeekStart("gregorian")],
      [j, getWeekStart("jalali")],
    ] as const) {
      const grid = buildMonthGrid(dfns, REFERENCE, weekStart);
      const days = grid.weeks.flat();
      expect(days.length % 7).toBe(0);
      expect(grid.weeks.length).toBeGreaterThanOrEqual(4);
      expect(grid.weeks.length).toBeLessThanOrEqual(6);
      expect(days[0]!.getTime()).toBeLessThanOrEqual(grid.monthStart.getTime());
      expect(days[days.length - 1]!.getTime()).toBeGreaterThanOrEqual(grid.monthEnd.getTime());
    }
  });

  it("builds a Jalali month that no Gregorian grid would produce", () => {
    // This is the case react-big-calendar could not express: Mordad 1405 runs
    // 23 July – 22 August, so the grid must start in July.
    const grid = buildMonthGrid(j, REFERENCE, getWeekStart("jalali"));
    expect(toLocalDateString(grid.monthStart)).toBe("2026-07-23");
    expect(toLocalDateString(grid.monthEnd)).toBe("2026-08-22");
    const inMonth = grid.weeks.flat().filter((d) => j.isSameMonth(d, REFERENCE));
    expect(inMonth.length).toBe(31);
  });

  it("starts every row on the requested weekday", () => {
    const grid = buildMonthGrid(j, REFERENCE, 6);
    for (const week of grid.weeks) expect(week[0]!.getDay()).toBe(6);
  });
});
