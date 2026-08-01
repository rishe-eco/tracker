import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { format, isToday, isBefore, isAfter } from "date-fns";
import { Calendar } from "~/components/ui/calendar";
import { Badge } from "~/components/ui/badge";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { ADD_ACTION, UPDATE_ACTION, GET_ACTION, DELETE_ACTION, GET_PROJECTS } from "~/api/queries";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { InlineEdit } from "~/components/ui/inline-edit";
import { Pencil, Trash2 } from "lucide-react";
import { useApi } from "~/api/useApi";
import { parseDateOnly, toLocalDateString } from "~/utils/dateUtils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";
import { useTranslation } from "react-i18next";

const MAX_ESTIMATED_MINUTES = 24 * 60; // 24 hours

/** HH:mm */
function isValidTime(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(String(s).trim());
}

type ActionFormReturnState =
  | { from: "project"; projectId: string }
  | { from: "goal"; goalId: string; milestoneId?: string };

type ProjectOption = {
  id: string;
  title: string;
  goal?: { id: string; title: string } | null;
  milestone?: { id: string; title: string } | null;
};

function getActionFormReturnPath(state: unknown): string {
  if (state && typeof state === "object" && "from" in state) {
    const s = state as ActionFormReturnState;
    if (s.from === "project" && "projectId" in s && s.projectId) return `/activities/project/${s.projectId}`;
    if (s.from === "goal" && "goalId" in s && s.goalId)
      return s.milestoneId ? `/activities/goal/${s.goalId}/milestone/${s.milestoneId}` : `/activities/goal/${s.goalId}`;
  }
  return "/activities/actions";
}

function getActionFormBackLabel(state: unknown, t: (k: string) => string): string {
  if (state && typeof state === "object" && "from" in state) {
    const s = state as ActionFormReturnState;
    if (s.from === "project") return `← ${t("actions.backToProject")}`;
    if (s.from === "goal") return `← ${t("actions.backToGoal")}`;
  }
  return `← ${t("actions.backToActions")}`;
}

export default function ActionForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = getActionFormReturnPath(location.state);
  const backLabel = getActionFormBackLabel(location.state, t);
  const stateProjectId =
    location.state &&
    typeof location.state === "object" &&
    "from" in location.state &&
    (location.state as { from?: string; projectId?: string }).from === "project"
      ? (location.state as { projectId?: string }).projectId
      : undefined;
  const projectIdParam = searchParams.get("projectId") ?? undefined;
  const initialProjectId = projectIdParam ?? stateProjectId ?? "";
  const [title, setTitle] = useState("");
  const [tbd, setTbd] = useState<Date | undefined>(undefined);
  const [startTimeOfDay, setStartTimeOfDay] = useState("");
  const [estimatedTimeMinutes, setEstimatedTimeMinutes] = useState("");
  const [estimatedTimeError, setEstimatedTimeError] = useState<string | null>(null);
  const [timeOfDayError, setTimeOfDayError] = useState<string | null>(null);
  const [editingTbd, setEditingTbd] = useState(false);
  const [tempTbd, setTempTbd] = useState<Date | undefined>(undefined);
  const [projectId, setProjectId] = useState<string>(initialProjectId);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const navigate = useNavigate();
  const { call } = useApi();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { submitting, run } = useSubmitGuard();
  const { submitting: deleting, run: runDelete } = useSubmitGuard();

  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const isEdit = Boolean(id);
  const tbdIsToday = tbd != null && isToday(tbd);

  useEffect(() => {
    call({ query: GET_PROJECTS }).then((res) => {
      setProjects((res?.projects ?? []) as ProjectOption[]);
    });
  }, [call]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    call({ query: GET_ACTION, variables: { id } })
      .then((res: any) => {
        const action = res?.action;
        if (cancelled || !action) return;
        setTitle(action.title ?? "");
        setTbd(action.tbd ? parseDateOnly(action.tbd) : undefined);
        setTempTbd(action.tbd ? parseDateOnly(action.tbd) : undefined);
        setEstimatedTimeMinutes(
          action.estimatedTimeMinutes != null ? String(action.estimatedTimeMinutes) : ""
        );
        setStartTimeOfDay(action.startTimeOfDay ?? "");
        setProjectId(action.project?.id ?? initialProjectId);
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to fetch action:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, id, call, initialProjectId]);

  function getStatusKey(): "statusBacklog" | "statusInProgress" | "statusIgnored" | "statusTbd" | "" {
    if (!tbd) return "statusBacklog";
    if (isToday(tbd)) return "statusInProgress";
    if (isBefore(tbd, new Date())) return "statusIgnored";
    if (isAfter(tbd, new Date())) return "statusTbd";
    return "";
  }

  function getStatusColor(statusKey: string): string {
    switch (statusKey) {
      case "statusBacklog":
        return "bg-gray-100 text-gray-800";
      case "statusInProgress":
        return "bg-blue-100 text-blue-800";
      case "statusIgnored":
        return "bg-yellow-100 text-yellow-800";
      case "statusTbd":
        return "bg-purple-100 text-purple-800";
      default:
        return "";
    }
  }

  const updateActionField = async (field: string, value: string | null) => {
    if (!id) return;
    try {
      await call({
        query: UPDATE_ACTION,
        variables: {
          id,
          [field]: value,
        },
      });
      if (field === "title") {
        setTitle(String(value ?? ""));
      }
      if (field === "tbd") {
        setTbd(value ? new Date(value) : undefined);
        setTempTbd(value ? new Date(value) : undefined);
      }
    } catch (err) {
      console.error("Failed to update action:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstimatedTimeError(null);
    setTimeOfDayError(null);

    const hasDueDate = Boolean(tbd);
    const estStr = estimatedTimeMinutes.trim();
    const estNum = estStr === "" ? null : parseInt(estStr, 10);

    if (hasDueDate) {
      if (estStr === "" || !Number.isFinite(estNum)) {
        setEstimatedTimeError(t("actions.errors.estimatedRequiredWithDueDate"));
        return;
      }
      if (estNum! < 0 || estNum! > MAX_ESTIMATED_MINUTES) {
        setEstimatedTimeError(t("actions.errors.estimatedRange"));
        return;
      }
    } else if (estStr !== "" && (estNum === null || !Number.isFinite(estNum) || estNum < 0 || estNum > MAX_ESTIMATED_MINUTES)) {
      setEstimatedTimeError(t("actions.errors.estimatedRange"));
      return;
    }

    // Time is optional in general, but mandatory once the action is due today.
    const timeStr = startTimeOfDay.trim();
    if (tbdIsToday) {
      if (!timeStr || !isValidTime(timeStr)) {
        setTimeOfDayError(t("actions.errors.timeRequiredToday"));
        return;
      }
    } else if (timeStr && !isValidTime(timeStr)) {
      setTimeOfDayError(t("actions.errors.timeInvalid"));
      return;
    }

    await run(async () => {
      try {
        const isEditing = isEdit && id;
        const mutation = isEditing ? UPDATE_ACTION : ADD_ACTION;
        const tbdStr = tbd ? toLocalDateString(tbd) : null;
        const startTime = timeStr && isValidTime(timeStr) ? timeStr.slice(0, 5) : undefined;

        const variables = isEditing
          ? {
              id,
              title,
              tbd: tbdStr,
              done: false,
              estimatedTimeMinutes: estNum ?? undefined,
              // null (not undefined) so clearing the field actually clears it —
              // the resolver skips undefined and writes null.
              startTimeOfDay: startTime ?? null,
              projectId: projectId || null,
            }
          : {
              title,
              tbd: tbdStr,
              estimatedTimeMinutes: estNum ?? undefined,
              startTimeOfDay: startTime,
              projectId: projectId || undefined,
            };

        const res = await call({ query: mutation, variables });
        if (res?.updateAction ?? res?.addAction) navigate(returnTo);
      } catch (error) {
        console.error("Failed to submit action:", error);
      }
    });
  };

  function handleCancel() {
    navigate(returnTo);
  }

  const statusKey = getStatusKey();
  const status = statusKey ? t(`actions.${statusKey}`) : "";
  const statusColor = getStatusColor(statusKey);

  const selectedProject = projects.find((p) => p.id === projectId);

  const handleDeleteConfirm = async () => {
    if (!id) return;
    await runDelete(async () => {
      await call({ query: DELETE_ACTION, variables: { id } });
      setDeleteConfirmOpen(false);
      navigate(returnTo);
    });
  };

  if (isEdit) {
    return (
      <InternalPageLayout
        backLink={{ to: returnTo, label: backLabel }}
        title={t("actions.editTitle")}
        actions={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive ms-2"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            title={t("actions.deleteAction")}
            aria-label={t("actions.deleteAction")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <InlineEdit
                id="action-title-edit"
                value={title}
                onSave={(v) => updateActionField("title", v.trim() || title)}
                displayAs="h2"
                displayClassName="text-lg font-medium flex-1 min-w-0 truncate"
                inputClassName="text-lg font-medium flex-1"
                placeholder={t("actions.titlePlaceholder")}
                emptyDisplay={t("actions.clickToAddTitle")}
              />
              <Badge className={statusColor}>{status}</Badge>
            </div>
          </div>

          <div className="space-y-1">
            {editingTbd ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar
                  mode="single"
                  selected={tempTbd}
                  onSelect={(d) => {
                    setTempTbd(d);
                    setTbd(d);
                    setEditingTbd(false);
                    updateActionField("tbd", d ? toLocalDateString(d) : null);
                  }}
                  disabled={{ before: startOfToday }}
                  className="border rounded-md"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTbd(false)}
                >
                  {t("actions.done")}
                </Button>
              </div>
            ) : (
              // The hint only makes sense once a date is showing — with no date
              // the label already reads "Click to set…". It disappears on its own
              // while the calendar is open, since that replaces this whole block.
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setEditingTbd(true);
                  setTempTbd(tbd);
                }}
              >
                <span>
                  {tbd ? format(tbd, "MMM d, yyyy") : t("actions.clickToSetTbdDate")}
                </span>
                {tbd && (
                  <span className="text-xs text-muted-foreground/80 underline underline-offset-2">
                    {t("actions.clickToUpdate")}
                  </span>
                )}
                <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="startTimeOfDay" className="flex items-center gap-2">
              {t("actions.timeToDo")}{" "}
              {tbdIsToday ? (
                <span className="text-destructive">*</span>
              ) : (
                `(${t("actions.optional")})`
              )}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            </Label>
            <Input
              id="startTimeOfDay"
              type="time"
              value={startTimeOfDay}
              onChange={(e) => {
                setStartTimeOfDay(e.target.value);
                setTimeOfDayError(null);
              }}
              aria-invalid={Boolean(timeOfDayError)}
              className={timeOfDayError ? "border-red-500" : undefined}
            />
            {timeOfDayError && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {timeOfDayError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedTimeMinutes" className="flex items-center gap-2">
              {t("actions.estimatedTimeMinutes")} {tbd ? <span className="text-destructive">*</span> : `(${t("actions.optional")})`}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            </Label>
            <Input
              id="estimatedTimeMinutes"
              type="number"
              min={0}
              max={MAX_ESTIMATED_MINUTES}
              placeholder={t("intervals.estimatedPlaceholder")}
              value={estimatedTimeMinutes}
              onChange={(e) => {
                setEstimatedTimeMinutes(e.target.value);
                if (estimatedTimeError) setEstimatedTimeError(null);
              }}
              aria-invalid={Boolean(estimatedTimeError)}
              className={estimatedTimeError ? "border-red-500 focus-visible:ring-red-500/30" : undefined}
            />
            <p className="text-xs text-muted-foreground">
              {t("actions.maxTimeHelp")}
            </p>
            {estimatedTimeError && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {estimatedTimeError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectId" className="flex items-center gap-2">
              {t("actions.linkedProject")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            </Label>
            <select
              id="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
            >
              <option value="">— {t("actions.noProject")} —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <Badge variant="secondary">{t("actions.projectBadge", { title: selectedProject.title })}</Badge>
              {selectedProject.goal?.title && (
                <Badge variant="outline">{t("actions.goalBadge", { title: selectedProject.goal.title })}</Badge>
              )}
              {selectedProject.milestone?.title && (
                <Badge variant="outline">{t("actions.milestoneBadge", { title: selectedProject.milestone.title })}</Badge>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={submitting}>{t("actions.update")}</Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
              {t("actions.cancel")}
            </Button>
          </div>
        </form>

        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
          title={t("actions.deleteActionTitle")}
          description={t("actions.cannotUndo")}
          confirmLabel={t("actions.delete")}
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />
      </InternalPageLayout>
    );
  }

  return (
    <InternalPageLayout
      backLink={{ to: returnTo, label: backLabel }}
      title={t("actions.addTitle")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2">
            {t("actions.titleLabel")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("actions.titlePlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("actions.tbdDate")}</Label>
          <Calendar
            mode="single"
            selected={tbd}
            onSelect={setTbd}
            disabled={{ before: startOfToday }}
            className="border rounded-md w-fit min-w-fit"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startTimeOfDay" className="flex items-center gap-2">
            {t("actions.timeToDo")}{" "}
            {tbdIsToday ? (
              <span className="text-destructive">*</span>
            ) : (
              `(${t("actions.optional")})`
            )}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <Input
            id="startTimeOfDay"
            type="time"
            value={startTimeOfDay}
            onChange={(e) => {
              setStartTimeOfDay(e.target.value);
              setTimeOfDayError(null);
            }}
            aria-invalid={Boolean(timeOfDayError)}
            className={timeOfDayError ? "border-red-500" : undefined}
          />
          {timeOfDayError && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {timeOfDayError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimatedTimeMinutes" className="flex items-center gap-2">
            {t("actions.estimatedTimeMinutes")} {tbd ? <span className="text-destructive">*</span> : `(${t("actions.optional")})`}
            <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <Input
            id="estimatedTimeMinutes"
            type="number"
            min={0}
            max={MAX_ESTIMATED_MINUTES}
            placeholder={t("intervals.estimatedPlaceholder")}
            value={estimatedTimeMinutes}
            onChange={(e) => {
              setEstimatedTimeMinutes(e.target.value);
              if (estimatedTimeError) setEstimatedTimeError(null);
            }}
            aria-invalid={Boolean(estimatedTimeError)}
            className={estimatedTimeError ? "border-red-500 focus-visible:ring-red-500/30" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {t("actions.maxTimeHelp")}
          </p>
          {estimatedTimeError && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {estimatedTimeError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectId" className="flex items-center gap-2">
            {t("actions.linkedProject")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <select
            id="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
          >
            <option value="">— {t("actions.noProject")} —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label>{t("actions.status")}</Label>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {tbd ? format(tbd, "MMM d, yyyy") : t("actions.statusNoDate")}
            <Badge className={statusColor}>{status}</Badge>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={submitting}>{t("actions.create")}</Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t("actions.cancel")}
          </Button>
        </div>
      </form>
    </InternalPageLayout>
  );
}
