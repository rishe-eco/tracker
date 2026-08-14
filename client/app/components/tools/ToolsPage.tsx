import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router";
// `format` is Gregorian-only here by design — it builds `yyyy-MM-dd` day keys
// and input `min` attributes. Display goes through `fmt`.
import { addDays, format, parseISO } from "date-fns";
import { useAppDate } from "~/i18n/useAppDate";
import { useApi } from "~/api/useApi";
import {
  GET_ACTIONS,
  GET_GOALS,
  GET_PROJECTS,
  GET_TODAY_ACTIONS,
  UPDATE_ACTION,
} from "~/api/queries";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { DateField } from "~/components/ui/date-field";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { LoadingBlock, Spinner } from "~/components/ui/spinner";

type ToolStep = 1 | 2;

type ApiAction = {
  id: string;
  title: string;
  tbd?: string | null;
  done?: boolean;
  project?: {
    id: string;
    title: string;
    goal?: { id: string; title: string } | null;
    milestone?: { id: string; title: string } | null;
  } | null;
};

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

type EntityKinds = "goal" | "milestone" | "project" | "action";

type DayContext = {
  intervalActions: string[];
  routineActions: string[];
};

type OrganizeViewMode = "list" | "week";

function dateRangeDays(startDate: string, dayCount: number): string[] {
  if (!startDate || !Number.isInteger(dayCount) || dayCount < 1) return [];
  const out: string[] = [];
  let current = parseISO(`${startDate}T00:00:00`);
  const end = addDays(current, dayCount - 1);
  while (current <= end) {
    out.push(format(current, "yyyy-MM-dd"));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export default function ToolsPage() {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const navigate = useNavigate();
  const { call } = useApi();
  const [step, setStep] = useState<ToolStep>(1);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [dayCountInput, setDayCountInput] = useState("7");

  const [actions, setActions] = useState<ApiAction[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [goals, setGoals] = useState<ApiGoal[]>([]);

  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(new Set());
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());

  const [queueActionIds, setQueueActionIds] = useState<string[]>([]);
  const [dayAssignments, setDayAssignments] = useState<Record<string, string[]>>({});
  const [dayPickerValue, setDayPickerValue] = useState<Record<string, string>>({});
  const [addPickerOpenDay, setAddPickerOpenDay] = useState<string | null>(null);
  const [savingActionIds, setSavingActionIds] = useState<Set<string>>(new Set());
  const [dayContext, setDayContext] = useState<Record<string, DayContext>>({});
  const [organizeViewMode, setOrganizeViewMode] =
    useState<OrganizeViewMode>("week");

  useEffect(() => {
    let cancelled = false;
    async function loadStepOneData() {
      setLoading(true);
      const [actionsRes, projectsRes, goalsRes] = await Promise.all([
        call({ query: GET_ACTIONS }),
        call({ query: GET_PROJECTS }),
        call({ query: GET_GOALS }),
      ]);
      if (cancelled) return;
      setActions((actionsRes?.actions ?? []) as ApiAction[]);
      setProjects((projectsRes?.projects ?? []) as ApiProject[]);
      setGoals((goalsRes?.goals ?? []) as ApiGoal[]);
      setLoading(false);
    }
    loadStepOneData();
    return () => {
      cancelled = true;
    };
  }, []);

  const actionById = useMemo(() => {
    const map = new Map<string, ApiAction>();
    for (const action of actions) map.set(action.id, action);
    return map;
  }, [actions]);

  const projectById = useMemo(() => {
    const map = new Map<string, ApiProject>();
    for (const project of projects) map.set(project.id, project);
    return map;
  }, [projects]);

  const milestoneToProjectIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const project of projects) {
      if (!project.milestone?.id) continue;
      const list = map.get(project.milestone.id) ?? [];
      list.push(project.id);
      map.set(project.milestone.id, list);
    }
    return map;
  }, [projects]);

  const goalToProjectIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const project of projects) {
      if (!project.goal?.id) continue;
      const list = map.get(project.goal.id) ?? [];
      list.push(project.id);
      map.set(project.goal.id, list);
    }
    return map;
  }, [projects]);

  const projectToActionIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const project of projects) {
      map.set(
        project.id,
        (project.actions ?? []).filter((a) => !a.done).map((a) => a.id)
      );
    }
    return map;
  }, [projects]);

  const linkedActionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const project of projects) {
      for (const action of project.actions ?? []) {
        if (action.id) ids.add(action.id);
      }
    }
    return ids;
  }, [projects]);

  const standaloneActions = useMemo(
    () =>
      actions.filter(
        (a) => !a.done && !linkedActionIds.has(a.id) && !a.project?.id
      ),
    [actions, linkedActionIds]
  );

  const groupedGoals = useMemo(() => {
    const goalMap = new Map<string, { id: string; title: string; milestones: { id: string; title: string }[] }>();
    for (const goal of goals) {
      goalMap.set(goal.id, { id: goal.id, title: goal.title, milestones: goal.milestones ?? [] });
    }
    for (const project of projects) {
      const goalId = project.goal?.id;
      if (!goalId) continue;
      if (!goalMap.has(goalId)) {
        goalMap.set(goalId, {
          id: goalId,
          title: project.goal?.title ?? t("common.untitledGoal"),
          milestones: [],
        });
      }
    }
    return Array.from(goalMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [goals, projects]);

  const selectedActionsFromEntities = useMemo(() => {
    const ids = new Set<string>(selectedActionIds);
    for (const projectId of selectedProjectIds) {
      for (const actionId of projectToActionIds.get(projectId) ?? []) ids.add(actionId);
    }
    for (const milestoneId of selectedMilestoneIds) {
      for (const projectId of milestoneToProjectIds.get(milestoneId) ?? []) {
        for (const actionId of projectToActionIds.get(projectId) ?? []) ids.add(actionId);
      }
    }
    for (const goalId of selectedGoalIds) {
      for (const projectId of goalToProjectIds.get(goalId) ?? []) {
        for (const actionId of projectToActionIds.get(projectId) ?? []) ids.add(actionId);
      }
    }
    return Array.from(ids);
  }, [
    selectedActionIds,
    selectedProjectIds,
    selectedMilestoneIds,
    selectedGoalIds,
    projectToActionIds,
    milestoneToProjectIds,
    goalToProjectIds,
  ]);

  const selectedActionCount = selectedActionsFromEntities.length;
  const dayCount = Number(dayCountInput);
  const isDayCountValid = Number.isInteger(dayCount) && dayCount >= 1;
  const minStartDate = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const canMoveToStep2 =
    !!startDate &&
    startDate >= minStartDate &&
    isDayCountValid &&
    selectedActionCount > 0;

  const days = useMemo(
    () => dateRangeDays(startDate, dayCount),
    [startDate, dayCount]
  );
  const computedEndDate = days.length > 0 ? days[days.length - 1] : "";

  useEffect(() => {
    if (!canMoveToStep2 || step !== 2) return;
    setQueueActionIds((prev) => {
      if (prev.length > 0) return prev.filter((id) => selectedActionsFromEntities.includes(id));
      return selectedActionsFromEntities;
    });
  }, [canMoveToStep2, step, selectedActionsFromEntities]);

  useEffect(() => {
    const allowedDays = new Set(days);
    if (days.length === 0) {
      setDayAssignments({});
      return;
    }
    setDayAssignments((prev) => {
      const next: Record<string, string[]> = {};
      for (const [dateKey, ids] of Object.entries(prev)) {
        if (!allowedDays.has(dateKey)) continue;
        next[dateKey] = ids.filter((id) => selectedActionsFromEntities.includes(id));
      }
      for (const dateKey of days) {
        if (!next[dateKey]) next[dateKey] = [];
      }
      return next;
    });
  }, [days, selectedActionsFromEntities]);

  useEffect(() => {
    if (step !== 2 || days.length === 0) return;
    let cancelled = false;
    async function loadDayContext() {
      const pairs = await Promise.all(
        days.map(async (day) => {
          const res = await call({ query: GET_TODAY_ACTIONS, variables: { date: day } });
          const list = (res?.todayActions ?? []) as Array<{ title: string; sourceType?: string | null }>;
          const intervalActions = list
            .filter((a) => a.sourceType === "interval")
            .map((a) => a.title);
          const routineActions = list
            .filter((a) => a.sourceType === "routine")
            .map((a) => a.title);
          return [day, { intervalActions, routineActions }] as const;
        })
      );
      if (cancelled) return;
      const byDay: Record<string, DayContext> = {};
      for (const [day, context] of pairs) byDay[day] = context;
      setDayContext(byDay);
    }
    loadDayContext();
    return () => {
      cancelled = true;
    };
  }, [step, days]);

  const toggleSetValue = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    id: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGoal = (goalId: string) => toggleSetValue(setSelectedGoalIds, goalId);
  const toggleMilestone = (milestoneId: string) => toggleSetValue(setSelectedMilestoneIds, milestoneId);
  const toggleProject = (projectId: string) => toggleSetValue(setSelectedProjectIds, projectId);
  const toggleAction = (actionId: string) => toggleSetValue(setSelectedActionIds, actionId);

  const removeFromQueue = (actionId: string) => {
    setQueueActionIds((prev) => prev.filter((id) => id !== actionId));
  };

  const assignActionToDay = async (dateKey: string, actionId: string) => {
    if (!actionId) return;
    setDayAssignments((prev) => {
      const next: Record<string, string[]> = {};
      for (const [d, ids] of Object.entries(prev)) {
        next[d] = ids.filter((id) => id !== actionId);
      }
      if (!next[dateKey]) next[dateKey] = [];
      next[dateKey] = [...next[dateKey], actionId];
      return next;
    });
    setQueueActionIds((prev) => prev.filter((id) => id !== actionId));
    setAddPickerOpenDay(null);

    setSavingActionIds((prev) => new Set(prev).add(actionId));
    await call({
      query: UPDATE_ACTION,
      variables: { id: actionId, tbd: dateKey },
    });
    setSavingActionIds((prev) => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  };

  const removeActionFromDay = async (dateKey: string, actionId: string) => {
    setDayAssignments((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] ?? []).filter((id) => id !== actionId),
    }));
    setSavingActionIds((prev) => new Set(prev).add(actionId));
    setQueueActionIds((prev) => (prev.includes(actionId) ? prev : [...prev, actionId]));
    await call({
      query: UPDATE_ACTION,
      variables: { id: actionId, tbd: null },
    });
    setSavingActionIds((prev) => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  };

  const renderDayPlannerCard = (day: string, compact = false) => {
    const assigned = dayAssignments[day] ?? [];
    const intervalActions = dayContext[day]?.intervalActions ?? [];
    const routineActions = dayContext[day]?.routineActions ?? [];

    return (
      <div key={day} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-col items-start justify-between gap-2">
          <p className="text-sm font-medium">
            {compact
              ? fmt(parseISO(`${day}T00:00:00`), "weekdayShortDayMonth")
              : fmt(parseISO(`${day}T00:00:00`), "weekdayShortDayMonthYear")}
          </p>
          <Badge variant="secondary">{t("calendar.plannedCount", { count: assigned.length })}</Badge>
        </div>

        {(intervalActions.length > 0 || routineActions.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {intervalActions.map((title, index) => (
              <Badge key={`interval-${day}-${index}`} variant="secondary">
                {t("tools.intervalLabel", { title })}
              </Badge>
            ))}
            {routineActions.map((title, index) => (
              <Badge key={`routine-${day}-${index}`} variant="secondary">
                {t("tools.routineLabel", { title })}
              </Badge>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("tools.noActionsAssigned")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {assigned.map((actionId) => {
                const action = actionById.get(actionId);
                if (!action) return null;
                return (
                  <span
                    key={actionId}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs"
                  >
                    <span className="max-w-[180px] truncate">{action.title}</span>
                    <button
                      type="button"
                      className="rounded px-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                      disabled={savingActionIds.has(actionId)}
                      onClick={() => removeActionFromDay(day, actionId)}
                      aria-label={t("tools.clearDate")}
                      title={t("tools.clearDate")}
                    >
                      {savingActionIds.has(actionId) ? <Spinner className="h-3 w-3" /> : "×"}
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {compact ? (
          <div className="space-y-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setAddPickerOpenDay((prev) => (prev === day ? null : day))
              }
              disabled={queueActionIds.length === 0 && addPickerOpenDay !== day}
            >
              {addPickerOpenDay === day ? t("tools.close") : t("tools.add")}
            </Button>
            {addPickerOpenDay === day && (
              <div className="flex flex-col gap-2">
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                  value={dayPickerValue[day] ?? ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setDayPickerValue((prev) => ({ ...prev, [day]: selectedId }));
                    if (!selectedId) return;
                    setDayPickerValue((prev) => ({ ...prev, [day]: "" }));
                    void assignActionToDay(day, selectedId);
                  }}
                >
                  <option value="">{t("tools.selectActionToAdd")}</option>
                  {queueActionIds.map((actionId) => {
                    const action = actionById.get(actionId);
                    if (!action) return null;
                    return (
                      <option key={`${day}-option-${action.id}`} value={action.id}>
                        {action.title}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              className="h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
              value={dayPickerValue[day] ?? ""}
              onChange={(e) =>
                setDayPickerValue((prev) => ({ ...prev, [day]: e.target.value }))
              }
            >
              <option value="">{t("tools.selectActionToAdd")}</option>
              {queueActionIds.map((actionId) => {
                const action = actionById.get(actionId);
                if (!action) return null;
                return (
                  <option key={`${day}-option-${action.id}`} value={action.id}>
                    {action.title}
                  </option>
                );
              })}
            </select>
            <Button
              type="button"
              size="default"
              disabled={!dayPickerValue[day]}
              onClick={() => {
                const chosenId = dayPickerValue[day];
                if (!chosenId) return;
                setDayPickerValue((prev) => ({ ...prev, [day]: "" }));
                void assignActionToDay(day, chosenId);
              }}
            >
              {t("tools.addToDay")}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="space-y-8 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("tools.title")}</h1>
        <Button variant="outline" onClick={() => navigate("/tools")}>
          {t("tools.backToTools")}
        </Button>
      </div>

      <section className="space-y-4 rounded-lg bg-card">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("tools.subtitle")}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label={t("wizard.wizardStepsAria")}>
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t("tools.stepOne")}
          </button>
          <button
            type="button"
            onClick={() => canMoveToStep2 && setStep(2)}
            disabled={!canMoveToStep2}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {t("tools.stepTwo")}
          </button>
        </div>

        {step === 1 && (
          <section className="space-y-6">
            {loading ? (
              <LoadingBlock label={t("tools.loadingData")} />
            ) : (
              <>
                <div className="space-y-3">
                  <h3 className="font-medium">{t("tools.dateRange")}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="period-start">{t("tools.startDate")}</Label>
                      <DateField
                        id="period-start"
                        min={minStartDate}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="period-days">{t("tools.dayCount")}</Label>
                      <Input
                        id="period-days"
                        type="number"
                        min={1}
                        step={1}
                        value={dayCountInput}
                        onChange={(e) => setDayCountInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("tools.endDate")}:{" "}
                    <span className="font-medium text-foreground">
                      {computedEndDate
                        ? fmt(parseISO(`${computedEndDate}T00:00:00`), "weekdayShortDayMonthYear")
                        : t("tools.selectStart")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("tools.startDateRule")}
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium">{t("tools.selectScope")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("tools.scopeHelp")}
                  </p>

                  <div className="max-h-[380px] space-y-3 overflow-y-auto rounded-md">
                    {groupedGoals.map((goal) => {
                      const goalProjects =
                        (goalToProjectIds.get(goal.id) ?? [])
                          .map((id) => projectById.get(id))
                          .filter((p): p is ApiProject => !!p) ?? [];
                      return (
                        <div key={goal.id} className="space-y-2 rounded-md border p-3">
                          <label className="flex items-center gap-2 text-sm font-medium">
                            <Checkbox
                              checked={selectedGoalIds.has(goal.id)}
                              onCheckedChange={() => toggleGoal(goal.id)}
                            />
                            {goal.title}
                            <Badge variant="secondary">{t("tools.entityGoal")}</Badge>
                          </label>

                          {goal.milestones?.map((milestone) => {
                            const milestoneProjects =
                              (milestoneToProjectIds.get(milestone.id) ?? [])
                                .map((id) => projectById.get(id))
                                .filter((p): p is ApiProject => !!p) ?? [];
                            return (
                              <div key={milestone.id} className="ml-4 space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={selectedMilestoneIds.has(milestone.id)}
                                    onCheckedChange={() => toggleMilestone(milestone.id)}
                                  />
                                  {milestone.title}
                                  <Badge variant="secondary">{t("tools.entityMilestone")}</Badge>
                                </label>

                                {milestoneProjects.map((project) => (
                                  <div key={project.id} className="ml-4 space-y-1.5">
                                    <label className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={selectedProjectIds.has(project.id)}
                                        onCheckedChange={() => toggleProject(project.id)}
                                      />
                                      {project.title}
                                      <Badge variant="secondary">{t("tools.entityProject")}</Badge>
                                    </label>
                                    <div className="ml-4 space-y-1">
                                      {(project.actions ?? [])
                                        .filter((a) => !a.done)
                                        .map((action) => (
                                          <label
                                            key={action.id}
                                            className="flex items-center gap-2 text-sm text-muted-foreground"
                                          >
                                            <Checkbox
                                              checked={selectedActionIds.has(action.id)}
                                              onCheckedChange={() => toggleAction(action.id)}
                                            />
                                            {action.title}
                                          </label>
                                        ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}

                          {goalProjects
                            .filter((p) => !p.milestone?.id)
                            .map((project) => (
                              <div key={project.id} className="ml-4 space-y-1.5">
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={selectedProjectIds.has(project.id)}
                                    onCheckedChange={() => toggleProject(project.id)}
                                  />
                                  {project.title}
                                  <Badge variant="secondary">{t("tools.entityProject")}</Badge>
                                </label>
                                <div className="ml-4 space-y-1">
                                  {(project.actions ?? [])
                                    .filter((a) => !a.done)
                                    .map((action) => (
                                      <label
                                        key={action.id}
                                        className="flex items-center gap-2 text-sm text-muted-foreground"
                                      >
                                        <Checkbox
                                          checked={selectedActionIds.has(action.id)}
                                          onCheckedChange={() => toggleAction(action.id)}
                                        />
                                        {action.title}
                                      </label>
                                    ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      );
                    })}

                    {standaloneActions.length > 0 && (
                      <div className="space-y-2 rounded-md border p-3">
                        <p className="text-sm font-medium">{t("tools.standaloneActions")}</p>
                        {standaloneActions.map((action) => (
                          <label key={action.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedActionIds.has(action.id)}
                              onCheckedChange={() => toggleAction(action.id)}
                            />
                            {action.title}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("tools.selectedActionsCount", { count: selectedActionCount })}
                  </p>
                  <Button onClick={() => canMoveToStep2 && setStep(2)} disabled={!canMoveToStep2}>
                    {t("tools.nextOrganize")}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">{t("tools.actionQueue")}</h3>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {queueActionIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("tools.queueEmpty")}</p>
                ) : (
                  queueActionIds.map((actionId) => {
                    const action = actionById.get(actionId);
                    if (!action) return null;
                    return (
                      <div
                        key={action.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="text-sm">{action.title}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromQueue(action.id)}
                        >
                          {t("tools.remove")}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{t("tools.daysInRange")}</h3>
                <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-1">
                  <Button
                    type="button"
                    variant={organizeViewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setOrganizeViewMode("list")}
                  >
                    {t("tools.listMode")}
                  </Button>
                  <Button
                    type="button"
                    variant={organizeViewMode === "week" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setOrganizeViewMode("week")}
                  >
                    {t("tools.daysMode")}
                  </Button>
                </div>
              </div>

              {organizeViewMode === "list" ? (
                <div className="max-h-[460px] space-y-3 overflow-y-auto rounded-md border p-2">
                  {days.map((day) => renderDayPlannerCard(day))}
                </div>
              ) : (
                <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-md">
                  <div
                    className="grid gap-2 overflow-auto content-start"
                    style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
                  >
                    {days.map((day) => (
                      <div
                        key={day}
                        className="border rounded-lg overflow-hidden bg-card flex flex-col min-w-0 p-2"
                      >
                        {renderDayPlannerCard(day, true)}
                      </div>
                    ))}
                  </div>
                  {days.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("tools.noDays")}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant={queueActionIds.length > 0 ? "outline" : "default"}
                onClick={() => navigate("/tools")}
              >
                {queueActionIds.length > 0
                  ? t("tools.doneWithQueued", { count: queueActionIds.length })
                  : t("tools.doneAllAssigned")}
              </Button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
