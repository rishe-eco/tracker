import { useState } from "react";
import type { CalendarItem } from "./calendarTypes";
import CalendarEvent from "./CalendarEvent";
import { Button } from "~/components/ui/button";
import { useAppDate } from "~/i18n/useAppDate";
import type { DateFns } from "~/lib/dateSystem";
// Day keys stay Gregorian: they are compared against each other and sent to the
// server as `dateKey`s, so they must not move when the calendar setting does.
import { toLocalDateString } from "~/utils/dateUtils";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "~/components/ui/spinner";

interface MonthWeeksViewProps {
  currentDate: Date;
  items: CalendarItem[];
  onNavigate: (date: Date) => void;
  manageMode?: boolean;
  managedActionOptions?: { id: string; title: string }[];
  onAssignActionToDate?: (actionId: string, dateKey: string) => void;
  onReturnActionToQueue?: (actionId: string) => void;
  assigningActionIds?: Set<string>;
}

/** Week blocks touching the given month, in whichever calendar is active. */
function getWeekBlocksInMonth(
  dfns: DateFns,
  month: Date,
  weekStartsOn: 0 | 6
): { start: Date; end: Date }[] {
  const monthStart = dfns.startOfMonth(month);
  const monthEnd = dfns.endOfMonth(month);
  const blocks: { start: Date; end: Date }[] = [];
  let weekStart = dfns.startOfWeek(monthStart, { weekStartsOn });
  while (weekStart.getTime() <= monthEnd.getTime()) {
    blocks.push({ start: weekStart, end: dfns.endOfWeek(weekStart, { weekStartsOn }) });
    weekStart = dfns.addWeeks(weekStart, 1);
  }
  return blocks;
}

const toDateKey = toLocalDateString;

function eventsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  const key = toDateKey(day);
  return items.filter((e) => {
    const startKey = toDateKey(e.start);
    const endKey = toDateKey(e.end);
    return key >= startKey && key <= endKey;
  });
}

export default function MonthWeeksView({
  currentDate,
  items,
  onNavigate,
  manageMode = false,
  managedActionOptions = [],
  onAssignActionToDate,
  onReturnActionToQueue,
  assigningActionIds,
}: MonthWeeksViewProps) {
  const { t } = useTranslation();
  const { dfns, locale, weekStartsOn, fmt } = useAppDate();
  const [dayPickerValue, setDayPickerValue] = useState<Record<string, string>>({});
  const monthStart = dfns.startOfMonth(currentDate);
  const weekBlocks = getWeekBlocksInMonth(dfns, currentDate, weekStartsOn);
  const todayKey = toDateKey(new Date());

  const handlePrev = () => onNavigate(dfns.addMonths(currentDate, -1));
  const handleNext = () => onNavigate(dfns.addMonths(currentDate, 1));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
            {t("calendar.previous")}
          </Button>
          <span className="font-semibold text-lg">
            {fmt(monthStart, "monthYear")}
          </span>
          <Button variant="outline" size="sm" onClick={handleNext}>
            {t("calendar.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-6 overflow-auto flex-1">
        {weekBlocks.map((block, bi) => {
          const days = Array.from({ length: 7 }, (_, i) => dfns.addDays(block.start, i));
          const weekLabel = t("calendar.weekOf", { date: fmt(block.start, "dayMonth") });
          return (
            <div key={bi} className="border rounded-lg overflow-hidden bg-card">
              <div className="bg-muted/60 px-3 py-2 text-sm font-medium">
                {weekLabel}
              </div>
              <div className="grid grid-cols-7 min-w-0">
                {days.map((day) => {
                  const dayEvents = eventsOnDay(items, day);
                  const inMonth = dfns.isSameMonth(day, currentDate);
                  const dayKey = toDateKey(day);
                  const canAssign = dayKey >= todayKey;
                  return (
                    <div
                      key={day.toISOString()}
                      className={`border-e border-border last:border-e-0 p-2 min-w-0 flex flex-col ${
                        inMonth ? "bg-background" : "bg-muted/30"
                      }`}
                    >
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {dfns.format(day, "EEE d", { locale })}
                      </div>
                      <ul className="space-y-1 overflow-auto min-h-0">
                        {dayEvents.slice(0, 6).map((ev) => (
                          <li key={ev.id} className="min-w-0">
                            {manageMode && ev.type === "action" && ev.entityId ? (
                              <div className="flex items-center gap-1">
                                <CalendarEvent event={ev} className="!text-xs !py-0.5 !px-1 flex-1" />
                                <button
                                  type="button"
                                  className="rounded px-1 text-xs text-muted-foreground hover:bg-muted"
                                  onClick={() => onReturnActionToQueue?.(ev.entityId!)}
                                  disabled={assigningActionIds?.has(ev.entityId)}
                                  aria-label={t("calendar.removeFromDay")}
                                  title={t("calendar.removeFromDay")}
                                >
                                  {assigningActionIds?.has(ev.entityId) ? <Spinner className="h-3 w-3" /> : "x"}
                                </button>
                              </div>
                            ) : (
                              <CalendarEvent event={ev} className="!text-xs !py-0.5 !px-1" />
                            )}
                          </li>
                        ))}
                        {dayEvents.length > 6 && (
                          <li className="text-muted-foreground text-xs">+{dayEvents.length - 6}</li>
                        )}
                      </ul>
                      {manageMode && (
                        <div className="mt-2">
                          <select
                            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                            value={dayPickerValue[dayKey] ?? ""}
                            onChange={(e) => {
                              const selectedActionId = e.target.value;
                              setDayPickerValue((prev) => ({ ...prev, [dayKey]: selectedActionId }));
                              if (!selectedActionId) return;
                              setDayPickerValue((prev) => ({ ...prev, [dayKey]: "" }));
                              onAssignActionToDate?.(selectedActionId, dayKey);
                            }}
                            disabled={!canAssign || managedActionOptions.length === 0}
                          >
                            <option value="">{t("calendar.selectAction")}</option>
                            {managedActionOptions.map((action) => (
                              <option
                                key={`${dayKey}-${action.id}`}
                                value={action.id}
                                disabled={assigningActionIds?.has(action.id)}
                              >
                                {assigningActionIds?.has(action.id)
                                  ? `${action.title} (${t("calendar.saving")})`
                                  : action.title}
                              </option>
                            ))}
                          </select>
                          {!canAssign && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {t("calendar.assignFromTodayOnly")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
