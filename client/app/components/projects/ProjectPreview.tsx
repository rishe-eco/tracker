import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import { isBefore, isAfter } from "date-fns";
import { useAppDate } from "~/i18n/useAppDate";
import { Button } from "~/components/ui/button";
import ActionPreview from "../actions/ActionPreview";
import AddActionWidget from "../actions/AddActionWidget";
import { useApi } from "~/api/useApi";
import {
  DELETE_PROJECT,
  DELETE_ACTION,
  UPDATE_ACTION,
  GET_PROJECTS,
  ADD_PROJECT_ACTION,
} from "~/api/queries";
import { cn } from "~/lib/utils";
import { parseDateOnly, toLocalDateString } from "~/utils/dateUtils";
import { Settings, Trash2, ChevronDown, ChevronRight, Plus, X, StickyNote } from "lucide-react";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import NotesModal from "~/components/notes/NotesModal";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

export interface Project {
  title: string;
  dod?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  actions: { id: string; title: string; done: boolean; tbd?: Date }[];
  id: string;
}

export interface ProjectPreviewProps extends Project {
  showControls?: boolean;
  /** When true, show compact row: title, status, date, action count, manage/delete icons only. */
  compact?: boolean;
  onManage?: (id: string) => void;
  onDelete?: (id: string) => void;
  firstTbdAction?: {
    id: string;
    title: string;
    done?: boolean;
    tbd?: Date;
  };
  showGoalContext?: boolean;
  goalTitle?: string;
  milestoneTitle?: string;
  goal?: { id: string; title: string };
  milestone?: { id: string; title: string };
  /** Called after adding an action so parent can refetch (e.g. projects list). */
  onActionAdded?: () => void;
}

export function getProjectStatus(props: ProjectPreviewProps): string {
  const { startDate, actions } = props;
  const now = new Date();

  if (!actions.length) return "Backlog";

  const allDone = actions.every((a) => a.done);
  if (allDone) return "Done";

  // All incomplete actions with tbd dates are in the past → Ignored
  const incomplete = actions.filter((a) => !a.done);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (incomplete.length > 0 && incomplete.every((a) => a.tbd && isBefore(a.tbd, today))) {
    return "Ignored";
  }

  // Use inferred start date for TBD vs In Progress
  if (!startDate) return "Backlog";
  if (isAfter(startDate, now)) return "TBD";
  return "In Progress";
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Backlog":
      return "bg-gray-100 text-gray-800";
    case "TBD":
      return "bg-purple-100 text-purple-800";
    case "In Progress":
      return "bg-blue-100 text-blue-800";
    case "Ignored":
      return "bg-yellow-100 text-yellow-800";
    case "Done":
      return "bg-green-100 text-green-800";
    default:
      return "";
  }
}

type DeleteChoice = "delete-actions" | "move-to-project" | "to-backlog";

export default function ProjectPreview(props: ProjectPreviewProps) {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const navigate = useNavigate();
  const {
    title,
    dod,
    startDate,
    endDate,
    actions,
    showControls,
    compact = false,
    onManage,
    onDelete,
    firstTbdAction,
    id,
    goal,
    milestone,
    onActionAdded,
  } = props;

  const [projectActions, setProjectActions] = useState(actions);
  const status = getProjectStatus({ ...props, actions: projectActions });
  const doneCount = projectActions.filter((a) => a.done).length;
  const statusColor = getStatusColor(status);
  const { call } = useApi();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteWithActionsOpen, setDeleteWithActionsOpen] = useState(false);
  const [deleteChoice, setDeleteChoice] = useState<DeleteChoice | null>(null);
  const [moveToProjectId, setMoveToProjectId] = useState("");
  const [otherProjects, setOtherProjects] = useState<{ id: string; title: string }[]>([]);
  const [deleting, setDeleting] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [addingAction, setAddingAction] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDate, setNewActionDate] = useState("");
  const [newActionEstimatedMin, setNewActionEstimatedMin] = useState("");
  const [newActionStartTimeOfDay, setNewActionStartTimeOfDay] = useState("");

  const hasLinkedGoalOrMilestone = Boolean(goal ?? milestone);
  const todayKey = toLocalDateString(new Date());
  const newActionDateIsToday = newActionDate === todayKey;

  useEffect(() => {
    setProjectActions(actions);
  }, [actions]);

  useEffect(() => {
    if (!deleteWithActionsOpen) return;
    call({ query: GET_PROJECTS }).then((res: any) => {
      const list = (res?.projects ?? []).filter((p: any) => p.id !== id);
      setOtherProjects(list.map((p: any) => ({ id: p.id, title: p.title ?? "" })));
    });
  }, [deleteWithActionsOpen, id, call]);

  const handleManage = () => {
    if (onManage) {
      onManage(id);
    } else {
      navigate(`/activities/project/${id}`);
    }
  };

  const openDelete = () => {
    if (projectActions.length === 0) {
      setConfirmDeleteOpen(true);
    } else {
      setDeleteWithActionsOpen(true);
      setDeleteChoice(null);
      setMoveToProjectId("");
    }
  };

  const doDeleteProject = async () => {
    setDeleting(true);
    try {
      const res = await call({ query: DELETE_PROJECT, variables: { id } });
      if (res?.deleteProject) {
        onDelete?.(id);
        setConfirmDeleteOpen(false);
        setDeleteWithActionsOpen(false);
      }
    } finally {
      setDeleting(false);
    }
  };

  const doDeleteWithActions = async () => {
    if (!deleteChoice) return;
    setDeleting(true);
    try {
      if (deleteChoice === "delete-actions") {
        await Promise.all(
          projectActions.map((a) =>
            call({ query: DELETE_ACTION, variables: { id: a.id } })
          )
        );
      } else if (deleteChoice === "move-to-project" && moveToProjectId) {
        await Promise.all(
          projectActions.map((a) =>
            call({
              query: UPDATE_ACTION,
              variables: { id: a.id, projectId: moveToProjectId },
            })
          )
        );
      } else if (deleteChoice === "to-backlog") {
        await Promise.all(
          projectActions.map((a) =>
            call({
              query: UPDATE_ACTION,
              variables: {
                id: a.id,
                projectId: null,
                ...(hasLinkedGoalOrMilestone ? {} : { priority: "B" }),
              },
            })
          )
        );
      }
      await doDeleteProject();
    } catch (err) {
      console.error("Delete project with actions failed:", err);
    } finally {
      setDeleting(false);
    }
  };

  const dateLabel =
    status === "TBD" && startDate
      ? fmt(startDate, "dayMonthYear")
      : status === "In Progress" && endDate
        ? fmt(endDate, "dayMonthYear")
        : null;

  const MAX_ESTIMATED_MIN = 24 * 60;
  const isValidEstimated = (s: string) => {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) && n >= 0 && n <= MAX_ESTIMATED_MIN;
  };
  const canAddAction = newActionTitle.trim() !== "" && isValidEstimated(newActionEstimatedMin);

  const { submitting: addingActionBusy, run: runAddAction } = useSubmitGuard();

  const handleAddActionInAccordion = async () => {
    if (!newActionTitle.trim() || !isValidEstimated(newActionEstimatedMin)) return;
    await runAddAction(async () => {
    const estNum = parseInt(newActionEstimatedMin.trim(), 10);
    const startTime =
      newActionDateIsToday && newActionStartTimeOfDay.trim()
        ? newActionStartTimeOfDay.trim().slice(0, 5)
        : undefined;
    try {
      const res = await call({
        query: ADD_PROJECT_ACTION,
        variables: {
          title: newActionTitle.trim(),
          tbd: newActionDate || undefined,
          projectId: id,
          estimatedTimeMinutes: estNum,
          startTimeOfDay: startTime,
        },
      });
      if (res?.addAction) {
        setProjectActions((prev) => [
          ...prev,
          {
            id: res.addAction.id,
            title: newActionTitle.trim(),
            done: false,
            tbd: newActionDate ? parseDateOnly(newActionDate) : undefined,
          },
        ]);
      }
      setNewActionTitle("");
      setNewActionDate("");
      setNewActionEstimatedMin("");
      setNewActionStartTimeOfDay("");
      setAddingAction(false);
      onActionAdded?.();
    } catch (err) {
      console.error("Failed to add action:", err);
    }
    });
  };

  const handleDeleteActionInAccordion = (actionId: string) => {
    call({ query: DELETE_ACTION, variables: { id: actionId } }).then(() => {
      setProjectActions((prev) => prev.filter((a) => a.id !== actionId));
      onActionAdded?.();
    });
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-3 rounded-md border px-4 py-2 shadow-sm">
          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{title}</span>
            <Badge className={cn("shrink-0", statusColor)}>{status}</Badge>
            {dateLabel && (
              <span className="text-xs text-muted-foreground shrink-0">{dateLabel}</span>
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {projectActions.length === 1 ? t("projects.actionCountOne") : t("projects.actionCountOther", { count: projectActions.length })}
            </span>
          </div>
          {showControls && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setNotesOpen(true)}
                aria-label={t("notes.openNotes")}
              >
                <StickyNote className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleManage}
                aria-label={t("goalManage.manage")}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={openDelete}
                aria-label={t("common.delete")}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Simple confirm: no actions */}
        {confirmDeleteOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !deleting && setConfirmDeleteOpen(false)}
          >
            <div
              className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm mb-4">
                {t("projects.deleteProjectWithName", { title })}
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(false)}
                  disabled={deleting}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={doDeleteProject}
                  disabled={deleting}
                  loading={deleting}
                >
                  {deleting ? t("projects.deleting") : t("common.delete")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Choose what to do with actions */}
        {deleteWithActionsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !deleting && setDeleteWithActionsOpen(false)}
          >
            <div
              className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-medium mb-3">
                {t("projects.projectHasActionsPrompt", { count: projectActions.length })}
              </p>
              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteChoice"
                    checked={deleteChoice === "delete-actions"}
                    onChange={() => setDeleteChoice("delete-actions")}
                  />
                  <span className="text-sm">{t("projects.deleteThem")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteChoice"
                    checked={deleteChoice === "move-to-project"}
                    onChange={() => setDeleteChoice("move-to-project")}
                  />
                  <span className="text-sm">{t("projects.moveToAnotherProject")}</span>
                </label>
                {deleteChoice === "move-to-project" && (
                  <select
                    className="ml-6 mt-1 flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                    value={moveToProjectId}
                    onChange={(e) => setMoveToProjectId(e.target.value)}
                  >
                    <option value="">{t("projects.chooseProject")}</option>
                    {otherProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteChoice"
                    checked={deleteChoice === "to-backlog"}
                    onChange={() => setDeleteChoice("to-backlog")}
                  />
                  <span className="text-sm">
                    {hasLinkedGoalOrMilestone ? t("projects.moveToBacklog") : t("projects.moveToBucketList")}
                  </span>
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteWithActionsOpen(false)}
                  disabled={deleting}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={doDeleteWithActions}
                  disabled={
                    deleting ||
                    !deleteChoice ||
                    (deleteChoice === "move-to-project" && !moveToProjectId)
                  }
                  loading={deleting}
                >
                  {deleting ? t("projects.deleting") : t("projects.deleteProject")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Detailed: accordion layout
  const goalLabel = props.goalTitle ?? props.goal?.title;
  const milestoneLabel = props.milestoneTitle ?? props.milestone?.title;
  const firstAction = projectActions[0];

  return (
    <>
      <div className="border rounded-md shadow-sm overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setAccordionOpen((o) => !o)}
        >
          <h2 className="font-semibold text-sm truncate">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={statusColor}>{status}</Badge>
            {accordionOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {accordionOpen && (
          <div className="border-t">
            {/* Section 1: project info */}
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-muted-foreground">
                    {dod?.trim() || t("projects.noDescription")}
                  </div>
                  {(goalLabel || milestoneLabel) && (
                    <div className="text-xs text-muted-foreground">
                      {goalLabel && <span className="font-medium text-foreground/90">{goalLabel}</span>}
                      {goalLabel && milestoneLabel && " › "}
                      {milestoneLabel && <span>{milestoneLabel}</span>}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {projectActions.length === 1 ? t("projects.actionCountOne") : t("projects.actionCountOther", { count: projectActions.length })}
                    {startDate && endDate && (
                      <span className="ml-2">
                        · {fmt(startDate, "dayMonth")} – {fmt(endDate, "dayMonth")}
                      </span>
                    )}
                  </div>
                  <Badge className={cn("mt-1", statusColor)}>{status}</Badge>
                </div>
                {showControls && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setNotesOpen(true)} aria-label={t("notes.openNotes")}>
                      <StickyNote className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleManage} aria-label={t("goalManage.manage")}>
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openDelete}
                      aria-label={t("common.delete")}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar separator */}
            <div className="px-4 pb-2">
              <Progress
                value={projectActions.length ? (doneCount / projectActions.length) * 100 : 0}
                className="h-2"
              />
            </div>

            {/* Section 2: actions + add */}
            <div className="px-4 pb-4 space-y-2">
              {projectActions.length === 0 ? (
                !addingAction ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingAction(true)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t("actionsList.addAction")}
                  </Button>
                ) : null
              ) : !showAllActions ? (
                <>
                  <ActionPreview
                    action={firstAction}
                    onDelete={() => handleDeleteActionInAccordion(firstAction.id)}
                    onToggle={(actionId, done) => {
                      setProjectActions((prev) =>
                        prev.map((a) => (a.id === actionId ? { ...a, done } : a))
                      );
                      onActionAdded?.();
                    }}
                    returnTo={{ from: "project", projectId: id }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllActions(true)}
                  >
                    {t("filters.more")}
                  </Button>
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
                      onAdd={handleAddActionInAccordion}
                      busy={addingActionBusy}
                      onCancel={() => {
                        setAddingAction(false);
                        setNewActionTitle("");
                        setNewActionDate("");
                        setNewActionEstimatedMin("");
                        setNewActionStartTimeOfDay("");
                      }}
                      todayKey={todayKey}
                      canAdd={canAddAction}
                      addButtonSize="sm"
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingAction(true)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t("actionsList.addAction")}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {projectActions.map((action) => (
                    <ActionPreview
                      key={action.id}
                      action={action}
                      onDelete={() => handleDeleteActionInAccordion(action.id)}
                      onToggle={(actionId, done) => {
                        setProjectActions((prev) =>
                          prev.map((a) => (a.id === actionId ? { ...a, done } : a))
                        );
                        onActionAdded?.();
                      }}
                      returnTo={{ from: "project", projectId: id }}
                    />
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
                      onAdd={handleAddActionInAccordion}
                      busy={addingActionBusy}
                      onCancel={() => {
                        setAddingAction(false);
                        setNewActionTitle("");
                        setNewActionDate("");
                        setNewActionEstimatedMin("");
                        setNewActionStartTimeOfDay("");
                      }}
                      todayKey={todayKey}
                      canAdd={canAddAction}
                      addButtonSize="sm"
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingAction(true)}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t("actionsList.addAction")}
                    </Button>
                  )}
                </>
              )}

              {/* When no actions, show add widget directly */}
              {projectActions.length === 0 && addingAction && (
                <AddActionWidget
                  title={newActionTitle}
                  onTitleChange={setNewActionTitle}
                  estimatedMinutes={newActionEstimatedMin}
                  onEstimatedMinutesChange={setNewActionEstimatedMin}
                  date={newActionDate}
                  onDateChange={setNewActionDate}
                  startTimeOfDay={newActionStartTimeOfDay}
                  onStartTimeOfDayChange={setNewActionStartTimeOfDay}
                  onAdd={handleAddActionInAccordion}
                  busy={addingActionBusy}
                  onCancel={() => {
                    setAddingAction(false);
                    setNewActionTitle("");
                    setNewActionDate("");
                    setNewActionEstimatedMin("");
                    setNewActionStartTimeOfDay("");
                  }}
                  todayKey={todayKey}
                  canAdd={canAddAction}
                  addButtonSize="sm"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Same modals for detailed mode */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setConfirmDeleteOpen(false)}
        >
          <div
            className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm mb-4">
              {t("projects.deleteProjectWithName", { title })}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" size="sm" onClick={doDeleteProject} disabled={deleting} loading={deleting}>
                {deleting ? t("projects.deleting") : t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteWithActionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setDeleteWithActionsOpen(false)}
        >
          <div
            className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium mb-3">
              {t("projects.projectHasActionsPrompt", { count: projectActions.length })}
            </p>
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deleteChoiceDetail"
                  checked={deleteChoice === "delete-actions"}
                  onChange={() => setDeleteChoice("delete-actions")}
                />
                <span className="text-sm">{t("projects.deleteThem")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deleteChoiceDetail"
                  checked={deleteChoice === "move-to-project"}
                  onChange={() => setDeleteChoice("move-to-project")}
                />
                <span className="text-sm">{t("projects.moveToAnotherProject")}</span>
              </label>
              {deleteChoice === "move-to-project" && (
                <select
                  className="ml-6 mt-1 flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                  value={moveToProjectId}
                  onChange={(e) => setMoveToProjectId(e.target.value)}
                >
                  <option value="">{t("projects.chooseProject")}</option>
                  {otherProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deleteChoiceDetail"
                  checked={deleteChoice === "to-backlog"}
                  onChange={() => setDeleteChoice("to-backlog")}
                />
                <span className="text-sm">
                  {hasLinkedGoalOrMilestone ? t("projects.moveToBacklog") : t("projects.moveToBucketList")}
                </span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteWithActionsOpen(false)} disabled={deleting}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={doDeleteWithActions}
                disabled={
                  deleting ||
                  !deleteChoice ||
                  (deleteChoice === "move-to-project" && !moveToProjectId)
                }
              >
                {deleting ? t("projects.deleting") : t("projects.deleteProject")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {notesOpen && (
        <NotesModal
          entityType="project"
          entityId={id}
          entityTitle={title}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </>
  );
}
