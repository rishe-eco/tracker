/**
 * The one hook components use to render a date.
 *
 * Bundles the two independent axes — calendar and language — into a single
 * `fmt(date, "dayMonthYear")` call, so no component has to remember that
 * `date-fns-jalali` needs its own locale objects or that Jalali writes the day
 * before the month.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  getCalendarSystem,
  subscribeToCalendar,
  type CalendarSystem,
} from "./calendar";
import type { AppLanguage } from "./config";
import {
  getCalendarLocale,
  getDateFns,
  getDatePattern,
  getWeekStart,
  TYPED_DATE_FORMAT,
  type DateFns,
  type DatePattern,
} from "~/lib/dateSystem";

/**
 * On the server there is no `localStorage`, so the store falls back to the
 * language-derived default — which is deterministic and therefore a valid
 * server snapshot. The authenticated shell doesn't render until `AuthContext`
 * reports hydration anyway, so the client's stored choice is in place before
 * any date reaches the screen.
 */
export function useCalendarSystem(): CalendarSystem {
  return useSyncExternalStore(subscribeToCalendar, getCalendarSystem, getCalendarSystem);
}

export type AppDate = {
  calendar: CalendarSystem;
  language: AppLanguage;
  /** The calendar-appropriate date-fns function set. */
  dfns: DateFns;
  /** The locale object belonging to that function set. */
  locale: object;
  /** 0 = Sunday, 6 = Saturday. Follows the calendar, not the language. */
  weekStartsOn: 0 | 6;
  /** Render a date as a named kind. */
  fmt: (date: Date | number, pattern: DatePattern) => string;
  /** Render with a raw pattern. For literals the named kinds don't cover. */
  fmtRaw: (date: Date | number, pattern: string) => string;
  /** Parse `yyyy/MM/dd` typed in the active calendar. Returns null if unreal. */
  parseTyped: (value: string) => Date | null;
};

export function useAppDate(): AppDate {
  const { i18n } = useTranslation();
  const calendar = useCalendarSystem();
  const language = (i18n.language === "fa" ? "fa" : "en") as AppLanguage;

  const dfns = useMemo(() => getDateFns(calendar), [calendar]);
  const locale = useMemo(() => getCalendarLocale(calendar, language), [calendar, language]);

  const fmt = useCallback(
    (date: Date | number, pattern: DatePattern) =>
      dfns.format(date, getDatePattern(calendar, pattern), { locale }),
    [dfns, calendar, locale]
  );

  const fmtRaw = useCallback(
    (date: Date | number, pattern: string) => dfns.format(date, pattern, { locale }),
    [dfns, locale]
  );

  // `parse` fills unspecified fields from the reference date, so a partial or
  // nonsense string can still produce a valid Date. Round-tripping the result
  // back through `format` is the cheap way to insist the input was complete and
  // real: "1405/13/40" does not survive it, and neither does "1405/6/31" in a
  // 30-day month.
  const parseTyped = useCallback(
    (value: string): Date | null => {
      const trimmed = value.trim();
      if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) return null;
      const parsed = dfns.parse(trimmed, TYPED_DATE_FORMAT, new Date());
      if (!dfns.isValid(parsed)) return null;
      const [y, m, d] = trimmed.split("/").map(Number);
      if (dfns.getYear(parsed) !== y) return null;
      if (dfns.getMonth(parsed) + 1 !== m) return null;
      if (dfns.getDate(parsed) !== d) return null;
      return dfns.startOfDay(parsed);
    },
    [dfns]
  );

  return useMemo(
    () => ({
      calendar,
      language,
      dfns,
      locale,
      weekStartsOn: getWeekStart(calendar),
      fmt,
      fmtRaw,
      parseTyped,
    }),
    [calendar, language, dfns, locale, fmt, fmtRaw, parseTyped]
  );
}
