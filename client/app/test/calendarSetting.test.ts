import { describe, it, expect, beforeEach, vi } from "vitest";
// Imported for their values only. This first import initialises the modules
// once; `loadStore` below resets and re-imports to get a fresh store, and these
// two constants are the same strings either way.
import { CALENDAR_STORAGE_KEY } from "~/i18n/calendar";
import { LANGUAGE_STORAGE_KEY } from "~/i18n/config";

/**
 * The store reads `localStorage` once at import time, so each case has to load
 * it fresh. `resetModules` plus a dynamic import is the only way to exercise
 * "what does a new session see".
 */
async function loadStore(opts: { stored?: string; language?: string } = {}) {
  vi.resetModules();
  window.localStorage.clear();
  if (opts.stored) window.localStorage.setItem(CALENDAR_STORAGE_KEY, opts.stored);
  if (opts.language) window.localStorage.setItem(LANGUAGE_STORAGE_KEY, opts.language);
  return import("~/i18n/calendar");
}

describe("the calendar default follows the language", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts Jalali for a Persian session with no stored choice", async () => {
    const store = await loadStore({ language: "fa" });
    expect(store.getCalendarSystem()).toBe("jalali");
    expect(store.hasExplicitCalendar()).toBe(false);
  });

  it("starts Gregorian for an English session with no stored choice", async () => {
    const store = await loadStore({ language: "en" });
    expect(store.getCalendarSystem()).toBe("gregorian");
  });
});

describe("an explicit choice outranks the language", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps Gregorian in a Persian session once chosen", async () => {
    const store = await loadStore({ stored: "gregorian", language: "fa" });
    expect(store.getCalendarSystem()).toBe("gregorian");
    expect(store.hasExplicitCalendar()).toBe(true);
  });

  it("keeps Jalali in an English session once chosen", async () => {
    const store = await loadStore({ stored: "jalali", language: "en" });
    expect(store.getCalendarSystem()).toBe("jalali");
  });

  it("ignores a stored value that is not a calendar", async () => {
    const store = await loadStore({ stored: "hijri", language: "en" });
    expect(store.getCalendarSystem()).toBe("gregorian");
    expect(store.hasExplicitCalendar()).toBe(false);
  });
});

describe("setting the calendar", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists, notifies subscribers, and records the choice as explicit", async () => {
    const store = await loadStore({ language: "en" });
    const seen: string[] = [];
    store.subscribeToCalendar(() => seen.push(store.getCalendarSystem()));

    store.setCalendarSystem("jalali");
    expect(seen).toEqual(["jalali"]);
    expect(window.localStorage.getItem(CALENDAR_STORAGE_KEY)).toBe("jalali");
    expect(store.hasExplicitCalendar()).toBe(true);
  });

  it("does not notify when the value is unchanged", async () => {
    const store = await loadStore({ language: "en" });
    const listener = vi.fn();
    store.subscribeToCalendar(listener);
    store.setCalendarSystem("gregorian");
    expect(listener).not.toHaveBeenCalled();
  });

  it("goes back to following the language when the choice is cleared", async () => {
    const store = await loadStore({ stored: "gregorian", language: "fa" });
    expect(store.getCalendarSystem()).toBe("gregorian");
    store.clearCalendarChoice();
    expect(store.getCalendarSystem()).toBe("jalali");
    expect(store.hasExplicitCalendar()).toBe(false);
  });
});

describe("changing language mid-session", () => {
  beforeEach(() => window.localStorage.clear());

  it("moves the calendar while it is still inherited", async () => {
    const store = await loadStore({ language: "en" });
    const i18n = (await import("~/i18n/config")).default;
    expect(store.getCalendarSystem()).toBe("gregorian");
    await i18n.changeLanguage("fa");
    expect(store.getCalendarSystem()).toBe("jalali");
  });

  it("leaves an explicit choice alone — a default is not a coupling", async () => {
    const store = await loadStore({ stored: "gregorian", language: "en" });
    const i18n = (await import("~/i18n/config")).default;
    await i18n.changeLanguage("fa");
    expect(store.getCalendarSystem()).toBe("gregorian");
  });
});
