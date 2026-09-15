import type { CalendarItem, CalendarItemType } from "./calendarTypes";
import { CALENDAR_TYPE_COLORS } from "./calendarTypes";
import { tagColorClasses } from "~/lib/tagPalette";
import { cn } from "~/lib/utils";

/** react-big-calendar passes event and title; our events are CalendarItem with type. */
interface CalendarEventProps {
  event: CalendarItem & { title?: string };
  title?: string;
  className?: string;
}

const TYPE_LABELS: Record<CalendarItemType, string> = {
  goal: "Goal",
  milestone: "Milestone",
  action: "Action",
  interval: "Interval",
  routine: "Routine",
  timeTheme: "Time Theme",
};

export default function CalendarEvent({ event, title, className }: CalendarEventProps) {
  const type = event.type ?? "action";
  const label = TYPE_LABELS[type];
  const text = title ?? event.title ?? "";
  // Time Themes: coloured from the theme's own (primary) tag, not the fixed
  // per-type palette — the band's colour is what makes several themes
  // distinguishable on the timeline (time-themes.md §7.5).
  const colorClasses = event.tagColorKey ? tagColorClasses(event.tagColorKey).band : CALENDAR_TYPE_COLORS[type];

  return (
    <div
      className={cn(
        "rounded border px-1 py-0.5 text-xs font-medium truncate min-h-[1.25rem] flex items-center gap-1",
        type === "timeTheme" && "border-dashed",
        colorClasses,
        className
      )}
      title={`${label}: ${text}`}
    >
      <span className="truncate">{text}</span>
    </div>
  );
}
