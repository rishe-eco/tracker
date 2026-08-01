import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { InlineEdit } from "~/components/ui/inline-edit";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import ActionPreview from "../actions/ActionPreview";
import AddActionWidget from "../actions/AddActionWidget";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "../../api/useApi";
import { ADD_GOAL_PROJECT, ADD_PROJECT, ADD_PROJECT_ACTION, DELETE_ACTION, DELETE_PROJECT, GET_ALL_GOALS, GET_PROJECT, UPDATE_PROJECT } from "~/api/queries";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Pencil, Trash2 } from "lucide-react";
import { parseDateOnly, toLocalDateString } from "~/utils/dateUtils";
import { cn } from "~/lib/utils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

type GoalOption = { id: string; title: string; milestones: { id: string; title: string }[] };

export default function ProjectForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const goalIdParam = searchParams.get("goalId") ?? undefined;
  const milestoneIdParam = searchParams.get("milestoneId") ?? undefined;

  const isEdit = !!id;
  /** Only go back to goal page if we actually came from there (not when opening from project list). */
  const fromGoal = location.state && typeof location.state === "object" && (location.state as { from?: string }).from === "goal" && (location.state as { goalId?: string }).goalId;
  const returnGoalId = fromGoal ? (location.state as { goalId: string }).goalId : undefined;

  const [title, setTitle] = useState("");
  const [dod, setDod] = useState("");
  const [actions, setActions] = useState<any[]>([]);
  const [addingAction, setAddingAction] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDate, setNewActionDate] = useState("");
  const [newActionEstimatedMin, setNewActionEstimatedMin] = useState("");
  const [newActionStartTimeOfDay, setNewActionStartTimeOfDay] = useState("");

  const [goalId, setGoalId] = useState<string | undefined>(undefined);
  const [milestoneId, setMilestoneId] = useState<string | undefined>(undefined);
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const hasAppliedParams = useRef(false);

  const [newActions, setNewActions] = useState<any[]>([]);
  const [deletedActionIds, setDeletedActionIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { call, getLastError } = useApi();
  const { submitting, run } = useSubmitGuard();

  const handleDeleteConfirm = async () => {
    if (!id) return;
    await call({ query: DELETE_PROJECT, variables: { id } });
    setDeleteConfirmOpen(false);
    navigate(cancelTo);
  };

  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const todayKey = toLocalDateString(new Date());
  const newActionDateIsToday = newActionDate === todayKey;

  // Fetch goals (with milestones) for dropdowns
  useEffect(() => {
    call({ query: GET_ALL_GOALS }).then((res) => {
      const list = (res?.goals ?? []) as GoalOption[];
      setGoals(list);
    });
  }, []);

  // Pre-fill goalId/milestoneId from query params once goals are loaded
  useEffect(() => {
    if (isEdit || goals.length === 0 || hasAppliedParams.current) return;
    hasAppliedParams.current = true;
    if (milestoneIdParam) {
      const goalWithMilestone = goals.find((g) =>
        (g.milestones ?? []).some((m) => m.id === milestoneIdParam)
      );
      if (goalWithMilestone) {
        setGoalId(goalWithMilestone.id);
        setMilestoneId(milestoneIdParam);
        return;
      }
    }
    if (goalIdParam) {
      setGoalId(goalIdParam);
      setMilestoneId(undefined);
    }
  }, [goals, goalIdParam, milestoneIdParam, isEdit]);

  useEffect(() => {
    if (!isEdit) return;

    async function fetchProject() {
      call({ variables: { id }, query: GET_PROJECT }).then((res) => {
        const data = res?.project;
        if (!data) return;
        setTitle(data.title ?? "");
        setDod(data.dod ?? "");
        setGoalId(data.goal?.id ?? undefined);
        setMilestoneId(data.milestone?.id ?? undefined);
        setActions(
          (data.actions ?? []).map((a: any) => ({
            ...a,
            tbd: a.tbd ? parseDateOnly(a.tbd) : undefined,
          }))
        );
      });
    }

    fetchProject();
  }, [id, isEdit]);

  // In edit mode, if project has milestone but no goal, resolve goal from goals list once loaded
  useEffect(() => {
    if (!isEdit || !milestoneId || goalId || goals.length === 0) return;
    const goalWithMilestone = goals.find((g) =>
      (g.milestones ?? []).some((m) => m.id === milestoneId)
    );
    if (goalWithMilestone) setGoalId(goalWithMilestone.id);
  }, [isEdit, milestoneId, goalId, goals]);

  const selectedGoal = goals.find((g) => g.id === goalId);
  const milestoneOptions = selectedGoal?.milestones ?? [];
  const goalTitle = selectedGoal?.title;

  const updateProjectField = async (field: string, value: string) => {
    if (!id) return;
    call({
      query: UPDATE_PROJECT,
      variables: { id, [field]: value },
    }).then(() => {
      setTitle((prev) => (field === "title" ? value : prev));
      setDod((prev) => (field === "dod" ? value : prev));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(performProjectSubmit);
  };

  const performProjectSubmit = async () => {
    setSubmitError(null);

    try {
      const query = isEdit
        ? UPDATE_PROJECT
        : milestoneId
          ? ADD_PROJECT
          : goalId
            ? ADD_GOAL_PROJECT
            : ADD_PROJECT;

      const variables: any = isEdit
        ? {
            id,
            title,
            dod,
            goalId: goalId ?? null,
            milestoneId: milestoneId ?? null,
          }
        : {
            title,
            dod,
            actions: actions.map((a) => ({
              title: a.title,
              tbd: a.tbd ? (typeof a.tbd === "string" ? a.tbd : toLocalDateString(a.tbd)) : undefined,
              estimatedTimeMinutes: a.estimatedTimeMinutes ?? undefined,
            })),
            type: "individual",
            ...(milestoneId ? { milestoneId } : goalId ? { goalId } : {}),
          };

      const res = await call({ variables, query });
      if (!res) {
        setSubmitError(getLastError() || t("projects.saveError"));
        return;
      }

      if (isEdit) {
        const editCalls = [
          ...newActions.map((a) =>
            call({
              query: ADD_PROJECT_ACTION,
              variables: {
                title: a.title,
                tbd: a.tbd ? (typeof a.tbd === "string" ? a.tbd : toLocalDateString(a.tbd)) : undefined,
                projectId: id,
                estimatedTimeMinutes: a.estimatedTimeMinutes ?? undefined,
                startTimeOfDay: a.startTimeOfDay ?? undefined,
              },
            })
          ),
          ...deletedActionIds.map((actionId) =>
            call({ query: DELETE_ACTION, variables: { id: actionId } })
          ),
        ];
        const editResults = await Promise.all(editCalls);
        const failed = editResults.some((r) => r == null);
        if (failed) {
          setSubmitError(getLastError() || t("projects.updateActionsError"));
          return;
        }
      }

      navigate(returnGoalId ? `/activities/goal/${returnGoalId}` : "/activities/projects");
    } catch (err) {
      console.error("Failed to submit project", err);
      setSubmitError(t("projects.somethingWrong"));
    }
  };

  const MAX_ESTIMATED_MIN = 24 * 60;
  const isValidEstimated = (s: string) => {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) && n >= 0 && n <= MAX_ESTIMATED_MIN;
  };
  const canAddAction = newActionTitle.trim() !== "" && isValidEstimated(newActionEstimatedMin);

  const handleAddAction = () => {
    if (!newActionTitle.trim() || !isValidEstimated(newActionEstimatedMin)) return;
    const estNum = parseInt(newActionEstimatedMin.trim(), 10);
    const newAction = {
      title: newActionTitle.trim(),
      tbd: newActionDate || undefined,
      done: false,
      estimatedTimeMinutes: estNum,
      startTimeOfDay: newActionDateIsToday && newActionStartTimeOfDay ? newActionStartTimeOfDay : undefined,
    };
    setActions((prev) => [...prev, newAction]);
    setNewActions((prev) => [...prev, newAction]);
    setNewActionTitle("");
    setNewActionDate("");
    setNewActionEstimatedMin("");
    setNewActionStartTimeOfDay("");
    setAddingAction(false);
  };

  const handleDeleteAction = (index: number) => {
    const toDelete = actions[index];
    if (toDelete?.id) setDeletedActionIds((prev) => [...prev, toDelete.id]);
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelTo = returnGoalId ? `/activities/goal/${returnGoalId}` : "/activities/projects";
  return (
    <InternalPageLayout
      backLink={{ to: cancelTo, label: returnGoalId ? `← ${t("goalManage.backToGoal")}` : `← ${t("projects.backToProjects")}` }}
      title={isEdit ? t("projects.editProject") : t("projects.newProject")}
      actions={
        isEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive ml-2"
            onClick={() => setDeleteConfirmOpen(true)}
            title={t("projects.deleteProject")}
            aria-label={t("projects.deleteProject")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEdit ? (
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <InlineEdit
                id="project-title-edit"
                value={title}
                onSave={(v) => {
                  if (v !== title) updateProjectField("title", v);
                }}
                displayAs="h2"
                displayClassName="text-2xl font-bold flex-1 min-w-0"
                inputClassName="text-2xl font-bold"
              />
            </div>
            <InlineEdit
              id="project-dod-edit"
              value={dod}
              onSave={(v) => {
                if (v !== dod) updateProjectField("dod", v);
              }}
              displayAs="p"
              displayClassName="text-muted-foreground"
              inputClassName="flex-1 min-w-0"
              placeholder={t("goalManage.dodPlaceholder")}
              emptyDisplay={t("goalManage.dodEmptyDisplay")}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="project-title" className="flex items-center gap-2">
                {t("projects.projectTitle")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              </Label>
              <Input
                id="project-title"
                placeholder={t("projects.projectTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-dod" className="flex items-center gap-2">
                {t("goalManage.dodPlaceholder")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              </Label>
              <Input
                id="project-dod"
                placeholder={t("goalManage.dodPlaceholder")}
                value={dod}
                onChange={(e) => setDod(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="space-y-1">
            <Label htmlFor="goal" className="sr-only">{t("projects.goalOptional")}</Label>
            <select
              id="goal"
              value={goalId ?? ""}
              onChange={(e) => {
                const v = e.target.value || undefined;
                setGoalId(v);
                setMilestoneId(undefined);
              }}
              className={cn(
                "flex h-8 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]"
              )}
            >
              <option value="">{t("projects.goalOptional")}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="milestone" className="sr-only">{t("projects.milestoneOptional")}</Label>
            <select
              id="milestone"
              value={milestoneId ?? ""}
              onChange={(e) => setMilestoneId(e.target.value || undefined)}
              disabled={!selectedGoal}
              className={cn(
                "flex h-8 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]",
                !selectedGoal && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">{t("projects.milestoneOptional")}</option>
              {milestoneOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
          {goalId && (
            <span className="text-muted-foreground">
              {t("projects.selectedGoal")} <span className="font-medium text-foreground">{goalTitle ?? "—"}</span>
            </span>
          )}
        </div>

        {actions.map((a, i) => (
          <div key={i} className="relative">
            <ActionPreview action={a} onDelete={() => { handleDeleteAction(i) }} />
          </div>
        ))}

        {addingAction ? (
          <AddActionWidget
            title={newActionTitle}
            onTitleChange={setNewActionTitle}
            estimatedMinutes={newActionEstimatedMin}
            onEstimatedMinutesChange={setNewActionEstimatedMin}
            date={newActionDate}
            onDateChange={setNewActionDate}
            startTimeOfDay={newActionStartTimeOfDay}
            onStartTimeOfDayChange={setNewActionStartTimeOfDay}
            onAdd={handleAddAction}
            onCancel={() => {
              setAddingAction(false);
              setNewActionTitle("");
              setNewActionDate("");
              setNewActionEstimatedMin("");
              setNewActionStartTimeOfDay("");
            }}
            todayKey={todayKey}
            canAdd={canAddAction}
          />
        ) : (
          <Button type="button" variant="outline" onClick={() => setAddingAction(true)}>
            {t("projects.addAction")}
          </Button>
        )}

        <div className="space-y-1 pt-4 text-sm text-muted-foreground">
          <div>{t("filters.status")}: {actions.length === 0 ? t("projects.statusBacklog") : t("projects.statusDependsOnActions")}</div>
          {/* <div>Type: Individual</div> */}
        </div>

        {submitError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {submitError}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={submitting}>{t("common.submit")}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate(cancelTo)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>

      {isEdit && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
          title={t("projects.deleteProjectConfirm")}
          description={t("projects.deleteProjectDescription")}
          confirmLabel={t("common.delete")}
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />
      )}
    </InternalPageLayout>
  );
}
