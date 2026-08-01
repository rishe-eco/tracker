import type { CalendarItem, CalendarItemType } from "./calendarTypes";
import { CALENDAR_TYPE_COLORS } from "./calendarTypes";
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
};

export default function CalendarEvent({ event, title, className }: CalendarEventProps) {
  const type = event.type ?? "action";
  const label = TYPE_LABELS[type];
  const text = title ?? event.title ?? "";

  return (
    <div
      className={cn(
        "rounded border px-1 py-0.5 text-xs font-medium truncate min-h-[1.25rem] flex items-center gap-1",
        CALENDAR_TYPE_COLORS[type],
        className
      )}
      title={`${label}: ${text}`}
    >
      <span className="truncate">{text}</span>
    </div>
  );
}
