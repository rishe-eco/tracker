/**
 * Unified calendar item for gantt-style display.
 * Maps to react-big-calendar Event type (start, end, title) with extra fields for type and color.
 */
export type CalendarItemType = "goal" | "milestone" | "action" | "interval" | "routine";

export interface CalendarItem {
  id: string;
  type: CalendarItemType;
  title: string;
  start: Date;
  end: Date;
  /** Optional resource id for grouping; we use type for color. */
  resource?: string;
  /** Original entity id for linking (e.g. action id, goal id). */
  entityId?: string;
  /** When true, show in "untimed" section (end of day) in week/day list view. */
  allDay?: boolean;
}

/** Filter flags for which item types to show on the calendar. */
export interface CalendarFilters {
  goalsMilestones: boolean;
  actions: boolean;
  intervals: boolean;
  routines: boolean;
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  goalsMilestones: true,
  actions: true,
  intervals: true,
  routines: true,
};

/** Colors per type for gantt/calendar (Tailwind-style names for use in components). */
export const CALENDAR_TYPE_COLORS: Record<CalendarItemType, string> = {
  goal: "bg-blue-500 border-blue-600 text-white",
  milestone: "bg-purple-500 border-purple-600 text-white",
  action: "bg-emerald-600 border-emerald-700 text-white",
  interval: "bg-amber-500 border-amber-600 text-white",
  routine: "bg-teal-500 border-teal-600 text-white",
};
