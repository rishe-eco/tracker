import { describe, expect, it } from "vitest";
import {
  buildPlan,
  DEFAULT_SESSIONS_PER_MODULE,
  weekdaySlots,
  type PlanOptions,
} from "../services/skills/planning";

const MODULES = ["e1-stop", "e2-source", "e3-sideways", "e4-trace", "e5-independence", "e6-reflex"];

const opts = (over: Partial<PlanOptions> = {}): PlanOptions => ({
  startDateKey: "2026-08-03", // a Monday
  sessionsPerWeek: 3,
  timeOfDay: "09:00",
  ...over,
});

describe("weekdaySlots", () => {
  it("spreads sessions across the week rather than bunching them", () => {
    expect(weekdaySlots(1)).toEqual([0]);
    expect(weekdaySlots(2)).toEqual([0, 4]);
    expect(weekdaySlots(3)).toEqual([0, 2, 5]);
    expect(weekdaySlots(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("clamps out-of-range input instead of producing a broken schedule", () => {
    expect(weekdaySlots(0)).toEqual([0]);
    expect(weekdaySlots(99)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("buildPlan", () => {
  it("schedules two sittings per module by default", () => {
    const { sessions } = buildPlan(MODULES, opts());
    expect(sessions).toHaveLength(MODULES.length * DEFAULT_SESSIONS_PER_MODULE);
  });

  it("puts each module's two sittings on different days", () => {
    // The rule this default exists for: mastery needs at-criterion attempts on
    // two distinct calendar days, so a plan that stacks both sittings on one day
    // would look complete and never produce mastery.
    const { sessions, warnings } = buildPlan(MODULES, opts());
    for (const moduleKey of MODULES) {
      const days = new Set(sessions.filter((s) => s.moduleKey === moduleKey).map((s) => s.dateKey));
      expect(days.size).toBe(2);
    }
    expect(warnings).toEqual([]);
  });

  it("interleaves modules instead of blocking one module's sittings together", () => {
    const { sessions } = buildPlan(MODULES, opts());
    // First pass covers every module before any module repeats.
    const firstSix = sessions.slice(0, MODULES.length).map((s) => s.moduleKey);
    expect(new Set(firstSix).size).toBe(MODULES.length);
  });

  it("warns — but still schedules — when one sitting per module is requested", () => {
    const { sessions, warnings } = buildPlan(MODULES, opts({ sessionsPerModule: 1 }));
    expect(sessions).toHaveLength(MODULES.length);
    expect(warnings.join(" ")).toMatch(/two distinct calendar days/i);
  });

  it("respects the requested cadence", () => {
    const { sessions } = buildPlan(MODULES, opts({ sessionsPerWeek: 2 }));
    const firstWeek = sessions.filter((s) => s.dateKey < "2026-08-10");
    expect(firstWeek).toHaveLength(2);
  });

  it("carries the requested time of day and a realistic duration", () => {
    const { sessions } = buildPlan(MODULES, opts({ timeOfDay: "07:30" }));
    expect(sessions[0].timeOfDay).toBe("07:30");
    // An honest slot for a five-minute sitting, not a zero-minute one.
    expect(sessions[0].estimatedTimeMinutes).toBeGreaterThan(0);
    expect(sessions[0].estimatedTimeMinutes).toBeLessThanOrEqual(1440);
  });

  it("rejects malformed dates and times rather than scheduling nonsense", () => {
    expect(() => buildPlan(MODULES, opts({ startDateKey: "03-08-2026" }))).toThrow(/YYYY-MM-DD/);
    expect(() => buildPlan(MODULES, opts({ timeOfDay: "9am" }))).toThrow(/HH:mm/);
    expect(() => buildPlan(MODULES, opts({ timeOfDay: "24:00" }))).toThrow(/HH:mm/);
  });

  it("returns nothing for an empty module list", () => {
    expect(buildPlan([], opts()).sessions).toEqual([]);
  });

  it("produces dates in ascending order", () => {
    const { sessions } = buildPlan(MODULES, opts());
    const dates = sessions.map((s) => s.dateKey);
    expect([...dates].sort()).toEqual(dates);
  });
});
