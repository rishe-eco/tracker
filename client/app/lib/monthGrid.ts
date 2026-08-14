/**
 * The weeks of a month, in whichever calendar the caller hands over.
 *
 * Shared by the date picker's popover and the calendar page's month view so
 * the two can never disagree about where a month starts. Everything is derived
 * from the injected `DateFns`, so the same code produces a 31-day Mordad
 * beginning on a Thursday and a 31-day August beginning on a Saturday.
 */

import type { DateFns } from "./dateSystem";

export type MonthGrid = {
  /** Rows of exactly 7 days, covering the whole month plus its edge padding. */
  weeks: Date[][];
  /** Flat list of the 7 day-of-week headers, starting at `weekStartsOn`. */
  weekdays: Date[];
  /** First instant of the month, in the given calendar. */
  monthStart: Date;
  /** Last instant of the month, in the given calendar. */
  monthEnd: Date;
};

export function buildMonthGrid(
  dfns: DateFns,
  date: Date,
  weekStartsOn: 0 | 6
): MonthGrid {
  const monthStart = dfns.startOfMonth(date);
  const monthEnd = dfns.endOfMonth(date);
  const gridStart = dfns.startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = dfns.endOfWeek(monthEnd, { weekStartsOn });

  const weeks: Date[][] = [];
  let cursor = gridStart;
  // Bounded rather than `while (cursor <= gridEnd)`: a malformed function set
  // that failed to advance would otherwise hang the render. Six rows is the
  // most any month in either calendar can occupy.
  for (let row = 0; row < 6; row++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = dfns.addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > gridEnd) break;
  }

  return { weeks, weekdays: weeks[0] ?? [], monthStart, monthEnd };
}
