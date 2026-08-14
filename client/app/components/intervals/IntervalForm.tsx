import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { format } from "date-fns";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import HintPopover from "~/components/ui/HintPopover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DateTimeField } from "~/components/ui/date-field";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription } from "~/components/ui/alert";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import {
  GET_INTERVAL,
  GET_ROUTINE,
  GET_ALL_GOALS,
  GET_PROJECTS,
  ADD_INTERVAL,
  UPDATE_INTERVAL,
  ADD_ROUTINE,
  UPDATE_ROUTINE,
  DELETE_INTERVAL,
  DELETE_ROUTINE,
} from "~/api/queries";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { cn } from "~/lib/utils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

const REPEAT_UNIT_KEYS = ["minute", "hour", "day", "week", "month", "year"] as const;
const DAY_LABEL_KEYS = ["dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat", "daySun"] as const;
const MONTH_LABEL_KEYS = ["monthJan", "monthFeb", "monthMar", "monthApr", "monthMay", "monthJun", "monthJul", "monthAug", "monthSep", "monthOct", "monthNov", "monthDec"] as const;

const MAX_ESTIMATED_MINUTES = 24 * 60; // 24 hours

/** Format Date or ISO string for input[type="datetime-local"] (local time) */
function toDateTimeLocal(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return "";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** Parse datetime-local value to ISO string */
function fromDateTimeLocal(s: string): string {
  if (!s) return "";
  return new Date(s).toISOString();
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
  className,
}: {
  title: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left font-medium bg-muted/50 hover:bg-muted/70 transition-colors"
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
      </button>
      {open && <div className="p-4 space-y-3 border-t bg-background">{children}</div>}
    </div>
  );
}

type StepEntry = { id?: string; title: string; order: number };

function StepRow({
  step,
  index,
  onTitleChange,
  onRemove,
  onAddNext,
  inputRef,
}: {
  step: StepEntry;
  index: number;
  onTitleChange: (value: string) => void;
  onRemove: () => void;
  onAddNext?: () => void;
  // `Ref`, not `RefObject<T | null>`: the latter is the React 19 shape, and
  // this project runs React 18. It typechecked only because
  // `@types/react-big-calendar` was dragging in `@types/react@19` transitively —
  // `@types/react` was never a direct dependency. It is one now, at 18.x.
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  const id = `step-${index}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddNext?.();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex gap-2 items-center rounded-md border p-1 -m-1 transition-colors",
        isDragging && "opacity-50 z-10"
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none py-1"
        title={t("intervals.dragReorder")}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
      <Label htmlFor={`interval-step-${index}`} className="sr-only flex items-center gap-2">
        {t("intervals.stepTitle")} <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </Label>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
      <Input
        id={`interval-step-${index}`}
        ref={inputRef}
        placeholder={t("intervals.stepTitle")}
        value={step.title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1"
      />
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t("intervals.removeStep")}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export type ScheduleFormMode = "interval" | "routine";

export default function IntervalForm({ mode }: { mode: ScheduleFormMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [endTime, setEndTime] = useState(""); // datetime-local display value
  const [timeOfDayBlocks, setTimeOfDayBlocks] = useState<string[]>([]); // routine: ["HH:mm", ...]
  const [repeatValue, setRepeatValue] = useState(1);
  const [repeatUnit, setRepeatUnit] = useState<string>("week");
  const [customRepeatDates, setCustomRepeatDates] = useState<string[]>([]);
  const [customRepeatRuleDaysOfWeek, setCustomRepeatRuleDaysOfWeek] = useState<number[]>([]);
  const [customRepeatRuleDaysOfMonth, setCustomRepeatRuleDaysOfMonth] = useState<number[]>([]);
  const [customRepeatRuleMonths, setCustomRepeatRuleMonths] = useState<number[]>([]);
  const [customRepeatRuleYearDaysOfMonth, setCustomRepeatRuleYearDaysOfMonth] = useState<number[]>([]);
  const [predictedToDoTime, setPredictedToDoTime] = useState<string>("");
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [repeatsOpen, setRepeatsOpen] = useState(true);
  const [stepsOpen, setStepsOpen] = useState(true);

  const [goals, setGoals] = useState<{ id: string; title: string; isGoalGroup?: boolean; milestones: { id: string; title: string }[] }[]>([]);
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [goalId, setGoalId] = useState<string>("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [estimatedTimeMinutes, setEstimatedTimeMinutes] = useState<string>("");
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const minDateTimeLocal = format(new Date(), "yyyy-MM-dd") + "T00:00";

  useEffect(() => {
    if (mode === "interval") {
      call({ query: GET_ALL_GOALS }).then((res) => {
        const list = res?.goals ?? [];
        setGoals(list);
        const gId = searchParams.get("goalId");
        const mId = searchParams.get("milestoneId");
        if (gId && list.some((g: any) => g.id === gId)) {
          setGoalId(gId);
          if (mId) {
            const goal = list.find((g: any) => g.id === gId);
            if (goal?.milestones?.some((m: any) => m.id === mId)) setMilestoneId(mId);
          }
        }
      });
      call({ query: GET_PROJECTS }).then((res) => setProjects(res?.projects ?? []));
    }
  }, [mode]);

  useEffect(() => {
    if (!isEdit || !id) return;
    if (mode === "interval") {
      call({ query: GET_INTERVAL, variables: { id } }).then((res) => {
        const data = res?.interval;
        if (!data) return;
        setTitle(data.title ?? "");
        setStatus(data.status === "inactive" ? "inactive" : "active");
        setEndTime(toDateTimeLocal(data.endTime ?? ""));
        setRepeatValue(data.repeatValue ?? 1);
        setRepeatUnit(data.repeatUnit ?? "week");
        setCustomRepeatDates(Array.isArray(data.customRepeatDates) ? data.customRepeatDates : []);
        setPredictedToDoTime(data.predictedToDoTime ?? "");
        if (data.customRepeatRule) {
          try {
            const rule = JSON.parse(data.customRepeatRule) as {
              unit?: string;
              daysOfWeek?: number[];
              daysOfMonth?: number[];
              months?: number[];
              timeOfDayBlocks?: string[];
            };
            setCustomRepeatRuleDaysOfWeek(Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : []);
            setCustomRepeatRuleDaysOfMonth(
              rule.unit === "month" && Array.isArray(rule.daysOfMonth) ? rule.daysOfMonth : []
            );
            setCustomRepeatRuleMonths(Array.isArray(rule.months) ? rule.months : []);
            setCustomRepeatRuleYearDaysOfMonth(
              rule.unit === "year" && Array.isArray(rule.daysOfMonth) ? rule.daysOfMonth : []
            );
            setTimeOfDayBlocks(
              Array.isArray(rule.timeOfDayBlocks)
                ? rule.timeOfDayBlocks.map((t: string) => String(t).trim().slice(0, 5)).filter((t: string) => /^\d{2}:\d{2}$/.test(t))
                : []
            );
          } catch {
            setCustomRepeatRuleDaysOfWeek([]);
            setCustomRepeatRuleDaysOfMonth([]);
            setCustomRepeatRuleMonths([]);
            setCustomRepeatRuleYearDaysOfMonth([]);
            setTimeOfDayBlocks([]);
          }
        } else {
          setCustomRepeatRuleDaysOfWeek([]);
          setCustomRepeatRuleDaysOfMonth([]);
          setCustomRepeatRuleMonths([]);
          setCustomRepeatRuleYearDaysOfMonth([]);
          setTimeOfDayBlocks(
            data.predictedToDoTime && /^\d{2}:\d{2}$/.test(String(data.predictedToDoTime).trim().slice(0, 5))
              ? [String(data.predictedToDoTime).trim().slice(0, 5)]
              : []
          );
        }
        setSteps(
          (data.steps ?? []).map((s: any, i: number) => ({
            id: s.id,
            title: s.title ?? "",
            order: s.order ?? i,
          }))
        );
        setGoalId(data.goal?.id ?? "");
        setMilestoneId(data.milestone?.id ?? "");
        setProjectId(data.project?.id ?? "");
        setEstimatedTimeMinutes(data.estimatedTimeMinutes != null ? String(data.estimatedTimeMinutes) : "");
      });
    } else {
      call({ query: GET_ROUTINE, variables: { id } }).then((res) => {
        const data = res?.routine;
        if (!data) return;
        setTitle(data.title ?? "");
        setStatus(data.status === "inactive" ? "inactive" : "active");
        setEndTime(toDateTimeLocal(data.endTime ?? ""));
        if (Array.isArray(data.timeOfDayBlocks) && data.timeOfDayBlocks.length > 0) {
          setTimeOfDayBlocks(data.timeOfDayBlocks.map((t: string) => String(t).trim().slice(0, 5)));
        } else {
          setTimeOfDayBlocks([]);
        }
        setSteps(
          (data.steps ?? []).map((s: any, i: number) => ({
            id: s.id,
            title: s.title ?? "",
            order: s.order ?? i,
          }))
        );
        setEstimatedTimeMinutes(data.estimatedTimeMinutes != null ? String(data.estimatedTimeMinutes) : "");
      });
    }
  }, [id, isEdit, mode]);

  const selectedGoal = goals.find((g) => g.id === goalId);
  const milestoneOptions = selectedGoal?.milestones ?? [];

  const hasCustomDates = customRepeatDates.filter(Boolean).length > 0;
  const hasAtLeastOneRepeat = Boolean(repeatUnit) || hasCustomDates;

  const [titleError, setTitleError] = useState<string | null>(null);
  const [repeatError, setRepeatError] = useState<string | null>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [estimatedTimeError, setEstimatedTimeError] = useState<string | null>(null);
  useEffect(() => {
    if (title.trim() && titleError) setTitleError(null);
  }, [title, titleError]);
  useEffect(() => {
    if (hasAtLeastOneRepeat && repeatError) setRepeatError(null);
  }, [hasAtLeastOneRepeat, repeatError]);
  const validStepsCount = steps.filter((s) => s.title.trim()).length;
  useEffect(() => {
    if (validStepsCount > 0 && stepsError) setStepsError(null);
  }, [validStepsCount, stepsError]);
  useEffect(() => {
    const est = estimatedTimeMinutes.trim();
    if (est !== "") {
      const n = parseInt(est, 10);
      if (Number.isFinite(n) && n >= 0 && n <= MAX_ESTIMATED_MINUTES && estimatedTimeError)
        setEstimatedTimeError(null);
    }
  }, [estimatedTimeMinutes, estimatedTimeError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(performIntervalSubmit);
  };

  const performIntervalSubmit = async () => {
    setTitleError(null);
    setRepeatError(null);
    setStepsError(null);
    setEstimatedTimeError(null);
    if (!title.trim()) {
      setTitleError(t("intervals.errors.titleRequired"));
      return;
    }
    const estStr = estimatedTimeMinutes.trim();
    const estNum = estStr === "" ? null : parseInt(estStr, 10);
    if (estStr === "" || !Number.isFinite(estNum)) {
      setEstimatedTimeError(t("intervals.errors.estimatedRequired"));
      return;
    }
    if (estNum! < 0 || estNum! > MAX_ESTIMATED_MINUTES) {
      setEstimatedTimeError(t("intervals.errors.estimatedRange"));
      return;
    }
    if (mode === "interval" && !hasAtLeastOneRepeat) {
      setRepeatError(t("intervals.errors.repeatRequired"));
      return;
    }
    if (validStepsCount === 0) {
      setStepsError(t("intervals.errors.stepRequired"));
      return;
    }

    const endTimeIso = endTime ? fromDateTimeLocal(endTime) : undefined;
    const customDates =
      customRepeatDates.length > 0 ? customRepeatDates.filter(Boolean) : undefined;
    let customRepeatRulePayload: string | undefined;
    const repeatTimeBlocks = timeOfDayBlocks
      .map((t) => t.trim().slice(0, 5))
      .filter((t) => /^\d{2}:\d{2}$/.test(t));
    if (repeatUnit === "week" && customRepeatRuleDaysOfWeek.length > 0) {
      customRepeatRulePayload = JSON.stringify({
        unit: "week",
        daysOfWeek: [...customRepeatRuleDaysOfWeek].sort((a, b) => a - b),
        ...(repeatTimeBlocks.length > 0 ? { timeOfDayBlocks: repeatTimeBlocks } : {}),
      });
    } else if (repeatUnit === "month" && customRepeatRuleDaysOfMonth.length > 0) {
      customRepeatRulePayload = JSON.stringify({
        unit: "month",
        daysOfMonth: [...customRepeatRuleDaysOfMonth].sort((a, b) => a - b),
        ...(repeatTimeBlocks.length > 0 ? { timeOfDayBlocks: repeatTimeBlocks } : {}),
      });
    } else if (repeatUnit === "year" && customRepeatRuleMonths.length > 0) {
      const yearRule: { unit: string; months: number[]; daysOfMonth?: number[]; timeOfDayBlocks?: string[] } = {
        unit: "year",
        months: [...customRepeatRuleMonths].sort((a, b) => a - b),
      };
      if (customRepeatRuleYearDaysOfMonth.length > 0) {
        yearRule.daysOfMonth = [...customRepeatRuleYearDaysOfMonth].sort((a, b) => a - b);
      }
      if (repeatTimeBlocks.length > 0) {
        yearRule.timeOfDayBlocks = repeatTimeBlocks;
      }
      customRepeatRulePayload = JSON.stringify(yearRule);
    } else if (repeatTimeBlocks.length > 0) {
      customRepeatRulePayload = JSON.stringify({
        unit: repeatUnit || "day",
        timeOfDayBlocks: repeatTimeBlocks,
      });
    }
    const predictedToDoTimeStr =
      predictedToDoTime.trim().slice(0, 5) && /^\d{2}:\d{2}$/.test(predictedToDoTime.trim().slice(0, 5))
        ? predictedToDoTime.trim().slice(0, 5)
        : undefined;
    const stepsPayload = steps.filter((s) => s.title.trim()).map((s, i) => ({ title: s.title.trim(), order: i }));

    const scope = { goalId: goalId || null, milestoneId: milestoneId || null, projectId: projectId || null };
    if (mode === "interval") {
      const onlyOne = [scope.goalId, scope.milestoneId, scope.projectId].filter(Boolean);
      if (onlyOne.length > 1) {
        setScopeError(t("intervals.errors.scopeOnlyOne"));
        return;
      }
      setScopeError(null);
    }

    try {
      if (mode === "routine") {
        const blocks = timeOfDayBlocks
          .map((t) => t.trim().slice(0, 5))
          .filter((t) => /^\d{2}:\d{2}$/.test(t));
        if (isEdit) {
          const res = await call({
            query: UPDATE_ROUTINE,
            variables: {
              id,
              title: title.trim(),
              estimatedTimeMinutes: estNum,
              status,
              endTime: endTime ? fromDateTimeLocal(endTime) : undefined,
              timeOfDayBlocks: blocks.length > 0 ? blocks : undefined,
              steps: stepsPayload,
            },
          });
          if (res?.updateRoutine) navigate("/activities/intervals");
        } else {
          const res = await call({
            query: ADD_ROUTINE,
            variables: {
              title: title.trim(),
              estimatedTimeMinutes: estNum,
              status,
              endTime: endTime ? fromDateTimeLocal(endTime) : undefined,
              timeOfDayBlocks: blocks.length > 0 ? blocks : undefined,
              steps: stepsPayload,
            },
          });
          if (res?.addRoutine) navigate("/activities/intervals");
        }
      } else {
        if (isEdit) {
          const res = await call({
            query: UPDATE_INTERVAL,
            variables: {
              id,
              title: title.trim(),
              estimatedTimeMinutes: estNum,
              status,
              endTime: endTimeIso,
              repeatValue,
              repeatUnit: repeatUnit || null,
              customRepeatDates: customDates,
              customRepeatRule: customRepeatRulePayload,
              predictedToDoTime: predictedToDoTimeStr,
              steps: stepsPayload,
              goalId: scope.goalId || undefined,
              milestoneId: scope.milestoneId || undefined,
              projectId: scope.projectId || undefined,
            },
          });
          if (res?.updateInterval) navigate("/activities/intervals");
        } else {
          const res = await call({
            query: ADD_INTERVAL,
            variables: {
              title: title.trim(),
              estimatedTimeMinutes: estNum,
              status,
              endTime: endTimeIso,
              repeatValue,
              repeatUnit: repeatUnit || null,
              customRepeatDates: customDates,
              customRepeatRule: customRepeatRulePayload,
              predictedToDoTime: predictedToDoTimeStr,
              steps: stepsPayload,
              goalId: scope.goalId || undefined,
              milestoneId: scope.milestoneId || undefined,
              projectId: scope.projectId || undefined,
            },
          });
          if (res?.addInterval) navigate("/activities/intervals");
        }
      }
    } catch (err) {
      console.error("Submit failed", err);
    }
  };

  const addCustomDate = () => setCustomRepeatDates((prev) => [...prev, ""]);
  const setCustomDateAt = (index: number, value: string) => {
    const next = value ? fromDateTimeLocal(value) : "";
    setCustomRepeatDates((prev) => {
      const out = [...prev];
      out[index] = next;
      return out;
    });
  };
  const removeCustomDate = (index: number) =>
    setCustomRepeatDates((prev) => prev.filter((_, i) => i !== index));

  const lastStepInputRef = useRef<HTMLInputElement>(null);
  const focusNewStepRef = useRef(false);

  const addStep = () => {
    setSteps((prev) => [...prev, { title: "", order: prev.length }]);
    focusNewStepRef.current = true;
  };

  useEffect(() => {
    if (focusNewStepRef.current && lastStepInputRef.current) {
      lastStepInputRef.current.focus();
      focusNewStepRef.current = false;
    }
  }, [steps.length]);

  const setStepTitleAt = (index: number, title: string) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, title } : s)));
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index));
  const reorderStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSteps((prev) => {
      const out = [...prev];
      const [removed] = out.splice(fromIndex, 1);
      out.splice(toIndex, 0, removed);
      return out;
    });
  };

  const handleStepsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = parseInt(String(active.id).replace("step-", ""), 10);
    const to = parseInt(String(over.id).replace("step-", ""), 10);
    if (!Number.isNaN(from) && !Number.isNaN(to)) reorderStep(from, to);
  };

  const handleDeleteConfirm = async () => {
    if (!id) return;
    if (mode === "interval") {
      await call({ query: DELETE_INTERVAL, variables: { id } });
    } else {
      await call({ query: DELETE_ROUTINE, variables: { id } });
    }
    setDeleteConfirmOpen(false);
    navigate("/activities/intervals");
  };

  const pageTitle = isEdit
    ? mode === "interval"
      ? t("intervals.editInterval")
      : t("intervals.editRoutine")
    : mode === "interval"
      ? t("intervals.addInterval")
      : t("intervals.addRoutine");

  return (
    <InternalPageLayout
      backLink={{ to: "/activities/intervals", label: `← ${t("intervals.backToIntervals")}` }}
      title={pageTitle}
      maxWidth="max-w-2xl"
      actions={
        isEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive ml-2"
            onClick={() => setDeleteConfirmOpen(true)}
            title={mode === "interval" ? t("intervals.deleteInterval") : t("intervals.deleteRoutine")}
            aria-label={mode === "interval" ? t("intervals.deleteInterval") : t("intervals.deleteRoutine")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : undefined
      }
    >
      {!isEdit && (
        <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
          <span className="text-sm font-medium">{t("intervals.typeLabel")}</span>
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => navigate("/activities/interval")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "interval"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted/50"
              )}
            >
              {t("intervals.interval")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/activities/routine")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "routine"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted/50"
              )}
            >
              {t("intervals.routine")}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2">
            {t("intervals.title")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <Input
            id="title"
            placeholder={mode === "interval" ? t("intervals.intervalTitlePlaceholder") : t("intervals.routineTitlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(titleError)}
            className={titleError ? "border-red-500 focus-visible:ring-red-500/30" : undefined}
          />
          {titleError && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {titleError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimatedTimeMinutes" className="flex items-center gap-2">
            {t("intervals.estimatedTimeMinutes")} <span className="text-destructive">*</span>
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
            className={
              estimatedTimeError
                ? "max-w-xs border-red-500 focus-visible:ring-red-500/30"
                : "max-w-xs"
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("intervals.estimatedHelp")}
          </p>
          {estimatedTimeError && (
            <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
              {estimatedTimeError}
            </p>
          )}
        </div>

        {mode === "routine" && (
          <div className="space-y-2">
            <Label htmlFor="timeOfDayBlock-0" className="flex items-center gap-2">
              {t("intervals.timeBlocks")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("intervals.timeBlocksRoutineHelp")}
            </p>
            {timeOfDayBlocks.map((block, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Label htmlFor={`timeOfDayBlock-${i}`} className="sr-only">{t("intervals.timeBlockLabel", { n: i + 1 })}</Label>
                <Input
                  id={`timeOfDayBlock-${i}`}
                  type="time"
                  value={block}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTimeOfDayBlocks((prev) => prev.map((t, j) => (j === i ? next : t)));
                  }}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setTimeOfDayBlocks((prev) => prev.filter((_, j) => j !== i))}
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
              onClick={() => setTimeOfDayBlocks((prev) => [...prev, "09:00"])}
            >
              <Plus className="h-4 w-4 mr-2" /> {t("intervals.addTimeBlock")}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Label htmlFor="status" className="text-sm font-medium">{t("intervals.status")}</Label>
          <Switch
            id="status"
            checked={status === "active"}
            onCheckedChange={(checked) => setStatus(checked ? "active" : "inactive")}
          />
          <span className="text-sm text-muted-foreground">
            {status === "active" ? t("intervals.active") : t("intervals.inactive")}
          </span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="endTime" className="flex items-center gap-2">
            {t("intervals.endDateOptional")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <DateTimeField
            id="endTime"
            min={minDateTimeLocal}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {mode === "interval" && (
          <div className="space-y-2">
            <Label htmlFor="predictedToDoTime" className="flex items-center gap-2">
              {t("intervals.defaultTodoTimeOptional")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("intervals.defaultTodoTimeHelp")}
            </p>
            <Input
              id="predictedToDoTime"
              type="time"
              value={predictedToDoTime}
              onChange={(e) => setPredictedToDoTime(e.target.value)}
              className="max-w-xs"
            />
          </div>
        )}

        {mode === "interval" && repeatError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {repeatError}
          </p>
        )}
        {mode === "interval" && (
        <AccordionSection
          title={
            <span className="flex items-center gap-2">
              {t("intervals.repeats")}
              <HintPopover textKey="hints.intervalRecurrence" conceptsAnchor="intervals-routines" />
            </span>
          }
          open={repeatsOpen}
          onToggle={() => setRepeatsOpen((o) => !o)}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repeatValue" className="flex items-center gap-2">
                {t("intervals.every")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="repeatValue"
                  type="number"
                  min={1}
                  value={repeatValue}
                  onChange={(e) => setRepeatValue(parseInt(e.target.value, 10) || 1)}
                  className="w-20"
                />
                <select
                  value={repeatUnit}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRepeatUnit(v);
                    if (v !== "week") setCustomRepeatRuleDaysOfWeek([]);
                    if (v !== "month") setCustomRepeatRuleDaysOfMonth([]);
                    if (v !== "year") {
                      setCustomRepeatRuleMonths([]);
                      setCustomRepeatRuleYearDaysOfMonth([]);
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
                    const selected = customRepeatRuleDaysOfWeek.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setCustomRepeatRuleDaysOfWeek((prev) =>
                            selected
                              ? prev.filter((x) => x !== value)
                              : [...prev, value].sort((a, b) => a - b)
                          );
                        }}
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
                    const selected = customRepeatRuleDaysOfMonth.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          setCustomRepeatRuleDaysOfMonth((prev) =>
                            selected
                              ? prev.filter((x) => x !== day)
                              : [...prev, day].sort((a, b) => a - b)
                          );
                        }}
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
                      const selected = customRepeatRuleMonths.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setCustomRepeatRuleMonths((prev) =>
                              selected
                                ? prev.filter((x) => x !== value)
                                : [...prev, value].sort((a, b) => a - b)
                            );
                          }}
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
                      const selected = customRepeatRuleYearDaysOfMonth.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setCustomRepeatRuleYearDaysOfMonth((prev) =>
                              selected
                                ? prev.filter((x) => x !== day)
                                : [...prev, day].sort((a, b) => a - b)
                            );
                          }}
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

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="intervalTimeBlock-0" className="flex items-center gap-2">
                {t("intervals.timeOfDayBlocksOptional")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("intervals.timeBlocksRepeatHelp")}
              </p>
              {timeOfDayBlocks.map((block, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Label htmlFor={`intervalTimeBlock-${i}`} className="sr-only">{t("intervals.timeBlockLabel", { n: i + 1 })}</Label>
                  <Input
                    id={`intervalTimeBlock-${i}`}
                    type="time"
                    value={block}
                    onChange={(e) => {
                      const next = e.target.value;
                      setTimeOfDayBlocks((prev) => prev.map((t, j) => (j === i ? next : t)));
                    }}
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setTimeOfDayBlocks((prev) => prev.filter((_, j) => j !== i))}
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
                onClick={() => setTimeOfDayBlocks((prev) => [...prev, "09:00"])}
              >
                <Plus className="h-4 w-4 mr-2" /> {t("intervals.addTimeBlock")}
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="customRepeatDate-0" className="flex items-center gap-2">
                {t("intervals.specificDatesOptional")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("intervals.specificDatesHelp")}
              </p>
              {customRepeatDates.map((iso, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Label htmlFor={`customRepeatDate-${i}`} className="sr-only">{t("intervals.dateLabel", { n: i + 1 })}</Label>
                  <DateTimeField
                    id={`customRepeatDate-${i}`}
                    min={minDateTimeLocal}
                    value={iso ? toDateTimeLocal(iso) : ""}
                    onChange={(e) => setCustomDateAt(i, e.target.value)}
                    className="flex-1 max-w-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomDate(i)}
                    aria-label={t("intervals.removeDate")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCustomDate}>
                <Plus className="h-4 w-4 mr-2" /> {t("intervals.addDate")}
              </Button>
            </div>
          </div>
        </AccordionSection>
        )}

        {stepsError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {stepsError}
          </p>
        )}
        <AccordionSection
          title={t("intervals.steps")}
          open={stepsOpen}
          onToggle={() => setStepsOpen((o) => !o)}
        >
          <p className="text-xs text-muted-foreground">
            {mode === "interval"
              ? t("intervals.stepsIntervalHelp")
              : t("intervals.stepsRoutineHelp")}
          </p>
          <DndContext collisionDetection={closestCenter} onDragEnd={handleStepsDragEnd}>
            <SortableContext items={steps.map((_, i) => `step-${i}`)} strategy={verticalListSortingStrategy}>
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  index={i}
                  onTitleChange={(value) => setStepTitleAt(i, value)}
                  onRemove={() => removeStep(i)}
                  onAddNext={addStep}
                  inputRef={i === steps.length - 1 ? lastStepInputRef : undefined}
                />
              ))}
            </SortableContext>
          </DndContext>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-2" /> {t("intervals.addStep")}
          </Button>
        </AccordionSection>

        {mode === "interval" && (
        <div className="space-y-2 pt-2">
          <Label>{t("intervals.linkToOptional")}</Label>
          {scopeError && (
            <Alert variant="destructive">
              <AlertDescription>{scopeError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-3">
            <select
              value={goalId}
              onChange={(e) => {
                setScopeError(null);
                setGoalId(e.target.value);
                setMilestoneId("");
                setProjectId("");
              }}
              disabled={Boolean(projectId)}
              className={cn(
                "flex h-9 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                projectId && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">{t("intervals.selectGoal")}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}{g.isGoalGroup ? t("intervals.goalGroupSuffix") : ""}
                </option>
              ))}
            </select>
            <select
              value={milestoneId}
              onChange={(e) => {
                setScopeError(null);
                setMilestoneId(e.target.value);
                setProjectId("");
              }}
              disabled={!selectedGoal || Boolean(projectId)}
              className={cn(
                "flex h-9 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm",
                (!selectedGoal || projectId) && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">{t("intervals.selectMilestone")}</option>
              {milestoneOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <select
              value={projectId}
              onChange={(e) => {
                setScopeError(null);
                setProjectId(e.target.value);
                setGoalId("");
                setMilestoneId("");
              }}
              disabled={Boolean(goalId || milestoneId)}
              className={cn(
                "flex h-9 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm",
                (goalId || milestoneId) && "opacity-60 cursor-not-allowed"
              )}
            >
              <option value="">{t("intervals.selectProject")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit" loading={submitting}>{t("intervals.save")}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/activities/intervals")} disabled={submitting}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>

      {isEdit && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
          title={mode === "interval" ? t("intervals.deleteIntervalTitle") : t("intervals.deleteRoutineTitle")}
          description={t("intervals.cannotBeUndone")}
          confirmLabel={t("intervals.delete")}
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />
      )}
    </InternalPageLayout>
  );
}
