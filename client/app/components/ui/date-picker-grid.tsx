/**
 * A month grid you can click a day out of, in whichever calendar is set.
 *
 * Two callers: the popover inside `DateField`, and the inline picker in
 * `ActionForm`. It replaced `~/components/ui/calendar.tsx` (a `react-day-picker`
 * wrapper), which could render Persian month *names* but not Persian months —
 * v8 computes its grid with its own Gregorian arithmetic, the same wall
 * react-big-calendar hit.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { useAppDate } from "~/i18n/useAppDate";
import { buildMonthGrid } from "~/lib/monthGrid";

export type DatePickerGridProps = {
  /** The selected day, or null. */
  selected: Date | null;
  onSelect: (day: Date) => void;
  /** Inclusive bounds. Days outside them are shown but not selectable. */
  min?: Date | null;
  max?: Date | null;
  className?: string;
};

export function DatePickerGrid({
  selected,
  onSelect,
  min,
  max,
  className,
}: DatePickerGridProps) {
  const { t, i18n } = useTranslation();
  const { dfns, locale, weekStartsOn, fmt } = useAppDate();

  // Direction follows the document, not the calendar: Jalali does not imply
  // RTL, and an English-reading user on an Iranian calendar reads left to right.
  const isRtl = i18n.dir() === "rtl";
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const [viewMonth, setViewMonth] = React.useState<Date>(() => selected ?? new Date());
  React.useEffect(() => {
    if (selected) setViewMonth(selected);
  }, [selected]);

  const outOfRange = React.useCallback(
    (day: Date) => {
      if (min && day < dfns.startOfDay(min)) return true;
      if (max && day > dfns.startOfDay(max)) return true;
      return false;
    },
    [min, max, dfns]
  );

  const grid = React.useMemo(
    () => buildMonthGrid(dfns, viewMonth, weekStartsOn),
    [dfns, viewMonth, weekStartsOn]
  );

  return (
    <div className={cn("p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={t("calendar.previous")}
          onClick={() => setViewMonth((d) => dfns.addMonths(d, -1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
        >
          <PrevIcon className="h-4 w-4" aria-hidden />
        </button>
        <span className="text-sm font-medium">{fmt(viewMonth, "monthYear")}</span>
        <button
          type="button"
          aria-label={t("calendar.next")}
          onClick={() => setViewMonth((d) => dfns.addMonths(d, 1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
        >
          <NextIcon className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {grid.weekdays.map((d) => (
          <div
            key={`h-${d.getTime()}`}
            className="py-1 text-[0.7rem] font-normal text-muted-foreground"
          >
            {dfns.format(d, "EEEEEE", { locale })}
          </div>
        ))}
        {grid.weeks.flat().map((day) => {
          const inMonth = dfns.isSameMonth(day, viewMonth);
          const isSelected = selected != null && dfns.isSameDay(day, selected);
          const blocked = outOfRange(day);
          return (
            <button
              key={day.getTime()}
              type="button"
              disabled={blocked}
              aria-current={dfns.isToday(day) ? "date" : undefined}
              aria-pressed={isSelected}
              onClick={() => onSelect(day)}
              className={cn(
                "h-8 w-8 rounded-md text-sm transition-colors",
                !inMonth && "text-muted-foreground/50",
                dfns.isToday(day) && !isSelected && "bg-accent text-accent-foreground",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && !blocked && "hover:bg-muted",
                blocked && "cursor-not-allowed opacity-40"
              )}
            >
              {dfns.format(day, "d", { locale })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
