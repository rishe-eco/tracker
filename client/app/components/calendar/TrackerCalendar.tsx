import { useMemo, useState, useEffect } from "react";
import { useCalendarItems } from "./useCalendarItems";
import type { CalendarFilters } from "./calendarTypes";
import CalendarToolbar from "./CalendarToolbar";
import MonthGridView from "./MonthGridView";
import MonthWeeksView from "./MonthWeeksView";
import WeekDayListView from "./WeekDayListView";
import { Button } from "~/components/ui/button";
import { useTranslation } from "react-i18next";
import { useAppDate } from "~/i18n/useAppDate";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ViewType = "year" | "month" | "month_weeks" | "week" | "day";

const VIEW_OPTIONS: ViewType[] = [
  "year",
  "month",
  // { value: "month_weeks", label: "Month/Weeks" }, // temporarily hidden
  "week",
  "day",
];

const SMALL_SCREEN_BREAKPOINT = 768;

interface TrackerCalendarProps {
  filters: CalendarFilters;
  mode: "view" | "manage";
  managedActionOptions: { id: string; title: string }[];
  onAssignActionToDate: (actionId: string, dateKey: string) => void;
  onReturnActionToQueue: (actionId: string) => void;
  assigningActionIds: Set<string>;
  refreshKey: number;
}

export default function TrackerCalendar({
  filters,
  mode,
  managedActionOptions,
  onAssignActionToDate,
  onReturnActionToQueue,
  assigningActionIds,
  refreshKey,
}: TrackerCalendarProps) {
  const { t } = useTranslation();
  const { dfns, weekStartsOn, fmt } = useAppDate();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<ViewType>(() =>
    typeof window !== "undefined" && window.innerWidth < SMALL_SCREEN_BREAKPOINT ? "day" : "month"
  );

  const activeViewOptions = useMemo(() => {
    if (mode === "manage") {
      return VIEW_OPTIONS.filter((option) => option === "month" || option === "week");
    }
    return VIEW_OPTIONS;
  }, [mode]);

  useEffect(() => {
    if (activeViewOptions.some((option) => option === view)) return;
    setView(activeViewOptions[0] ?? "month");
  }, [activeViewOptions, view]);

  // The month view fetches the whole visible grid, not just the month: a week
  // row that spills into the next month would otherwise render empty. Previously
  // react-big-calendar fetched the month and quietly showed nothing in the
  // overhang.
  const range = useMemo(() => {
    if (view === "year") {
      return { start: dfns.startOfYear(currentDate), end: dfns.endOfYear(currentDate) };
    }
    if (view === "month") {
      return {
        start: dfns.startOfWeek(dfns.startOfMonth(currentDate), { weekStartsOn }),
        end: dfns.endOfWeek(dfns.endOfMonth(currentDate), { weekStartsOn }),
      };
    }
    return { start: dfns.startOfMonth(currentDate), end: dfns.endOfMonth(currentDate) };
  }, [view, currentDate, dfns, weekStartsOn]);

  const { items } = useCalendarItems(range, filters, refreshKey);

  const handleNavigateYear = (dir: -1 | 1) => {
    setCurrentDate((d) => dfns.addYears(d, dir));
  };

  if (view === "year") {
    const yearStart = dfns.startOfYear(currentDate);
    const year = fmt(yearStart, "year");
    const months = Array.from({ length: 12 }, (_, i) => {
      const start = dfns.startOfMonth(dfns.addMonths(yearStart, i));
      const end = dfns.endOfMonth(start);
      const monthEvents = items.filter(
        (e) => e.start.getTime() <= end.getTime() && e.end.getTime() >= start.getTime()
      );
      return { start, end, name: fmt(start, "month"), events: monthEvents };
    });

    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex flex-nowrap items-center justify-between gap-2 mb-4">
          <span className="font-semibold text-lg shrink-0">{year}</span>
          <span className="flex flex-nowrap items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCurrentDate(new Date())}>
              {t("calendar.today")}
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleNavigateYear(-1)}>
              <ChevronLeft className="h-4 w-4" />
              {t("calendar.previous")}
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => handleNavigateYear(1)}>
              {t("calendar.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto">
          {months.map((m) => (
            <div
              key={m.name}
              className="border rounded-lg p-3 bg-card shadow-sm min-h-[140px] flex flex-col"
            >
              <div className="font-medium text-sm text-muted-foreground mb-2">{m.name}</div>
              <ul className="text-xs space-y-1 overflow-auto flex-1">
                {m.events.slice(0, 8).map((ev) => (
                  <li key={ev.id} className="truncate" title={ev.title}>
                    {ev.title}
                  </li>
                ))}
                {m.events.length > 8 && (
                  <li className="text-muted-foreground">+{m.events.length - 8}</li>
                )}
                {m.events.length === 0 && (
                  <li className="text-muted-foreground">{t("calendar.noItems")}</li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* View controls — below calendar */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/60 shrink-0 pb-12">
          <span className="text-sm font-medium text-muted-foreground">{t("calendar.view")}:</span>
          {activeViewOptions.map((value) => (
            <Button
              key={value}
              variant={view === value ? "default" : "outline"}
              size="sm"
              onClick={() => setView(value)}
            >
              {t(`calendar.views.${value}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  /* Month/Weeks: current month in week blocks */
  if (view === "month_weeks") {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex-1 min-h-[400px] overflow-auto">
          <MonthWeeksView
            currentDate={currentDate}
            items={items}
            onNavigate={setCurrentDate}
            manageMode={mode === "manage"}
            managedActionOptions={managedActionOptions}
            onAssignActionToDate={onAssignActionToDate}
            onReturnActionToQueue={onReturnActionToQueue}
            assigningActionIds={assigningActionIds}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/60 shrink-0 pb-12">
          <span className="text-sm font-medium text-muted-foreground">{t("calendar.view")}:</span>
          {activeViewOptions.map((value) => (
            <Button
              key={value}
              variant={view === value ? "default" : "outline"}
              size="sm"
              onClick={() => setView(value)}
            >
              {t(`calendar.views.${value}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  /* Week / Day: list view, no time column, untimed at end with separator */
  if (view === "week" || view === "day") {
    const weekStart = dfns.startOfWeek(currentDate, { weekStartsOn });
    const weekLabel = view === "day"
      ? fmt(currentDate, "weekdayDayMonthYear")
      : `${fmt(weekStart, "dayMonth")} – ${fmt(dfns.addDays(weekStart, 6), "dayMonthYear")}`;
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <CalendarToolbar
            label={weekLabel}
            onNavigate={(action) => {
              if (action === "PREV") setCurrentDate((d) => view === "day" ? dfns.addDays(d, -1) : dfns.addWeeks(d, -1));
              else if (action === "NEXT") setCurrentDate((d) => view === "day" ? dfns.addDays(d, 1) : dfns.addWeeks(d, 1));
              else if (action === "TODAY") setCurrentDate(new Date());
            }}
          />
        </div>
        <div className="flex-1 min-h-[60vh] overflow-auto pb-2">
          <WeekDayListView
            currentDate={currentDate}
            items={items}
            isDayView={view === "day"}
            manageMode={mode === "manage"}
            managedActionOptions={managedActionOptions}
            onAssignActionToDate={onAssignActionToDate}
            onReturnActionToQueue={onReturnActionToQueue}
            assigningActionIds={assigningActionIds}
          />
        </div>
        <div className="sticky inset-x-0 bottom-0 flex flex-wrap items-center gap-2 py-4 pt-4 mt-0 border-t border-border/60 shrink-0 bg-background pb-12">
          <span className="text-sm font-medium text-muted-foreground">{t("calendar.view")}:</span>
          {activeViewOptions.map((value) => (
            <Button
              key={value}
              variant={view === value ? "default" : "outline"}
              size="sm"
              onClick={() => setView(value)}
            >
              {t(`calendar.views.${value}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  /* Month: RBC calendar (view mode) */
  if (mode === "view") {
    return (
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex flex-1 min-h-[400px] flex-col">
          <MonthGridView currentDate={currentDate} items={items} onNavigate={setCurrentDate} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 pb-12 border-t border-border/60 shrink-0">
          <span className="text-sm font-medium text-muted-foreground">{t("calendar.view")}:</span>
          {activeViewOptions.map((value) => (
            <Button
              key={value}
              variant={view === value ? "default" : "outline"}
              size="sm"
              onClick={() => setView(value)}
            >
              {t(`calendar.views.${value}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  /* Month: manage mode uses week blocks with day-level assignment controls */
  return (
    <div className="flex flex-col flex-1 min-h-0 p-4">
      <div className="flex-1 min-h-[400px] overflow-auto">
        <MonthWeeksView
          currentDate={currentDate}
          items={items}
          onNavigate={setCurrentDate}
          manageMode
          managedActionOptions={managedActionOptions}
          onAssignActionToDate={onAssignActionToDate}
          onReturnActionToQueue={onReturnActionToQueue}
          assigningActionIds={assigningActionIds}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 pb-12 border-t border-border/60 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">{t("calendar.view")}:</span>
        {activeViewOptions.map((value) => (
          <Button
            key={value}
            variant={view === value ? "default" : "outline"}
            size="sm"
            onClick={() => setView(value)}
          >
            {t(`calendar.views.${value}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
