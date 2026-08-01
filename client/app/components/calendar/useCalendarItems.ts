import { useEffect, useState, useMemo } from "react";
import { addDays, addMonths, startOfMonth, endOfMonth, setHours, setMinutes, format } from "date-fns";
import { parseDateOnly } from "~/utils/dateUtils";
import { useApi } from "~/api/useApi";
import {
  GET_GOALS,
  GET_ACTIONS,
  GET_INTERVALS,
  GET_ROUTINES,
} from "~/api/queries";
import type { CalendarItem, CalendarFilters } from "./calendarTypes";

// ---- Interval recurrence helpers (ported from actionGathering.ts) ----

function getISODayOfWeek(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

export function dateMatchesRepeatFromAnchor(anchor: Date, date: Date, repeatValue: number, repeatUnit: string): boolean {
  const anchorDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  const targetDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (targetDay < anchorDay) return false;
  const diffDays = Math.round((targetDay.getTime() - anchorDay.getTime()) / (24 * 60 * 60 * 1000));
  switch (repeatUnit) {
    case "day":
      return diffDays % repeatValue === 0;
    case "week": {
      const diffWeeks = diffDays / 7;
      return Number.isInteger(diffWeeks) && diffWeeks % repeatValue === 0;
    }
    case "month": {
      const months =
        (targetDay.getUTCFullYear() - anchorDay.getUTCFullYear()) * 12 +
        (targetDay.getUTCMonth() - anchorDay.getUTCMonth());
      return months >= 0 && months % repeatValue === 0 && targetDay.getUTCDate() === anchorDay.getUTCDate();
    }
    default:
      return false;
  }
}

export function intervalOccursOnDate(
  iv: {
    customRepeatDates: string[];
    customRepeatRule: string | null;
    repeatValue: number;
    repeatUnit: string | null;
    endTime: string | null;
    createdAt: string;
  },
  dateKey: string
): boolean {
  const date = new Date(dateKey + "T12:00:00.000Z");
  const endTime = toDateSafe(iv.endTime);
  if (endTime && date > endTime) return false;

  const customDates = iv.customRepeatDates ?? [];
  if (customDates.length > 0) {
    return customDates.some((s) => String(s).slice(0, 10) === dateKey);
  }

  if (iv.customRepeatRule) {
    try {
      const rule = JSON.parse(iv.customRepeatRule) as {
        unit?: string;
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        months?: number[];
      };
      const anchor = new Date(iv.createdAt);
      if (rule.unit === "week" && Array.isArray(rule.daysOfWeek)) {
        if (!rule.daysOfWeek.includes(getISODayOfWeek(date))) return false;
        if (!iv.repeatUnit || iv.repeatValue <= 0) return true;
        return dateMatchesRepeatFromAnchor(anchor, date, iv.repeatValue, iv.repeatUnit);
      }
      if (rule.unit === "month" && Array.isArray(rule.daysOfMonth)) {
        if (!rule.daysOfMonth.includes(date.getUTCDate())) return false;
        if (!iv.repeatUnit || iv.repeatValue <= 0) return true;
        return dateMatchesRepeatFromAnchor(anchor, date, iv.repeatValue, iv.repeatUnit);
      }
      if (rule.unit === "year" && Array.isArray(rule.months)) {
        const month = date.getUTCMonth() + 1;
        if (!rule.months.includes(month)) return false;
        if (Array.isArray(rule.daysOfMonth) && rule.daysOfMonth.length > 0) {
          if (!rule.daysOfMonth.includes(date.getUTCDate())) return false;
        }
        if (!iv.repeatUnit || iv.repeatValue <= 0) return true;
        return dateMatchesRepeatFromAnchor(anchor, date, iv.repeatValue, iv.repeatUnit);
      }
    } catch {
      // fall through
    }
  }

  if (iv.repeatUnit && iv.repeatValue > 0) {
    return dateMatchesRepeatFromAnchor(new Date(iv.createdAt), date, iv.repeatValue, iv.repeatUnit);
  }

  return false;
}

export function getIntervalOccurrenceTimes(iv: { customRepeatRule: string | null; predictedToDoTime: string | null }): string[] {
  let blocks: string[] = [];
  if (iv.customRepeatRule) {
    try {
      const rule = JSON.parse(iv.customRepeatRule) as { timeOfDayBlocks?: string[] };
      if (Array.isArray(rule.timeOfDayBlocks)) {
        blocks = rule.timeOfDayBlocks
          .map((s) => String(s).trim().slice(0, 5))
          .filter((s) => /^\d{2}:\d{2}$/.test(s));
      }
    } catch { }
  }
  if (blocks.length === 0) {
    const fallback = iv.predictedToDoTime && /^\d{2}:\d{2}$/.test(iv.predictedToDoTime)
      ? iv.predictedToDoTime
      : "09:00";
    blocks = [fallback];
  }
  return blocks;
}

/** Default range: 3 months back, 6 months forward. */
function defaultRange(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: addMonths(startOfMonth(now), -3),
    end: addMonths(endOfMonth(now), 6),
  };
}

/** Add minutes to a date (same day). */
function addMinutesToDate(d: Date, minutes: number): Date {
  const out = new Date(d);
  out.setMinutes(out.getMinutes() + minutes);
  return out;
}

function toDateSafe(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function useCalendarItems(
  dateRange: { start: Date; end: Date } | null,
  filters: CalendarFilters,
  refreshKey = 0
) {
  const { call } = useApi();
  const [goalsRaw, setGoalsRaw] = useState<any[]>([]);
  const [actionsRaw, setActionsRaw] = useState<any[]>([]);
  const [intervalsRaw, setIntervalsRaw] = useState<any[]>([]);
  const [routinesRaw, setRoutinesRaw] = useState<any[]>([]);

  useEffect(() => {
    call({ query: GET_GOALS }).then((res) => setGoalsRaw(res?.goals ?? []));
    call({ query: GET_ACTIONS }).then((res) => setActionsRaw(res?.actions ?? []));
    call({ query: GET_INTERVALS }).then((res) => setIntervalsRaw(res?.intervals ?? []));
    call({ query: GET_ROUTINES }).then((res) => setRoutinesRaw(res?.routines ?? []));
  }, [call, refreshKey]);

  const range = dateRange ?? defaultRange();

  const items = useMemo(() => {
    const list: CalendarItem[] = [];
    const rangeStart = range.start.getTime();
    const rangeEnd = range.end.getTime();

    // —— Goals & milestones ——
    if (filters.goalsMilestones) {
      for (const g of goalsRaw) {
        const goalStart = g.startDate ? parseDateOnly(g.startDate) : null;
        const goalEnd = g.endDate ? parseDateOnly(g.endDate) : null;
        if (goalStart && goalEnd) {
          const start = goalStart.getTime();
          const end = goalEnd.getTime();
          if (start <= rangeEnd && end >= rangeStart) {
            list.push({
              id: `goal-${g.id}`,
              type: "goal",
              title: g.title ?? "Goal",
              start: goalStart,
              end: addDays(goalEnd, 1),
              entityId: g.id,
              allDay: true,
            });
          }
        }
        const milestones = g.milestones ?? [];
        for (const m of milestones) {
          // Only use predictionDate for calendar placement; doa is a free-text description field, not a date.
          const d = m.predictionDate ? parseDateOnly(m.predictionDate) : null;
          if (d) {
            const t = d.getTime();
            if (t >= rangeStart && t <= rangeEnd) {
              list.push({
                id: `milestone-${m.id}`,
                type: "milestone",
                title: m.title ?? "Milestone",
                start: d,
                end: addDays(d, 1),
                entityId: m.id,
                allDay: true,
              });
            }
          }
        }
      }
    }

    // —— Actions (tbd + optional startTimeOfDay + estimatedTimeMinutes) ——
    if (filters.actions) {
      for (const a of actionsRaw) {
        const tbd = a.tbd ? parseDateOnly(a.tbd) : null;
        if (!tbd) continue;
        const t = tbd.getTime();
        if (t < rangeStart || t > rangeEnd) continue;
        const estMin = a.estimatedTimeMinutes ?? 60;
        const timeStr = a.startTimeOfDay && /^\d{1,2}:\d{2}/.test(String(a.startTimeOfDay)) ? String(a.startTimeOfDay).trim().slice(0, 5) : null;
        const start = timeStr
          ? setMinutes(setHours(new Date(tbd), parseInt(timeStr.slice(0, 2), 10)), parseInt(timeStr.slice(3, 5), 10))
          : new Date(tbd.getFullYear(), tbd.getMonth(), tbd.getDate(), 9, 0);
        const end = addMinutesToDate(start, estMin);
        list.push({
          id: `action-${a.id}`,
          type: "action",
          title: a.title ?? "Action",
          start,
          end,
          entityId: a.id,
          allDay: !timeStr,
        });
      }
    }

    // —— Intervals (full recurrence expansion, capped 90 days forward) ——
    if (filters.intervals) {
      const ninetyDaysOut = addDays(new Date(), 90).getTime();
      const effectiveRangeEnd = Math.min(rangeEnd, ninetyDaysOut);
      for (const iv of intervalsRaw) {
        if (iv.status !== "active") continue;
        const estMin: number = iv.estimatedTimeMinutes ?? 60;
        let d = new Date(range.start);
        d.setHours(0, 0, 0, 0);
        while (d.getTime() <= effectiveRangeEnd) {
          const dateKey = format(d, "yyyy-MM-dd");
          if (intervalOccursOnDate(iv, dateKey)) {
            const times = getIntervalOccurrenceTimes(iv);
            for (const timeStr of times) {
              const [h, m] = timeStr.split(":").map((x: string) => parseInt(x, 10) || 0);
              const start = setMinutes(setHours(new Date(d), h), m);
              const end = addMinutesToDate(start, estMin);
              list.push({
                id: `interval-${iv.id}-${dateKey}-${timeStr}`,
                type: "interval",
                title: iv.title ?? "Interval",
                start,
                end,
                entityId: iv.id,
              });
            }
          }
          d = addDays(d, 1);
        }
      }
    }

    // —— Routines (timeOfDayBlocks × each day in range) ——
    if (filters.routines) {
      const blocks = (r: any): string[] => {
        const b = r.timeOfDayBlocks;
        if (Array.isArray(b) && b.length) return b.map(String);
        return [];
      };
      const estMin = (r: any) => r.estimatedTimeMinutes ?? 30;
      for (const r of routinesRaw) {
        if (r.status !== "active") continue;
        const times = blocks(r);
        if (!times.length) continue;
        const routineEnd = toDateSafe(r.endTime);
        let d = new Date(range.start);
        d.setHours(0, 0, 0, 0);
        while (d.getTime() <= rangeEnd) {
          if (routineEnd && d.getTime() > routineEnd.getTime()) break;
          const dateKey = format(d, "yyyy-MM-dd");
          for (const timeStr of times) {
            const [h, m] = timeStr.split(":").map((x: string) => parseInt(x, 10) || 0);
            const start = setMinutes(setHours(new Date(d), h), m);
            const end = addMinutesToDate(start, estMin(r));
            list.push({
              id: `routine-${r.id}-${dateKey}-${timeStr}`,
              type: "routine",
              title: r.title ?? "Routine",
              start,
              end,
              entityId: r.id,
            });
          }
          d = addDays(d, 1);
        }
      }
    }

    return list;
  }, [
    goalsRaw,
    actionsRaw,
    intervalsRaw,
    routinesRaw,
    range.start,
    range.end,
    filters.goalsMilestones,
    filters.actions,
    filters.intervals,
    filters.routines,
  ]);

  return { items, loading: false };
}
