/**
 * The month grid, replacing react-big-calendar's.
 *
 * RBC could not be made to do this. Its `dateFnsLocalizer` injects only
 * `format` and `firstOfWeek`; every boundary the month view depends on —
 * `firstVisibleDay`, `lastVisibleDay`, the month range itself — comes from
 * RBC's own `utils/dates`, which does native `Date` month arithmetic. Under a
 * Jalali setting that produced a grid running 1–31 August with Jalali day
 * numbers printed inside it: a month that exists in neither calendar.
 *
 * So the grid is built here from the injected function set instead, which makes
 * it right in both and leaves one code path to maintain rather than two.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarItem } from "./calendarTypes";
import CalendarEvent from "./CalendarEvent";
import CalendarToolbar from "./CalendarToolbar";
import { useAppDate } from "~/i18n/useAppDate";
import { buildMonthGrid } from "~/lib/monthGrid";
import { toLocalDateString } from "~/utils/dateUtils";
import { cn } from "~/lib/utils";

const EVENTS_BEFORE_OVERFLOW = 3;

interface MonthGridViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onNavigate: (date: Date) => void;
}

export default function MonthGridView({ currentDate, items, onNavigate }: MonthGridViewProps) {
  const { t } = useTranslation();
  const { dfns, locale, weekStartsOn, fmt } = useAppDate();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const grid = useMemo(
    () => buildMonthGrid(dfns, currentDate, weekStartsOn),
    [dfns, currentDate, weekStartsOn]
  );

  // Day keys are Gregorian throughout — they are only ever compared with each
  // other, and building them from the active calendar would make the same day
  // hash differently after a settings change.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const day of grid.weeks.flat()) {
      const key = toLocalDateString(day);
      const onDay = items.filter(
        (e) => toLocalDateString(e.start) <= key && key <= toLocalDateString(e.end)
      );
      if (onDay.length) map.set(key, onDay);
    }
    return map;
  }, [grid, items]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <CalendarToolbar
        label={fmt(grid.monthStart, "monthYear")}
        onNavigate={(action) => {
          if (action === "PREV") onNavigate(dfns.addMonths(currentDate, -1));
          else if (action === "NEXT") onNavigate(dfns.addMonths(currentDate, 1));
          else if (action === "TODAY") onNavigate(new Date());
        }}
      />

      <div className="grid grid-cols-7 border-b">
        {grid.weekdays.map((day) => (
          <div
            key={`head-${day.getTime()}`}
            className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {dfns.format(day, "EEE", { locale })}
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-auto">
        {grid.weeks.flat().map((day) => {
          const key = toLocalDateString(day);
          const dayEvents = byDay.get(key) ?? [];
          const inMonth = dfns.isSameMonth(day, currentDate);
          const isToday = dfns.isToday(day);
          const expanded = expandedDay === key;
          const shown = expanded ? dayEvents : dayEvents.slice(0, EVENTS_BEFORE_OVERFLOW);

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[5.5rem] min-w-0 flex-col border-b border-e p-1.5 last:border-e-0",
                inMonth ? "bg-background" : "bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "mb-1 self-start rounded px-1 text-xs font-medium",
                  isToday && "bg-primary text-primary-foreground",
                  !isToday && inMonth && "text-foreground",
                  !isToday && !inMonth && "text-muted-foreground/60"
                )}
              >
                {dfns.format(day, "d", { locale })}
              </div>

              <ul className="min-h-0 space-y-0.5 overflow-auto">
                {shown.map((ev) => (
                  <li key={ev.id} className="min-w-0">
                    <CalendarEvent event={ev} className="!px-1 !py-0.5 !text-xs" />
                  </li>
                ))}
              </ul>

              {dayEvents.length > EVENTS_BEFORE_OVERFLOW && (
                <button
                  type="button"
                  onClick={() => setExpandedDay(expanded ? null : key)}
                  className="mt-0.5 self-start text-[10px] text-muted-foreground hover:underline"
                >
                  {expanded
                    ? t("calendar.showLess")
                    : t("calendar.moreItems", {
                        count: dayEvents.length - EVENTS_BEFORE_OVERFLOW,
                      })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
