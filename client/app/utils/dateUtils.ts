import { format, addDays } from "date-fns";

/**
 * Returns the calendar date in the user's local timezone as "YYYY-MM-DD".
 * Use this instead of toISOString().split("T")[0] so the day doesn't shift near midnight.
 */
export function toLocalDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Add N days to a dateKey "YYYY-MM-DD", return dateKey. */
export function addDaysToDateKey(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return format(addDays(date, n), "yyyy-MM-dd");
}

/**
 * Parses an API date value (ISO string, timestamp number, or timestamp-as-string like "1771200000000")
 * or an existing Date, and returns a Date at local midnight for that calendar day.
 * - For ISO strings from the API (e.g. "2025-02-15T00:00:00.000Z"): uses UTC date parts so the
 *   intended calendar day is preserved (e.g. Feb 15).
 * - For an existing Date (e.g. from a previous parseDateOnly): uses local date parts so we don't
 *   double-apply UTC and shift the day in timezones behind UTC (which would make "today" show as "Ignored").
 */
export function parseDateOnly(isoOrDate: string | number | Date): Date {
  let d: Date;
  if (typeof isoOrDate === "object") {
    d = isoOrDate;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof isoOrDate === "string" && /^\d+$/.test(isoOrDate)) {
    d = new Date(Number(isoOrDate));
  } else {
    d = new Date(isoOrDate);
  }
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
