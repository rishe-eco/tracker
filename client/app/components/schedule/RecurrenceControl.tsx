import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DateTimeField } from "~/components/ui/date-field";
import { cn } from "~/lib/utils";

/** Format Date or ISO string for input[type="datetime-local"] (local time). */
export function toDateTimeLocal(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return "";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** Parse a datetime-local input value to an ISO string. */
export function fromDateTimeLocal(s: string): string {
  if (!s) return "";
  return new Date(s).toISOString();
}

/**
 * The recurrence control shared by the Interval editor and the Time Theme
 * editor (time-themes-build-plan.md Phase 6, item 4): "repeatValue /
 * repeatUnit / customRepeatRule / customRepeatDates / endTime" is exactly the
 * field set a TimeTheme carries (mirroring Interval's so the server can reuse
 * `intervalOccursOnDate` verbatim). Extracted out of IntervalForm.tsx rather
 * than duplicated, so the two editors can never drift on what these fields
 * mean.
 *
 * A Time Theme has no per-occurrence time-of-day blocks (it has a single
 * startTimeOfDay→endTimeOfDay span instead) — pass `showTimeOfDayBlocks=false`
 * to hide that sub-section.
 */

export const REPEAT_UNIT_KEYS = ["minute", "hour", "day", "week", "month", "year"] as const;
export const DAY_LABEL_KEYS = ["dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat", "daySun"] as const;
export const MONTH_LABEL_KEYS = [
  "monthJan", "monthFeb", "monthMar", "monthApr", "monthMay", "monthJun",
  "monthJul", "monthAug", "monthSep", "monthOct", "monthNov", "monthDec",
] as const;

export interface RecurrenceControlProps {
  repeatValue: number;
  onRepeatValueChange: (v: number) => void;
  repeatUnit: string;
  onRepeatUnitChange: (v: string) => void;
  daysOfWeek: number[];
  onDaysOfWeekChange: (v: number[]) => void;
  daysOfMonth: number[];
  onDaysOfMonthChange: (v: number[]) => void;
  months: number[];
  onMonthsChange: (v: number[]) => void;
  yearDaysOfMonth: number[];
  onYearDaysOfMonthChange: (v: number[]) => void;
  customRepeatDates: string[];
  onAddCustomDate: () => void;
  onCustomDateChange: (index: number, value: string) => void;
  onRemoveCustomDate: (index: number) => void;
  minDateTimeLocal: string;
  toDateTimeLocal: (isoOrDate: string | Date | null | undefined) => string;
  /** Interval-only: per-occurrence time-of-day blocks. Omit for Time Themes. */
  timeOfDayBlocks?: string[];
  onTimeOfDayBlocksChange?: (blocks: string[]) => void;
  showTimeOfDayBlocks?: boolean;
}

export default function RecurrenceControl({
  repeatValue,
  onRepeatValueChange,
  repeatUnit,
  onRepeatUnitChange,
  daysOfWeek,
  onDaysOfWeekChange,
  daysOfMonth,
  onDaysOfMonthChange,
  months,
  onMonthsChange,
  yearDaysOfMonth,
  onYearDaysOfMonthChange,
  customRepeatDates,
  onAddCustomDate,
  onCustomDateChange,
  onRemoveCustomDate,
  minDateTimeLocal,
  toDateTimeLocal,
  timeOfDayBlocks = [],
  onTimeOfDayBlocksChange,
  showTimeOfDayBlocks = true,
}: RecurrenceControlProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="repeatValue" className="flex items-center gap-2">
          {t("intervals.every")}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="repeatValue"
            type="number"
            min={1}
            value={repeatValue}
            onChange={(e) => onRepeatValueChange(parseInt(e.target.value, 10) || 1)}
            className="w-20"
          />
          <select
            value={repeatUnit}
            onChange={(e) => {
              const v = e.target.value;
              onRepeatUnitChange(v);
              if (v !== "week") onDaysOfWeekChange([]);
              if (v !== "month") onDaysOfMonthChange([]);
              if (v !== "year") {
                onMonthsChange([]);
                onYearDaysOfMonthChange([]);
              }
            }}
            className={cn(
              "flex h-9 flex-1 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {REPEAT_UNIT_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(`intervals.repeatUnit${key.charAt(0).toUpperCase() + key.slice(1)}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {repeatUnit === "week" && (
        <div className="space-y-2">
          <Label>{t("intervals.onDaysOfWeek")}</Label>
          <div className="flex flex-wrap gap-2">
            {DAY_LABEL_KEYS.map((key, i) => {
              const value = i + 1;
              const selected = daysOfWeek.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    onDaysOfWeekChange(
                      selected ? daysOfWeek.filter((x) => x !== value) : [...daysOfWeek, value].sort((a, b) => a - b)
                    )
                  }
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {t(`intervals.${key}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {repeatUnit === "month" && (
        <div className="space-y-2">
          <Label>{t("intervals.onDaysOfMonth")}</Label>
          <div className="flex flex-wrap gap-1.5 max-w-md">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const selected = daysOfMonth.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    onDaysOfMonthChange(selected ? daysOfMonth.filter((x) => x !== day) : [...daysOfMonth, day].sort((a, b) => a - b))
                  }
                  className={cn(
                    "min-w-[2rem] rounded-md px-2 py-1 text-sm font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {repeatUnit === "year" && (
        <>
          <div className="space-y-2">
            <Label>{t("intervals.inMonths")}</Label>
            <div className="flex flex-wrap gap-2">
              {MONTH_LABEL_KEYS.map((key, i) => {
                const value = i + 1;
                const selected = months.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      onMonthsChange(selected ? months.filter((x) => x !== value) : [...months, value].sort((a, b) => a - b))
                    }
                    className={cn(
                      "rounded-md px-2 py-1 text-sm font-medium transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {t(`intervals.${key}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("intervals.onDaysOfMonth")}</Label>
            <div className="flex flex-wrap gap-1.5 max-w-md">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const selected = yearDaysOfMonth.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      onYearDaysOfMonthChange(
                        selected ? yearDaysOfMonth.filter((x) => x !== day) : [...yearDaysOfMonth, day].sort((a, b) => a - b)
                      )
                    }
                    className={cn(
                      "min-w-[2rem] rounded-md px-2 py-1 text-sm font-medium transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {showTimeOfDayBlocks && (
        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="recurrenceTimeBlock-0" className="flex items-center gap-2">
            {t("intervals.timeOfDayBlocksOptional")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("intervals.timeBlocksRepeatHelp")}</p>
          {timeOfDayBlocks.map((block, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Label htmlFor={`recurrenceTimeBlock-${i}`} className="sr-only">
                {t("intervals.timeBlockLabel", { n: i + 1 })}
              </Label>
              <Input
                id={`recurrenceTimeBlock-${i}`}
                type="time"
                value={block}
                onChange={(e) => {
                  const next = e.target.value;
                  onTimeOfDayBlocksChange?.(timeOfDayBlocks.map((t2, j) => (j === i ? next : t2)));
                }}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onTimeOfDayBlocksChange?.(timeOfDayBlocks.filter((_, j) => j !== i))}
                aria-label={t("intervals.removeTimeBlock")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onTimeOfDayBlocksChange?.([...timeOfDayBlocks, "09:00"])}
          >
            <Plus className="h-4 w-4 mr-2" /> {t("intervals.addTimeBlock")}
          </Button>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t">
        <Label htmlFor="customRepeatDate-0" className="flex items-center gap-2">
          {t("intervals.specificDatesOptional")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("intervals.specificDatesHelp")}</p>
        {customRepeatDates.map((iso, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Label htmlFor={`customRepeatDate-${i}`} className="sr-only">
              {t("intervals.dateLabel", { n: i + 1 })}
            </Label>
            <DateTimeField
              id={`customRepeatDate-${i}`}
              min={minDateTimeLocal}
              value={iso ? toDateTimeLocal(iso) : ""}
              onChange={(e) => onCustomDateChange(i, e.target.value)}
              className="flex-1 max-w-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemoveCustomDate(i)}
              aria-label={t("intervals.removeDate")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onAddCustomDate}>
          <Plus className="h-4 w-4 mr-2" /> {t("intervals.addDate")}
        </Button>
      </div>
    </div>
  );
}
