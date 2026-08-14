import { setHours, setMinutes } from "date-fns";
import { useState } from "react";
import type { CalendarItem } from "./calendarTypes";
import CalendarEvent from "./CalendarEvent";
import { useTranslation } from "react-i18next";
import { useAppDate } from "~/i18n/useAppDate";
// Gregorian day keys: compared against each other and sent as `dateKey`s.
import { toLocalDateString } from "~/utils/dateUtils";
import { Spinner } from "~/components/ui/spinner";

const PERIOD_MINUTES = 90; /* 1.5 hours for day view */

const toDateKey = toLocalDateString;

function eventsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  const key = toDateKey(day);
  return items.filter((e) => {
    const startKey = toDateKey(e.start);
    const endKey = toDateKey(e.end);
    return key >= startKey && key <= endKey;
  });
}

/** Sort: timed first (by start time), then untimed (allDay) at the end. */
function sortDayEvents(events: CalendarItem[]): CalendarItem[] {
  const timed = events.filter((e) => !e.allDay).sort((a, b) => a.start.getTime() - b.start.getTime());
  const untimed = events.filter((e) => e.allDay);
  return [...timed, ...untimed];
}

/** Timed events that overlap the [periodStart, periodEnd) interval on the given day. */
function eventsInPeriod(events: CalendarItem[], day: Date, periodStart: Date, periodEnd: Date): CalendarItem[] {
  const dayKey = toDateKey(day);
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  return events.filter((e) => {
    if (e.allDay) return false;
    const eStart = e.start.getTime();
    const eEnd = e.end.getTime();
    return toDateKey(e.start) === dayKey && eStart < endMs && eEnd > startMs;
  });
}

interface WeekDayListViewProps {
  currentDate: Date;
  items: CalendarItem[];
  isDayView: boolean;
  manageMode?: boolean;
  managedActionOptions?: { id: string; title: string }[];
  onAssignActionToDate?: (actionId: string, dateKey: string) => void;
  onReturnActionToQueue?: (actionId: string) => void;
  assigningActionIds?: Set<string>;
}

export default function WeekDayListView({
  currentDate,
  items,
  isDayView,
  manageMode = false,
  managedActionOptions = [],
  onAssignActionToDate,
  onReturnActionToQueue,
  assigningActionIds,
}: WeekDayListViewProps) {
  const { t } = useTranslation();
  const { dfns, locale, weekStartsOn, fmt } = useAppDate();
  const [dayPickerValue, setDayPickerValue] = useState<Record<string, string>>({});
  const todayKey = toDateKey(new Date());
  const weekStart = dfns.startOfWeek(currentDate, { weekStartsOn });
  const days = isDayView
    ? [currentDate]
    : Array.from({ length: 7 }, (_, i) => dfns.addDays(weekStart, i));

  /* Day view: 16 × 1.5 hour periods (00:00–01:30, 01:30–03:00, …) */
  if (isDayView) {
    const dayEvents = sortDayEvents(eventsOnDay(items, currentDate));
    const untimed = dayEvents.filter((e) => e.allDay);
    const dayKey = toDateKey(currentDate);
    const canAssign = dayKey >= todayKey;
    const periods = Array.from({ length: 16 }, (_, i) => {
      const startMin = i * PERIOD_MINUTES;
      const endMin = startMin + PERIOD_MINUTES;
      const start = setMinutes(setHours(new Date(currentDate), Math.floor(startMin / 60)), startMin % 60);
      const end = setMinutes(setHours(new Date(currentDate), Math.floor(endMin / 60)), endMin % 60);
      return { start, end, label: `${fmt(start, "time")} – ${fmt(end, "time")}` };
    });

    return (
      <div className="flex flex-col gap-3 overflow-auto flex-1 min-h-0">
        {periods.map((period, i) => {
          const periodEvents = sortDayEvents(eventsInPeriod(items, currentDate, period.start, period.end));
          return (
            <div key={i} className="border rounded-lg overflow-hidden bg-card flex flex-col min-w-0 shrink-0">
              <div className="bg-muted/60 px-3 py-1.5 text-xs font-medium shrink-0">
                {period.label}
              </div>
              <div className="p-2 space-y-1 min-h-0">
                {periodEvents.length === 0 ? (
                  <p className="text-muted-foreground text-xs">—</p>
                ) : (
                  <ul className="space-y-1">
                    {periodEvents.map((ev) => (
                      <li key={ev.id}>
                        {manageMode && ev.type === "action" && ev.entityId ? (
                          <div className="inline-flex items-center gap-1">
                            {ev.allDay ? (
                              <CalendarEvent event={ev} className="!text-xs" />
                            ) : (
                              <>
                                <span className="text-xs text-muted-foreground mr-1">{fmt(ev.start, "time")}</span>
                                <CalendarEvent event={ev} className="!text-xs inline-block" />
                              </>
                            )}
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
                          ev.allDay ? (
                            <CalendarEvent event={ev} className="!text-xs" />
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground mr-1">{fmt(ev.start, "time")}</span>
                              <CalendarEvent event={ev} className="!text-xs inline-block" />
                            </>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
        {untimed.length > 0 && (
          <div className="border rounded-lg overflow-hidden bg-card flex flex-col min-w-0 shrink-0">
            <div className="bg-muted/60 px-3 py-1.5 text-xs font-medium shrink-0">{t("calendar.untimed")}</div>
            <div className="p-2">
              <ul className="space-y-1">
                {untimed.map((ev) => (
                  <li key={ev.id}>
                    {manageMode && ev.type === "action" && ev.entityId ? (
                      <div className="inline-flex items-center gap-1">
                        <CalendarEvent event={ev} className="!text-xs" />
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
                      <CalendarEvent event={ev} className="!text-xs" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {manageMode && (
          <div className="border rounded-lg overflow-hidden bg-card flex flex-col min-w-0 shrink-0">
            <div className="bg-muted/60 px-3 py-1.5 text-xs font-medium shrink-0">{t("calendar.assignAction")}</div>
            <div className="p-2">
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
                    key={`${toDateKey(currentDate)}-${action.id}`}
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
          </div>
        )}
      </div>
    );
  }

  /* Week view: 3 columns → rows of 3, 3, 1 */
  return (
    <div className="grid gap-4 overflow-auto flex-1 min-h-0 content-start"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      {days.map((day) => {
        const dayKey = toDateKey(day);
        const canAssign = dayKey >= todayKey;
        const dayEvents = sortDayEvents(eventsOnDay(items, day));
        const timed = dayEvents.filter((e) => !e.allDay);
        const untimed = dayEvents.filter((e) => e.allDay);
        return (
          <div key={dayKey} className="border rounded-lg overflow-hidden bg-card flex flex-col min-w-0">
            <div className="bg-muted/60 px-3 py-2 text-sm font-medium shrink-0">
              {fmt(day, "weekdayShortDayMonth")}
            </div>
            <div className="p-2 space-y-2 overflow-auto flex-1 min-h-0">
              {timed.length > 0 && (
                <ul className="space-y-1">
                  {timed.map((ev) => (
                    <li key={ev.id}>
                      {manageMode && ev.type === "action" && ev.entityId ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">
                            {fmt(ev.start, "time")}
                          </span>
                          <CalendarEvent event={ev} className="!text-xs inline-block" />
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
                        <>
                          <span className="text-xs text-muted-foreground mr-1">
                            {fmt(ev.start, "time")}
                          </span>
                          <CalendarEvent event={ev} className="!text-xs inline-block" />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {timed.length > 0 && untimed.length > 0 && (
                <div className="border-t border-border my-2 pt-2" aria-hidden />
              )}
              {untimed.length > 0 && (
                <ul className="space-y-1">
                  {untimed.map((ev) => (
                    <li key={ev.id}>
                      {manageMode && ev.type === "action" && ev.entityId ? (
                        <div className="inline-flex items-center gap-1">
                          <CalendarEvent event={ev} className="!text-xs" />
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
                        <CalendarEvent event={ev} className="!text-xs" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {dayEvents.length === 0 && (
                <p className="text-muted-foreground text-xs">{t("calendar.noItems")}</p>
              )}
            </div>
            {manageMode && (
              <div className="border-t p-2">
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
  );
}
