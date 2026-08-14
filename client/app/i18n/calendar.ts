/**
 * Which calendar the app counts days in — Miladi (Gregorian) or Jalali.
 *
 * **Deliberately a separate axis from language.** Conventions §7d left this
 * open ("whether Persian users see Jalali dates is a product decision and is
 * not settled here"); this settles it as two independent choices, because both
 * off-diagonal combinations are real. Persian speakers outside Iran keep
 * Gregorian deadlines, and an English-reading user working to an Iranian
 * academic or fiscal calendar needs Jalali dates in English words — which the
 * `en-US` locale of `date-fns-jalali` renders as "24 Mordad 1405".
 *
 * **Stored client-side, like language.** D-22 settled that the server learns
 * the language from `Accept-Language` rather than a column, on the grounds that
 * a second copy of a person's preference is free to disagree with the first.
 * The same reasoning applies here with less to argue about: no server code
 * formats a date at all — everything crosses the wire as ISO or epoch — so the
 * calendar is a pure rendering choice and the server has no use for it.
 */

import i18n, { type AppLanguage } from "./config";

export const CALENDAR_STORAGE_KEY = "tracker.calendar";

export const CALENDAR_SYSTEMS = ["gregorian", "jalali"] as const;
export type CalendarSystem = (typeof CALENDAR_SYSTEMS)[number];

function isCalendarSystem(value: unknown): value is CalendarSystem {
  return typeof value === "string" && CALENDAR_SYSTEMS.includes(value as CalendarSystem);
}

/**
 * The calendar a language implies when nobody has said otherwise.
 *
 * This is a starting position, not a coupling: it decides what an account sees
 * before it has an opinion, and stops applying the moment one is recorded.
 */
export function calendarForLanguage(language: string): CalendarSystem {
  return language === "fa" ? "jalali" : "gregorian";
}

function readStored(): CalendarSystem | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
  return isCalendarSystem(saved) ? saved : null;
}

/** Has the user made an explicit choice, as opposed to inheriting one? */
export function hasExplicitCalendar(): boolean {
  return readStored() !== null;
}

let current: CalendarSystem = readStored() ?? calendarForLanguage(i18n.language);

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToCalendar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCalendarSystem(): CalendarSystem {
  return current;
}

export function setCalendarSystem(calendar: CalendarSystem) {
  if (!isCalendarSystem(calendar) || calendar === current) return;
  current = calendar;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CALENDAR_STORAGE_KEY, calendar);
  }
  emit();
}

/**
 * Go back to inheriting from the language.
 *
 * Not currently surfaced in the UI. It exists so the "explicit choice" state is
 * reversible rather than a one-way door, and so tests can get back to a clean
 * starting position without reaching into `localStorage` themselves.
 */
export function clearCalendarChoice() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CALENDAR_STORAGE_KEY);
  }
  const inherited = calendarForLanguage(i18n.language);
  if (inherited === current) return;
  current = inherited;
  emit();
}

// Switching language moves the calendar with it *only* while the calendar is
// still inherited. Once someone has chosen, changing language must not quietly
// undo that choice — that is the whole difference between a default and a
// coupling.
i18n.on("languageChanged", (language: string) => {
  if (hasExplicitCalendar()) return;
  const inherited = calendarForLanguage(language as AppLanguage);
  if (inherited === current) return;
  current = inherited;
  emit();
});
