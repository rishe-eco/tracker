/**
 * One date-arithmetic vocabulary, two calendars behind it.
 *
 * `date-fns-jalali` is a fork of `date-fns` with the same function names and
 * the same `Date`-in / `Date`-out contract — it reinterprets the *fields* of an
 * instant, never the instant itself. So `startOfMonth(aug15)` under Jalali
 * returns Thu Jul 23, a real Gregorian moment that happens to be 1 Mordad.
 * Nothing downstream — storage, the wire, comparison, sorting — has to know
 * which calendar produced a `Date`.
 *
 * ## The one rule that matters
 *
 * **Never route a machine-readable date key through here.** `format(d,
 * "yyyy-MM-dd")` under the Jalali set returns `"1405-05-24"`, which is a
 * perfectly well-formed string that the API will accept and store as a date
 * fourteen centuries out. Anything that becomes a GraphQL argument, a map key,
 * or an `<input min>` attribute must import `format` from `date-fns` directly —
 * see `~/utils/dateUtils`, which is pinned to Gregorian for exactly this reason
 * and is the right home for new ones.
 *
 * Rendering goes through here. Wire formats do not. The type system cannot tell
 * the two apart, because both are `(Date, string) => string`.
 *
 * ## Why patterns are named instead of passed
 *
 * A format string is not portable between the two calendars. `"MMM d, yyyy"`
 * gives "Aug 15, 2026" and "مرد 24, 1405" — the second is wrong twice over:
 * Jalali month names are short enough that nobody abbreviates them, and the
 * comma-before-year convention is Anglophone. Callers ask for a *kind* of date
 * (`dayMonthYear`) and the table below decides how that kind is spelled.
 */

import {
  addDays as gAddDays,
  addMonths as gAddMonths,
  addWeeks as gAddWeeks,
  addYears as gAddYears,
  endOfMonth as gEndOfMonth,
  endOfWeek as gEndOfWeek,
  endOfYear as gEndOfYear,
  format as gFormat,
  getDate as gGetDate,
  getDaysInMonth as gGetDaysInMonth,
  getMonth as gGetMonth,
  getYear as gGetYear,
  isSameDay as gIsSameDay,
  isSameMonth as gIsSameMonth,
  isToday as gIsToday,
  isValid as gIsValid,
  parse as gParse,
  startOfDay as gStartOfDay,
  startOfMonth as gStartOfMonth,
  startOfWeek as gStartOfWeek,
  startOfYear as gStartOfYear,
} from "date-fns";
import { enUS as gEnUS } from "date-fns/locale/en-US";
import { faIR as gFaIR } from "date-fns/locale/fa-IR";

import {
  addDays as jAddDays,
  addMonths as jAddMonths,
  addWeeks as jAddWeeks,
  addYears as jAddYears,
  endOfMonth as jEndOfMonth,
  endOfWeek as jEndOfWeek,
  endOfYear as jEndOfYear,
  format as jFormat,
  getDate as jGetDate,
  getDaysInMonth as jGetDaysInMonth,
  getMonth as jGetMonth,
  getYear as jGetYear,
  isSameDay as jIsSameDay,
  isSameMonth as jIsSameMonth,
  isToday as jIsToday,
  isValid as jIsValid,
  newDate as jNewDate,
  parse as jParse,
  startOfDay as jStartOfDay,
  startOfMonth as jStartOfMonth,
  startOfWeek as jStartOfWeek,
  startOfYear as jStartOfYear,
} from "date-fns-jalali";
import { enUS as jEnUS } from "date-fns-jalali/locale/en-US";
import { faIR as jFaIR } from "date-fns-jalali/locale/fa-IR";

import type { CalendarSystem } from "~/i18n/calendar";
import type { AppLanguage } from "~/i18n/config";

/** The date kinds the app actually renders. */
export type DatePattern =
  | "dayMonth"
  | "dayMonthYear"
  | "monthYear"
  | "month"
  | "year"
  | "dayOfMonth"
  | "numericDate"
  | "time"
  | "weekday"
  | "weekdayNarrow"
  | "weekdayShortDay"
  | "weekdayDayMonth"
  | "weekdayDayMonthYear"
  | "weekdayShortDayMonth"
  | "weekdayShortDayMonthYear";

const GREGORIAN_PATTERNS: Record<DatePattern, string> = {
  dayMonth: "MMM d",
  dayMonthYear: "MMM d, yyyy",
  monthYear: "MMMM yyyy",
  month: "MMMM",
  year: "yyyy",
  dayOfMonth: "d",
  numericDate: "yyyy/MM/dd",
  time: "HH:mm",
  weekday: "EEEE",
  weekdayNarrow: "EEEEEE",
  weekdayShortDay: "EEE d",
  weekdayDayMonth: "EEEE, MMM d",
  weekdayDayMonthYear: "EEEE, MMM d, yyyy",
  weekdayShortDayMonth: "EEE, MMM d",
  weekdayShortDayMonthYear: "EEE, MMM d, yyyy",
};

/**
 * Jalali spells the same kinds differently: day before month, month names in
 * full (`MMM` yields "مرد" / "Mor", which nobody writes), and no comma before
 * the year.
 */
const JALALI_PATTERNS: Record<DatePattern, string> = {
  dayMonth: "d MMMM",
  dayMonthYear: "d MMMM yyyy",
  monthYear: "MMMM yyyy",
  month: "MMMM",
  year: "yyyy",
  dayOfMonth: "d",
  numericDate: "yyyy/MM/dd",
  time: "HH:mm",
  weekday: "EEEE",
  weekdayNarrow: "EEEEEE",
  weekdayShortDay: "EEE d",
  weekdayDayMonth: "EEEE d MMMM",
  weekdayDayMonthYear: "EEEE d MMMM yyyy",
  weekdayShortDayMonth: "EEE d MMMM",
  weekdayShortDayMonthYear: "EEE d MMMM yyyy",
};

/**
 * The parse format for typed date entry, per calendar.
 *
 * Jalali is `yyyy/MM/dd` because that is how the date is written everywhere it
 * appears in Iran. Gregorian typing never reaches this path — that mode keeps
 * the native `<input type="date">` — but the format is defined so the picker
 * has one code path.
 */
export const TYPED_DATE_FORMAT = "yyyy/MM/dd";

export type DateFns = {
  format: (date: Date | number, pattern: string, options?: object) => string;
  parse: (value: string, pattern: string, reference: Date, options?: object) => Date;
  addDays: (date: Date | number, amount: number) => Date;
  addWeeks: (date: Date | number, amount: number) => Date;
  addMonths: (date: Date | number, amount: number) => Date;
  addYears: (date: Date | number, amount: number) => Date;
  startOfDay: (date: Date | number) => Date;
  startOfWeek: (date: Date | number, options?: object) => Date;
  endOfWeek: (date: Date | number, options?: object) => Date;
  startOfMonth: (date: Date | number) => Date;
  endOfMonth: (date: Date | number) => Date;
  startOfYear: (date: Date | number) => Date;
  endOfYear: (date: Date | number) => Date;
  getYear: (date: Date | number) => number;
  getMonth: (date: Date | number) => number;
  getDate: (date: Date | number) => number;
  getDaysInMonth: (date: Date | number) => number;
  isSameDay: (a: Date | number, b: Date | number) => boolean;
  isSameMonth: (a: Date | number, b: Date | number) => boolean;
  isToday: (date: Date | number) => boolean;
  isValid: (date: unknown) => boolean;
  /** Build a date from calendar fields. `month` is 0-indexed, as in `Date`. */
  newDate: (year: number, month: number, day: number) => Date;
};

const GREGORIAN: DateFns = {
  format: gFormat,
  parse: gParse,
  addDays: gAddDays,
  addWeeks: gAddWeeks,
  addMonths: gAddMonths,
  addYears: gAddYears,
  startOfDay: gStartOfDay,
  startOfWeek: gStartOfWeek,
  endOfWeek: gEndOfWeek,
  startOfMonth: gStartOfMonth,
  endOfMonth: gEndOfMonth,
  startOfYear: gStartOfYear,
  endOfYear: gEndOfYear,
  getYear: gGetYear,
  getMonth: gGetMonth,
  getDate: gGetDate,
  getDaysInMonth: gGetDaysInMonth,
  isSameDay: gIsSameDay,
  isSameMonth: gIsSameMonth,
  isToday: gIsToday,
  isValid: gIsValid,
  newDate: (year, month, day) => new Date(year, month, day),
};

const JALALI: DateFns = {
  format: jFormat,
  parse: jParse,
  addDays: jAddDays,
  addWeeks: jAddWeeks,
  addMonths: jAddMonths,
  addYears: jAddYears,
  startOfDay: jStartOfDay,
  startOfWeek: jStartOfWeek,
  endOfWeek: jEndOfWeek,
  startOfMonth: jStartOfMonth,
  endOfMonth: jEndOfMonth,
  startOfYear: jStartOfYear,
  endOfYear: jEndOfYear,
  getYear: jGetYear,
  getMonth: jGetMonth,
  getDate: jGetDate,
  getDaysInMonth: jGetDaysInMonth,
  isSameDay: jIsSameDay,
  isSameMonth: jIsSameMonth,
  isToday: jIsToday,
  isValid: jIsValid,
  newDate: jNewDate,
};

export function getDateFns(calendar: CalendarSystem): DateFns {
  return calendar === "jalali" ? JALALI : GREGORIAN;
}

export function getDatePattern(calendar: CalendarSystem, pattern: DatePattern): string {
  return (calendar === "jalali" ? JALALI_PATTERNS : GREGORIAN_PATTERNS)[pattern];
}

/**
 * Locale objects are **not** interchangeable between the two packages — each
 * carries its own month tables — so the locale must be drawn from whichever
 * library is going to consume it.
 */
export function getCalendarLocale(calendar: CalendarSystem, language: AppLanguage) {
  if (calendar === "jalali") return language === "fa" ? jFaIR : jEnUS;
  return language === "fa" ? gFaIR : gEnUS;
}

/**
 * Which day the week grid starts on.
 *
 * This follows the **calendar**, not the language, and the two used to be
 * conflated. In the Jalali calendar the week structurally begins on Saturday
 * (شنبه is literally "day one" — the following days are numbered from it), so
 * it is a property of the calendar. Persian-language UI over a Gregorian
 * calendar is a different case and keeps the Gregorian week.
 */
export function getWeekStart(calendar: CalendarSystem): 0 | 6 {
  return calendar === "jalali" ? 6 : 0;
}
