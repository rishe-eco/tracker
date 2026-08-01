import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isToday } from "date-fns";
import TrackerCalendar from "./TrackerCalendar";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useApi } from "~/api/useApi";
import { GET_ACTIONS, GET_GOALS, GET_PROJECTS, UPDATE_ACTION } from "~/api/queries";
import type { CalendarFilters } from "./calendarTypes";
import { DEFAULT_CALENDAR_FILTERS } from "./calendarTypes";
import CalendarManageActionModal, {
  type ManageModalAction,
} from "./CalendarManageActionModal";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";

type CalendarMode = "view" | "manage";

type ApiProject = {
  id: string;
  title: string;
  actions: { id: string; title: string; done?: boolean; tbd?: string | null }[];
  goal?: { id: string; title: string } | null;
  milestone?: { id: string; title: string } | null;
};

type ApiGoal = {
  id: string;
  title: string;
  milestones?: { id: string; title: string }[];
};

export default function CalendarPage() {
  const { t } = useTranslation();
  const calendarSteps = [
    { title: t("onboarding.modules.calendar.step1Title"), body: t("onboarding.modules.calendar.step1Body") },
    { title: t("onboarding.modules.calendar.step2Title"), body: t("onboarding.modules.calendar.step2Body") },
  ];
  const { call } = useApi();
  const [mode, setMode] = useState<CalendarMode>("view");
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_CALENDAR_FILTERS);
  const [actions, setActions] = useState<ManageModalAction[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [goals, setGoals] = useState<ApiGoal[]>([]);
  const [queueActionIds, setQueueActionIds] = useState<string[]>([]);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assigningActionIds, setAssigningActionIds] = useState<Set<string>>(new Set());
  const [timePrompt, setTimePrompt] = useState<{
    actionId: string;
    dateKey: string;
    timeOfDay: string;
    submitting: boolean;
    error: string | null;
  } | null>(null);

  const toggle = (key: keyof CalendarFilters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    let cancelled = false;
    async function loadSelectionData() {
      const [actionsRes, projectsRes, goalsRes] = await Promise.all([
        call({ query: GET_ACTIONS }),
        call({ query: GET_PROJECTS }),
        call({ query: GET_GOALS }),
      ]);
      if (cancelled) return;
      setActions((actionsRes?.actions ?? []) as ManageModalAction[]);
      setProjects((projectsRes?.projects ?? []) as ApiProject[]);
      setGoals((goalsRes?.goals ?? []) as ApiGoal[]);
    }

    loadSelectionData();
    return () => {
      cancelled = true;
    };
  }, [call]);

  const actionById = useMemo(() => {
    const map = new Map<string, ManageModalAction>();
    for (const action of actions) map.set(action.id, action);
    return map;
  }, [actions]);

  const managedActionOptions = useMemo(
    () =>
      queueActionIds
        .map((id) => actionById.get(id))
        .filter((a): a is ManageModalAction => !!a)
        .map((a) => ({ id: a.id, title: a.title })),
    [queueActionIds, actionById]
  );

  const assignActionToDate = async (actionId: string, dateKey: string) => {
    if (!actionId || !dateKey) return;
    if (isToday(new Date(`${dateKey}T00:00:00`))) {
      setTimePrompt({
        actionId,
        dateKey,
        timeOfDay: "",
        submitting: false,
        error: null,
      });
      return;
    }

    setAssigningActionIds((prev) => new Set(prev).add(actionId));
    try {
      await call({
        query: UPDATE_ACTION,
        variables: { id: actionId, tbd: dateKey, startTimeOfDay: null },
      });
      setQueueActionIds((prev) => prev.filter((id) => id !== actionId));
      setRefreshKey((prev) => prev + 1);
    } finally {
      setAssigningActionIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  const submitTodayAssignment = async () => {
    if (!timePrompt) return;
    const time = timePrompt.timeOfDay.trim();
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setTimePrompt((prev) =>
        prev ? { ...prev, error: t("calendarPage.timeFormatError") } : prev
      );
      return;
    }

    setTimePrompt((prev) => (prev ? { ...prev, submitting: true, error: null } : prev));
    setAssigningActionIds((prev) => new Set(prev).add(timePrompt.actionId));

    try {
      await call({
        query: UPDATE_ACTION,
        variables: {
          id: timePrompt.actionId,
          tbd: timePrompt.dateKey,
          startTimeOfDay: time.slice(0, 5),
        },
      });
      setQueueActionIds((prev) => prev.filter((id) => id !== timePrompt.actionId));
      setRefreshKey((prev) => prev + 1);
      setTimePrompt(null);
    } finally {
      setAssigningActionIds((prev) => {
        const next = new Set(prev);
        next.delete(timePrompt.actionId);
        return next;
      });
      setTimePrompt((prev) => (prev ? { ...prev, submitting: false } : prev));
    }
  };

  const returnActionToQueue = async (actionId: string) => {
    setAssigningActionIds((prev) => new Set(prev).add(actionId));
    try {
      await call({
        query: UPDATE_ACTION,
        variables: { id: actionId, tbd: null, startTimeOfDay: null },
      });
      setQueueActionIds((prev) => (prev.includes(actionId) ? prev : [...prev, actionId]));
      setRefreshKey((prev) => prev + 1);
    } finally {
      setAssigningActionIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  return (
    <>
      <ModuleIntroOverlay moduleKey="calendar" steps={calendarSteps} />
      <main className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 px-4 py-2 shrink-0">
        <h1 className="text-2xl font-bold">{t("calendarPage.title")}</h1>
        <div className="inline-flex items-center rounded-md border border-border/60 p-1">
          <button
            type="button"
            onClick={() => setMode("view")}
            className={`rounded-sm px-3 py-1.5 text-sm ${
              mode === "view" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t("calendarPage.view")}
          </button>
          <button
            type="button"
            onClick={() => setMode("manage")}
            className={`rounded-sm px-3 py-1.5 text-sm ${
              mode === "manage" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t("calendarPage.manage")}
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-10 px-4 py-2 flex flex-wrap items-center gap-4 shrink-0 border-b border-border/60 bg-background">
        <span className="text-sm font-medium text-muted-foreground">{t("calendarPage.show")}:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.goalsMilestones}
            onCheckedChange={() => toggle("goalsMilestones")}
            aria-label={t("calendarPage.goalsMilestones")}
          />
          <Label className="text-sm cursor-pointer">{t("calendarPage.goalsMilestones")}</Label>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.actions}
            onCheckedChange={() => toggle("actions")}
            aria-label={t("calendarPage.actions")}
          />
          <Label className="text-sm cursor-pointer">{t("calendarPage.actions")}</Label>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.intervals}
            onCheckedChange={() => toggle("intervals")}
            aria-label={t("calendarPage.intervals")}
          />
          <Label className="text-sm cursor-pointer">{t("calendarPage.intervals")}</Label>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={filters.routines}
            onCheckedChange={() => toggle("routines")}
            aria-label={t("calendarPage.routines")}
          />
          <Label className="text-sm cursor-pointer">{t("calendarPage.routines")}</Label>
        </label>
      </div>

      {mode === "manage" && (
        <div className="px-4 py-3 border-b border-border/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{t("calendarPage.actionQueue")}</h2>
            <Button size="sm" onClick={() => setManageModalOpen(true)}>
              {t("calendarPage.add")}
            </Button>
          </div>
          <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-2">
            {managedActionOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("calendarPage.noActionsYet")}</p>
            ) : (
              managedActionOptions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
                >
                  <span className="text-sm truncate">{action.title}</span>
                  <button
                    type="button"
                    className="rounded px-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() =>
                      setQueueActionIds((prev) => prev.filter((id) => id !== action.id))
                    }
                    aria-label={t("calendarPage.remove")}
                    title={t("calendarPage.remove")}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <TrackerCalendar
        filters={filters}
        mode={mode}
        managedActionOptions={managedActionOptions}
        onAssignActionToDate={assignActionToDate}
        onReturnActionToQueue={returnActionToQueue}
        assigningActionIds={assigningActionIds}
        refreshKey={refreshKey}
      />

      <CalendarManageActionModal
        open={manageModalOpen}
        actions={actions}
        projects={projects}
        goals={goals}
        initiallySelectedActionIds={queueActionIds}
        onClose={() => setManageModalOpen(false)}
        onApply={(actionIds) => {
          setQueueActionIds(actionIds);
          setManageModalOpen(false);
        }}
      />

      {timePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !timePrompt.submitting && setTimePrompt(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 font-medium">{t("calendarPage.setTimeForToday")}</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("calendarPage.setTimeForTodayHelp")}
            </p>
            <Input
              type="time"
              value={timePrompt.timeOfDay}
              disabled={timePrompt.submitting}
              onChange={(e) =>
                setTimePrompt((prev) =>
                  prev
                    ? { ...prev, timeOfDay: e.target.value, error: null }
                    : prev
                )
              }
            />
            {timePrompt.error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{timePrompt.error}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={timePrompt.submitting}
                onClick={() => setTimePrompt(null)}
              >
                {t("calendarPage.cancel")}
              </Button>
              <Button disabled={timePrompt.submitting} onClick={submitTodayAssignment}>
                {timePrompt.submitting ? t("calendarPage.saving") : t("calendarPage.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
