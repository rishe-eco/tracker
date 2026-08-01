import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Pencil, Settings, Trash2, MoreVertical, Info, StickyNote, CalendarClock } from "lucide-react";
import type { Action } from "./ActionsListPage";
import { isToday, isBefore, isAfter, format, isValid } from "date-fns";
import { parseDateOnly } from "~/utils/dateUtils";
import { Badge } from "../ui/badge";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useEffect, useState, useRef } from "react";
import { useApi } from "~/api/useApi";
import { useSubmitGuard } from "~/utils/useSubmitGuard";
import {
  DELETE_ACTION,
  TOGGLE_ACTION,
  POSTPONE_ACTION,
  OUTSOURCE_ACTION,
  SET_ACTION_IGNORE,
  SET_ACTION_PASSED_ARCHIVED,
} from "~/api/queries";
import NotesModal from "~/components/notes/NotesModal";

/** Action with optional today-module fields (project, goal, milestone, estimatedTimeMinutes, startTimeOfDay). */
export type ActionWithTodayFields = Action & {
  project?: { id: string; title: string } | null;
  goal?: { id: string; title: string } | null;
  milestone?: { id: string; title: string } | null;
  isGathered?: boolean;
  sourceType?: string | null;
  startTimeOfDay?: string | null;
  estimatedTimeMinutes?: number | null;
};

export type ActionPreviewReturnState =
  | { from: "project"; projectId: string }
  | { from: "goal"; goalId: string; milestoneId?: string };

interface ActionPreviewProps {
  action: Action | ActionWithTodayFields;
  onToggle?: (id: string, done: boolean) => void;
  onReschedule?: () => void;
  onDelete?: (id: string) => void;
  /** When true, show postpone/outsource/ignore/pass options and hide Settings/Delete. */
  showTodayOptions?: boolean;
  onRefetch?: () => void;
  /** When opening action form (edit), pass this as location state so cancel/submit return here. */
  returnTo?: ActionPreviewReturnState;
}

function canIgnore(action: ActionWithTodayFields): boolean {
  return (
    !action.project &&
    (action.isGathered ? action.sourceType === "routine" : true)
  );
}

function canPass(action: ActionWithTodayFields): boolean {
  return Boolean(action.isGathered && action.sourceType === "interval");
}

export default function ActionPreview({
  onToggle,
  onReschedule,
  onDelete,
  action,
  showTodayOptions = false,
  onRefetch,
  returnTo,
}: ActionPreviewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(action.done ?? false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [postponeModalOpen, setPostponeModalOpen] = useState(false);
  const [outsourceModalOpen, setOutsourceModalOpen] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [outsourceForm, setOutsourceForm] = useState({
    doTitle: "",
    doDate: "",
    ensureTitle: "",
    ensureDate: "",
  });
  const [infoBalloonOpen, setInfoBalloonOpen] = useState(false);
  const [infoHover, setInfoHover] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const { call } = useApi();
  const { submitting: postponing, run: runPostpone } = useSubmitGuard();
  const { submitting: outsourcing, run: runOutsource } = useSubmitGuard();
  const { submitting: fating, run: runFate } = useSubmitGuard();
  const { submitting: deleting, run: runDelete } = useSubmitGuard();
  const minDate = format(new Date(), "yyyy-MM-dd");
  const todayAction = action as ActionWithTodayFields;
  const showInfoBalloon = infoBalloonOpen || infoHover;
  // Several parents render this row without an onRefetch, so a postpone would
  // otherwise leave the old date on screen. Track the new one locally.
  const [tbdOverride, setTbdOverride] = useState<string | null>(null);
  const effectiveTbd = tbdOverride ?? action.tbd;

  // tbd is typed as Date on Action but arrives from the API as a string, and the
  // local override is a "yyyy-MM-dd" string — so accept both here.
  function getStatus(
    tbdValue: string | Date | null | undefined,
    done?: boolean | null
  ): string {
    if (done) return "Done";
    if (!tbdValue) return "Backlog";
    const tbd = parseDateOnly(tbdValue);
    if (!isValid(tbd)) return "Backlog";
    if (isToday(tbd)) return "In Progress";
    if (isBefore(tbd, new Date())) return "Ignored";
    if (isAfter(tbd, new Date())) return "TBD";
    return "";
  }

  function formatTbd(value: Action["tbd"] | any): string {
    if (value == null || value === "") return "No Date";
    const d = parseDateOnly(value);
    return isValid(d) ? format(d, "MMM d, yyyy") : "No Date";
  }

  useEffect(() => {
    setChecked(action.done ?? false);
  }, [action.id, action.done]);

  // Drop the local date once the row is replaced or the parent refetches.
  useEffect(() => {
    setTbdOverride(null);
  }, [action.id, action.tbd]);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!infoBalloonOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoBalloonOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [infoBalloonOpen]);

  function getStatusColor(statusArg: string): string {
    switch (statusArg) {
      case "Done":
        return "bg-green-100 text-green-800";
      case "Backlog":
        return "bg-gray-100 text-gray-800";
      case "In Progress":
        return "bg-blue-100 text-blue-800";
      case "Ignored":
        return "bg-yellow-100 text-yellow-800";
      case "TBD":
        return "bg-purple-100 text-purple-800";
      default:
        return "";
    }
  }
  const status = getStatus(effectiveTbd, action.done);
  const statusColor = getStatusColor(status);
  const statusKey =
    status === "Done"
      ? "goalManage.statusDone"
      : status === "Backlog"
        ? "goalManage.statusBacklog"
        : status === "In Progress"
          ? "goalManage.statusInProgress"
          : status === "Ignored"
            ? "goalManage.statusIgnored"
            : status === "TBD"
              ? "goalManage.statusTbd"
              : "";
  const statusLabel = statusKey ? t(statusKey) : status;
  const tbdDisplay = formatTbd(effectiveTbd) === "No Date" ? t("actions.statusNoDate") : formatTbd(effectiveTbd);

  const handleManage = () => {
    navigate(`/activities/action/${action.id}`, { state: returnTo ?? undefined });
  };

  const handleToggle = async () => {
    const nextDone = !checked;
    setChecked(nextDone);
    onToggle?.(action.id ?? "", nextDone);
    try {
      await call({ query: TOGGLE_ACTION, variables: { id: action.id } });
      onRefetch?.();
    } catch (err) {
      setChecked(!nextDone);
      onToggle?.(action.id ?? "", !nextDone);
      console.error("Toggle failed", err);
    }
  };

  const handlePostpone = async () => {
    if (!postponeDate) return;
    await runPostpone(async () => {
      try {
        const nextDate = postponeDate;
        await call({
          query: POSTPONE_ACTION,
          variables: { id: action.id, newDate: nextDate },
        });
        setTbdOverride(nextDate);
        setPostponeDate("");
        setPostponeModalOpen(false);
        setDropdownOpen(false);
        onRefetch?.();
        onReschedule?.();
      } catch (e) {
        console.error(e);
      }
    });
  };

  const handleOutsource = async () => {
    if (!outsourceForm.doDate || !outsourceForm.ensureDate) return;
    await runOutsource(async () => {
      try {
        await call({
          query: OUTSOURCE_ACTION,
          variables: {
            id: action.id,
            doOutsourcingTitle: outsourceForm.doTitle || t("wizard.doOutsourcingDefault"),
            doOutsourcingDate: outsourceForm.doDate,
            ensureDoneTitle: outsourceForm.ensureTitle || t("wizard.ensureDoneDefault"),
            ensureDoneDate: outsourceForm.ensureDate,
          },
        });
        setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
        setOutsourceModalOpen(false);
        setDropdownOpen(false);
        onRefetch?.();
      } catch (e) {
        console.error(e);
      }
    });
  };

  const handleIgnore = async () => {
    await runFate(async () => {
      try {
        await call({ query: SET_ACTION_IGNORE, variables: { id: action.id } });
        setDropdownOpen(false);
        onRefetch?.();
      } catch (e) {
        console.error(e);
      }
    });
  };

  const handlePass = async () => {
    await runFate(async () => {
      try {
        await call({
          query: SET_ACTION_PASSED_ARCHIVED,
          variables: { id: action.id },
        });
        setDropdownOpen(false);
        onRefetch?.();
      } catch (e) {
        console.error(e);
      }
    });
  };

  const handleDelete = async () => {
    await runDelete(async () => {
      try {
        await call({
          query: DELETE_ACTION,
          variables: { id: action.id },
        });
        onDelete?.(action.id ?? '');
      } catch (err) {
        console.error("Delete failed", err);
      }
    });
  };
  

  // Shared by both variants: the today row's "Postpone" menu item and the list
  // row's quick reschedule button on ignored actions.
  const postponeModal = postponeModalOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => setPostponeModalOpen(false)}
    >
      <div
        className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Label htmlFor="action-preview-postpone-date" className="font-medium mb-3 flex items-center gap-2">
          {t("wizard.postponeToDate")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        </Label>
        <div className="flex gap-2">
          <Input
            id="action-preview-postpone-date"
            type="date"
            min={minDate}
            value={postponeDate}
            onChange={(e) => setPostponeDate(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handlePostpone}
            disabled={!postponeDate}
            loading={postponing}
          >
            {t("wizard.setDate")}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setPostponeModalOpen(false)}
          disabled={postponing}
        >
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );

  if (showTodayOptions) {
    const parentLabel =
      todayAction.milestone?.title
        ? t("actions.milestoneBadge", { title: todayAction.milestone.title })
        : todayAction.goal?.title
          ? t("actions.goalBadge", { title: todayAction.goal.title })
          : todayAction.project?.title
            ? t("actions.projectBadge", { title: todayAction.project.title })
            : null;

    return (
      <li className="rounded-lg border bg-card relative">
        <div className="flex items-center gap-3 px-3 py-2">
          <Checkbox checked={checked} onCheckedChange={handleToggle} />
          <div ref={infoRef} className="min-w-0 flex-1 flex items-center gap-1.5">
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => setInfoBalloonOpen((o) => !o)}
              onMouseEnter={() => setInfoHover(true)}
              onMouseLeave={() => setInfoHover(false)}
              aria-label={t("actions.actionDetails")}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {showInfoBalloon && (
              <div
                className="absolute left-8 top-10 z-50 min-w-[180px] max-w-[320px] rounded-md border bg-popover px-3 py-2 text-sm shadow-md"
                role="tooltip"
              >
                <div className="space-y-1.5">
                  <div className="font-medium break-words">{action.title}</div>
                  {todayAction.estimatedTimeMinutes != null && todayAction.estimatedTimeMinutes > 0 && (
                    <div>{t("actions.estimatedMin", { min: todayAction.estimatedTimeMinutes })}</div>
                  )}
                  {parentLabel && <div className="text-muted-foreground">{parentLabel}</div>}
                  {!todayAction.estimatedTimeMinutes && !todayAction.startTimeOfDay && !parentLabel && (
                    <div className="text-muted-foreground">{t("actions.noOtherDetails")}</div>
                  )}
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{action.title}</div>
              <div className="text-xs text-muted-foreground">
                {todayAction.project?.title && (
                  <span>{t("today.fromProject", { title: todayAction.project.title })}</span>
                )}
                {todayAction.startTimeOfDay && (
                  <span className="ml-1">{todayAction.startTimeOfDay}</span>
                )}
                {!todayAction.project?.title && !todayAction.startTimeOfDay && (
                  <span>{tbdDisplay}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setNotesOpen(true)} className="h-8 w-8" aria-label={t("notes.openNotes")}>
              <StickyNote className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleManage} className="h-8 w-8" aria-label={t("goalManage.manage")}>
              <Settings className="h-4 w-4" />
            </Button>
            <div ref={dropdownRef} className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDropdownOpen((o) => !o)}
                className="h-8 w-8"
                aria-label={t("actions.options")}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border bg-popover py-1 shadow-md">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setOutsourceModalOpen(true);
                    setDropdownOpen(false);
                  }}
                >
                  {t("wizard.outsource")}…
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setPostponeModalOpen(true);
                    setDropdownOpen(false);
                  }}
                >
                  {t("wizard.postpone")}
                </button>
                {canIgnore(todayAction) && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handleIgnore()}
                  >
                    {t("wizard.ignoreBucketList")}
                  </button>
                )}
                {canPass(todayAction) && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handlePass()}
                  >
                    {t("wizard.pass")}
                  </button>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {postponeModal}

        {/* Outsource modal */}
        {outsourceModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-auto"
            onClick={() => {
              setOutsourceModalOpen(false);
              setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
            }}
          >
            <div
              className="rounded-lg border bg-card p-4 shadow-lg w-full max-w-md my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-medium mb-3">{t("wizard.outsourceSetDatesIntro")}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="action-preview-outsource-do-title" className="text-xs flex items-center gap-2">
                    {t("wizard.doOutsourcingTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="action-preview-outsource-do-title"
                    placeholder={t("wizard.delegatePlaceholder")}
                    value={outsourceForm.doTitle}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, doTitle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="action-preview-outsource-do-date" className="text-xs flex items-center gap-2">
                    {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="action-preview-outsource-do-date"
                    type="date"
                    min={minDate}
                    value={outsourceForm.doDate}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, doDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="action-preview-outsource-ensure-title" className="text-xs flex items-center gap-2">
                    {t("wizard.ensureDoneTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="action-preview-outsource-ensure-title"
                    placeholder={t("wizard.confirmPlaceholder")}
                    value={outsourceForm.ensureTitle}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, ensureTitle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="action-preview-outsource-ensure-date" className="text-xs flex items-center gap-2">
                    {t("today.date")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </Label>
                  <Input
                    id="action-preview-outsource-ensure-date"
                    type="date"
                    min={minDate}
                    value={outsourceForm.ensureDate}
                    onChange={(e) =>
                      setOutsourceForm((p) => ({ ...p, ensureDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleOutsource}
                  disabled={!outsourceForm.doDate || !outsourceForm.ensureDate}
                >
                  {t("wizard.confirmOutsource")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOutsourceModalOpen(false);
                    setOutsourceForm({ doTitle: "", doDate: "", ensureTitle: "", ensureDate: "" });
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          </div>
        )}
        {notesOpen && (
          <NotesModal
            entityType="action"
            entityId={action.id ?? ""}
            entityTitle={action.title}
            onClose={() => setNotesOpen(false)}
          />
        )}
      </li>
    );
  }

  const otherAction = action as ActionWithTodayFields;
  const parentLabelOther =
    otherAction.milestone?.title
      ? t("actions.milestoneBadge", { title: otherAction.milestone.title })
      : otherAction.goal?.title
        ? t("actions.goalBadge", { title: otherAction.goal.title })
        : otherAction.project?.title
          ? t("actions.projectBadge", { title: otherAction.project.title })
          : null;

  return (
    <>
    <div
      key={action.id}
      className="flex items-center justify-between gap-4 rounded-md border px-4 py-2 shadow-sm relative"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Checkbox checked={checked} onCheckedChange={handleToggle} />
        <div ref={infoRef} className="min-w-0 flex-1 flex items-center gap-1.5">
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => setInfoBalloonOpen((o) => !o)}
            onMouseEnter={() => setInfoHover(true)}
            onMouseLeave={() => setInfoHover(false)}
            aria-label={t("actions.actionDetails")}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {(infoBalloonOpen || infoHover) && (
            <div
              className="absolute left-10 top-12 z-50 min-w-[180px] max-w-[320px] rounded-md border bg-popover px-3 py-2 text-sm shadow-md"
              role="tooltip"
            >
              <div className="space-y-1.5">
                <div className="font-medium break-words">{action.title}</div>
                {otherAction.estimatedTimeMinutes != null && otherAction.estimatedTimeMinutes > 0 && (
                  <div>{t("actions.estimatedMin", { min: otherAction.estimatedTimeMinutes })}</div>
                )}
                {otherAction.startTimeOfDay && (
                  <div>{t("today.timeToDo")}: {otherAction.startTimeOfDay}</div>
                )}
                {parentLabelOther && (
                  <div className="text-muted-foreground">{parentLabelOther}</div>
                )}
                {!otherAction.estimatedTimeMinutes && !otherAction.startTimeOfDay && !parentLabelOther && (
                  <div className="text-muted-foreground">{t("actions.noOtherDetails")}</div>
                )}
              </div>
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-sm line-clamp-1">{action.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              {tbdDisplay}
              <Badge className={statusColor}>{statusLabel}</Badge>
              {/* An ignored action is one whose date has passed — the only thing
                  you usually want here is to give it a new one. */}
              {status === "Ignored" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs"
                  onClick={() => setPostponeModalOpen(true)}
                  disabled={postponing}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t("actions.updateDate")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setNotesOpen(true)}>
          <StickyNote className="h-4 w-4" />
          <span className="sr-only">{t("notes.openNotes")}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={handleManage}>
          <Settings className="h-4 w-4" />
          <span className="sr-only">{t("goalManage.manage")}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">{t("common.delete")}</span>
        </Button>
      </div>
    </div>
    {postponeModal}
    {notesOpen && (
      <NotesModal
        entityType="action"
        entityId={action.id ?? ""}
        entityTitle={action.title}
        onClose={() => setNotesOpen(false)}
      />
    )}
    <ConfirmDialog
      open={deleteConfirmOpen}
      onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
      title={t("actions.deleteActionTitle")}
      description={t("actions.cannotUndo")}
      confirmLabel={t("actions.delete")}
      variant="destructive"
      onConfirm={handleDelete}
      confirmLoading={deleting}
    />
    </>
  );
}
