import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import ProjectPreview, { type ProjectPreviewProps } from "../projects/ProjectPreview";
import MilestonePreview from "../milestones/MilestonePreview";
import { getGoalStatus, isProjectDoneForGoal } from "./GoalPreview";
import { useApi } from "~/api/useApi";
import { DELETE_GOAL, DELETE_MILESTONE, DELETE_PROJECT, GET_GOAL, GET_GOALS, GET_INTERVALS, GET_PROJECTS, UPDATE_GOAL, UPDATE_INTERVAL, UPDATE_MILESTONE, UPDATE_PROJECT, SAVE_DOD_CLARITY } from "~/api/queries";
import { parseDateOnly } from "~/utils/dateUtils";
import { ListOrdered, Star, GripVertical, Trash2, ChevronDown, ChevronRight, Repeat, Sparkles, Flag, Info, StickyNote } from "lucide-react";
import DodClarityWizard, {
  DIMENSION_KEYS,
  type ClarityResult,
  type DimensionKey,
  type DimensionAnswer,
  buildInitialAnswers,
  firstFlaggedStep,
} from "./DodClarityWizard";
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
import { cn } from "~/lib/utils";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { InlineEdit } from "~/components/ui/inline-edit";
import NotesModal from "~/components/notes/NotesModal";
import { LoadingBlock } from "~/components/ui/spinner";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

type ParsedProject = ProjectPreviewProps & {
  startDate: Date | null;
  endDate: Date | null;
  done: boolean;
};

type ParsedChildGoal = { id: string; title: string; isGoalGroup?: boolean };

type ParsedInterval = { id: string; title: string; status: string };

type ParsedMilestone = {
  id: string;
  title: string;
  doa?: string | null;
  order: number;
  isLast: boolean;
  projects: ParsedProject[];
  childGoals?: ParsedChildGoal[];
  intervals?: ParsedInterval[];
};

type StoryItem =
  | { type: "project"; sortDate: Date | null; project: ParsedProject }
  | { type: "milestone"; sortDate: Date | null; milestone: ParsedMilestone };

function projectSortDate(p: ParsedProject): Date | null {
  return p.startDate ?? p.endDate ?? null;
}

function milestoneSortDate(m: ParsedMilestone): Date | null {
  if (!m.projects.length) return null;
  const dates = m.projects.map(projectSortDate).filter((d): d is Date => d != null);
  if (!dates.length) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

function SortableMilestoneRow({
  milestone,
  onSetLast,
}: {
  milestone: ParsedMilestone;
  onSetLast: () => void;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30",
        isDragging && "opacity-50 z-10"
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none py-1"
        title={t("goalManage.dragToReorder")}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="font-medium text-sm flex-1">{milestone.title}</span>
      <Button
        size="sm"
        variant={milestone.isLast ? "default" : "outline"}
        onClick={onSetLast}
        title={t("goalManage.markAsLastMilestone")}
      >
        <Star className={cn("h-4 w-4", milestone.isLast && "fill-current")} />
        {milestone.isLast ? ` ${t("goalManage.last")}` : ` ${t("goalManage.setLast")}`}
      </Button>
    </div>
  );
}

export default function ManageGoalPage() {
  const { t } = useTranslation();
  const manageGoalSteps = [
    { title: t("onboarding.modules.manage-goal.step1Title"), body: t("onboarding.modules.manage-goal.step1Body") },
    { title: t("onboarding.modules.manage-goal.step2Title"), body: t("onboarding.modules.manage-goal.step2Body") },
    { title: t("onboarding.modules.manage-goal.step3Title"), body: t("onboarding.modules.manage-goal.step3Body") },
  ];
  const { id } = useParams();
  const navigate = useNavigate();

  const [goal, setGoal] = useState<any>(null);
  const [loadError, setLoadError] = useState<"errorNotFound" | "errorParse" | "errorLoad" | null>(null);
  const [openMilestoneIds, setOpenMilestoneIds] = useState<Set<string>>(new Set());
  const [reorderMode, setReorderMode] = useState(false);
  const [confirmState, setConfirmState] = useState<
    | { type: "delete-project"; projectId: string }
    | { type: "set-last"; milestoneId: string; currentLastTitle: string }
    | null
  >(null);
  const [deleteGoalConfirmOpen, setDeleteGoalConfirmOpen] = useState(false);
  const [linkGoalToGoal, setLinkGoalToGoal] = useState(false);
  const [linkGoalToMilestone, setLinkGoalToMilestone] = useState<string | null>(null);
  const [linkableGoals, setLinkableGoals] = useState<{ id: string; title: string }[]>([]);
  const [selectedGoalToLink, setSelectedGoalToLink] = useState("");
  const [linkIntervalToGoal, setLinkIntervalToGoal] = useState(false);
  const [linkableIntervals, setLinkableIntervals] = useState<{ id: string; title: string }[]>([]);
  const [selectedIntervalToLink, setSelectedIntervalToLink] = useState("");
  const [linkProjectToGoal, setLinkProjectToGoal] = useState(false);
  const [linkableProjects, setLinkableProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectToLink, setSelectedProjectToLink] = useState("");
  const [clarityWizardOpen, setClarityWizardOpen] = useState(false);
  const [clarityWizardStep, setClarityWizardStep] = useState<number | undefined>();
  const [clarityPartialAnswers, setClarityPartialAnswers] = useState<Record<DimensionKey, DimensionAnswer> | undefined>();
  const [notesOpen, setNotesOpen] = useState(false);
  const { call, getLastError } = useApi();

  function openClarityWizard(startStep?: number) {
    setClarityWizardStep(startStep);
    setClarityWizardOpen(true);
  }

  const handleClarityComplete = async (result: ClarityResult) => {
    setClarityWizardOpen(false);
    setClarityWizardStep(undefined);
    setClarityPartialAnswers(buildInitialAnswers(result.status, result.flaggedDimensions));
    await call({
      query: SAVE_DOD_CLARITY,
      variables: {
        id,
        dod: result.dod,
        dodClarityStatus: result.status,
        dodFlaggedDimensions: result.flaggedDimensions,
      },
    });
    setGoal((prev: any) => ({
      ...prev,
      dod: result.dod,
      dodClarityStatus: result.status,
      dodFlaggedDimensions: result.flaggedDimensions,
    }));
  };

  const refetchGoal = () => {
    call({ query: GET_GOAL, variables: { id } }).then((res) => {
      const data = res?.goal;
      if (!data) return;
      setLoadError(null);
      try {
        setGoal(parseGoal(data));
      } catch {
        setLoadError("errorParse");
      }
    });
  };

  function parseGoal(data: any) {
    const parseProject = (p: any): ParsedProject => ({
      ...p,
      startDate: p.startDate ? parseDateOnly(p.startDate) : null,
      endDate: p.endDate ? parseDateOnly(p.endDate) : null,
      done: Array.isArray(p.actions) && p.actions.length > 0 && p.actions.every((a: any) => a.done),
    });
    const projects = (data.projects ?? []).map(parseProject);
    const parseInterval = (iv: any): ParsedInterval | null => {
      if (!iv || iv.id == null) return null;
      return { id: iv.id, title: iv.title ?? "", status: iv.status ?? "active" };
    };
    const safeParseIntervals = (arr: any[]): ParsedInterval[] =>
      (arr ?? []).filter(Boolean).map(parseInterval).filter((x): x is ParsedInterval => x != null);
    const milestones: ParsedMilestone[] = (data.milestones ?? []).filter(Boolean).map((m: any) => ({
      id: m.id,
      title: m.title,
      doa: m.doa ?? null,
      order: m.order ?? 0,
      isLast: m.isLast ?? false,
      projects: (m.projects ?? []).filter(Boolean).map(parseProject),
      childGoals: (m.childGoals ?? []).filter(Boolean).map((g: any) => ({ id: g.id, title: g.title, isGoalGroup: g.isGoalGroup })),
      intervals: safeParseIntervals(m.intervals ?? []),
    }));
    return {
      ...data,
      startDate: data.startDate ? parseDateOnly(data.startDate) : null,
      endDate: data.endDate ? parseDateOnly(data.endDate) : null,
      projects,
      milestones,
      childGoals: (data.childGoals ?? []).filter(Boolean).map((g: any) => ({ id: g.id, title: g.title, isGoalGroup: g.isGoalGroup })),
      intervals: safeParseIntervals(data.intervals ?? []),
    };
  }

  useEffect(() => {
    setLoadError(null);
    call({ query: GET_GOAL, variables: { id } })
      .then((res) => {
        const data = res?.goal;
        if (!data) {
          setLoadError("errorNotFound");
          return;
        }
        try {
          const parsed = parseGoal(data);
          setGoal(parsed);
        } catch {
          setLoadError("errorParse");
        }
      })
      .catch(() => {
        setLoadError("errorLoad");
      });
  }, [id]);

  const updateGoalField = async (field: string, value: string) => {
    call({
      query: UPDATE_GOAL,
      variables: { id, [field]: value },
    }).then(() => {
      setGoal((prev: any) => ({ ...prev, [field]: value }));
    });
  };

  const handleDeleteProjectClick = (projectId: string) => {
    setConfirmState({ type: "delete-project", projectId });
  };

  const handleDeleteProjectConfirm = async () => {
    if (confirmState?.type !== "delete-project") return;
    await call({
      query: DELETE_PROJECT,
      variables: { id: confirmState.projectId },
    });
    setConfirmState(null);
    refetchGoal();
  };

  const handleAddMilestone = () => {
    navigate(`/activities/goal/${id}/milestone`);
  };

  const fetchLinkableGoals = (res: any) => {
    const childIds = new Set((goal?.childGoals ?? []).map((c: ParsedChildGoal) => c.id));
    const underMilestones = (goal?.milestones ?? []).flatMap((m: ParsedMilestone) => (m.childGoals ?? []).map((c: ParsedChildGoal) => c.id));
    const alreadyChild = new Set([...childIds, ...underMilestones]);
    const list = (res?.goals ?? []).filter((g: any) => g.id !== id && !alreadyChild.has(g.id));
    setLinkableGoals(list.map((g: any) => ({ id: g.id, title: g.title })));
  };

  const openLinkGoalToGoal = () => {
    setLinkIntervalToGoal(false);
    setSelectedIntervalToLink("");
    setLinkProjectToGoal(false);
    setSelectedProjectToLink("");
    setLinkGoalToMilestone(null);
    setLinkGoalToGoal(true);
    setSelectedGoalToLink("");
    call({ query: GET_GOALS }).then(fetchLinkableGoals);
  };

  const openLinkGoalToMilestone = (milestoneId: string) => {
    setLinkIntervalToGoal(false);
    setSelectedIntervalToLink("");
    setLinkProjectToGoal(false);
    setSelectedProjectToLink("");
    setLinkGoalToGoal(false);
    setLinkGoalToMilestone(milestoneId);
    setSelectedGoalToLink("");
    call({ query: GET_GOALS }).then(fetchLinkableGoals);
  };

  const openLinkIntervalToGoal = () => {
    const alreadyLinkedIds = new Set([
      ...(goal?.intervals ?? []).map((iv: ParsedInterval) => iv.id),
      ...(goal?.milestones ?? []).flatMap((m: ParsedMilestone) =>
        (m.intervals ?? []).map((iv: ParsedInterval) => iv.id)
      ),
    ]);
    setLinkGoalToGoal(false);
    setLinkGoalToMilestone(null);
    setSelectedGoalToLink("");
    setLinkProjectToGoal(false);
    setSelectedProjectToLink("");
    setLinkIntervalToGoal(true);
    setSelectedIntervalToLink("");
    call({ query: GET_INTERVALS }).then((res) => {
      const list = (res?.intervals ?? []).filter((iv: any) => !alreadyLinkedIds.has(iv.id));
      setLinkableIntervals(list.map((iv: any) => ({ id: iv.id, title: iv.title ?? "" })));
    });
  };

  const openLinkProjectToGoal = () => {
    const alreadyLinkedProjectIds = new Set([
      ...((goal?.projects ?? []).map((p: ParsedProject) => p.id)),
      ...((goal?.milestones ?? []).flatMap((m: ParsedMilestone) => (m.projects ?? []).map((p: ParsedProject) => p.id))),
    ]);
    setLinkGoalToGoal(false);
    setLinkGoalToMilestone(null);
    setSelectedGoalToLink("");
    setLinkIntervalToGoal(false);
    setSelectedIntervalToLink("");
    setLinkProjectToGoal(true);
    setSelectedProjectToLink("");
    call({ query: GET_PROJECTS }).then((res) => {
      const list = (res?.projects ?? []).filter((p: any) => !alreadyLinkedProjectIds.has(p.id));
      setLinkableProjects(list.map((p: any) => ({ id: p.id, title: p.title ?? "" })));
    });
  };

  const closeLinkPanels = () => {
    setLinkGoalToGoal(false);
    setLinkGoalToMilestone(null);
    setSelectedGoalToLink("");
    setLinkIntervalToGoal(false);
    setSelectedIntervalToLink("");
    setLinkProjectToGoal(false);
    setSelectedProjectToLink("");
  };

  const { submitting: linking, run: runLink } = useSubmitGuard();

  const handleLinkGoal = async () => {
    if (!selectedGoalToLink) return;
    await runLink(async () => {
    await call({
      query: UPDATE_GOAL,
      variables: {
        id: selectedGoalToLink,
        ...(linkGoalToMilestone ? { parentMilestoneId: linkGoalToMilestone } : { parentGoalId: id }),
      },
    });
    closeLinkPanels();
    refetchGoal();
    });
  };

  const handleLinkInterval = async () => {
    if (!selectedIntervalToLink || !id) return;
    await runLink(async () => {
    await call({
      query: UPDATE_INTERVAL,
      variables: {
        id: selectedIntervalToLink,
        goalId: id,
        milestoneId: null,
        projectId: null,
      },
    });
    closeLinkPanels();
    refetchGoal();
    });
  };

  const handleLinkProject = async () => {
    if (!selectedProjectToLink || !id) return;
    await runLink(async () => {
    await call({
      query: UPDATE_PROJECT,
      variables: {
        id: selectedProjectToLink,
        goalId: id,
        milestoneId: null,
      },
    });
    closeLinkPanels();
    refetchGoal();
    });
  };


  const toggleMilestone = (milestoneId: string) => {
    setOpenMilestoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) next.delete(milestoneId);
      else next.add(milestoneId);
      return next;
    });
  };

  const handleSetLastMilestoneClick = (milestoneId: string) => {
    const currentLast = (goal?.milestones ?? []).find((m: ParsedMilestone) => m.isLast);
    if (currentLast && currentLast.id !== milestoneId) {
      setConfirmState({ type: "set-last", milestoneId, currentLastTitle: currentLast.title });
      return;
    }
    handleSetLastMilestoneConfirm(milestoneId);
  };

  const handleSetLastMilestoneConfirm = async (milestoneId?: string) => {
    const id = milestoneId ?? (confirmState?.type === "set-last" ? confirmState.milestoneId : null);
    if (!id) return;
    setConfirmState(null);
    await call({
      query: UPDATE_MILESTONE,
      variables: { id, isLast: true },
    });
    refetchGoal();
  };

  const handleMilestonesDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = goal?.milestones ?? [];
    const fromIndex = list.findIndex((m: ParsedMilestone) => m.id === active.id);
    const toIndex = list.findIndex((m: ParsedMilestone) => m.id === over.id);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const reordered = [...list];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    await Promise.all(
      reordered.map((m: ParsedMilestone, index: number) =>
        call({
          query: UPDATE_MILESTONE,
          variables: {
            id: m.id,
            order: index,
            isLast: index === reordered.length - 1,
          },
        })
      )
    );
    refetchGoal();
  };

  const handleDeleteMilestone = async (
    milestoneId: string,
    projectIds: string[],
    choice: "delete-projects" | "move-to-goal" | "move-to-milestone",
    targetMilestoneId?: string
  ) => {
    if (choice === "delete-projects") {
      await Promise.all(
        projectIds.map((projectId) =>
          call({ query: DELETE_PROJECT, variables: { id: projectId } })
        )
      );
    } else if (choice === "move-to-goal") {
      await Promise.all(
        projectIds.map((projectId) =>
          call({
            query: UPDATE_PROJECT,
            variables: { id: projectId, goalId: id, milestoneId: null },
          })
        )
      );
    } else if (choice === "move-to-milestone" && targetMilestoneId) {
      await Promise.all(
        projectIds.map((projectId) =>
          call({
            query: UPDATE_PROJECT,
            variables: { id: projectId, goalId: null, milestoneId: targetMilestoneId },
          })
        )
      );
    }
    await call({ query: DELETE_MILESTONE, variables: { id: milestoneId } });
    refetchGoal();
  };

  if (loadError) return <p className="p-6 text-destructive">{t(`goalManage.${loadError}`)}</p>;
  if (!goal) return <LoadingBlock className="p-6" label={t("goalManage.loading")} />;

  const allProjects = [
    ...goal.projects,
    ...(goal.milestones ?? []).flatMap((m: ParsedMilestone) => m.projects),
  ];
  const total = allProjects.length;
  const done = allProjects.filter((p) => isProjectDoneForGoal(p)).length;
  const statusRaw = getGoalStatus({ ...goal, projects: allProjects });
  const statusKey = statusRaw === "Done" ? "statusDone" : statusRaw === "In Progress" ? "statusInProgress" : statusRaw === "Backlog" ? "statusBacklog" : statusRaw === "TBD" ? "statusTbd" : "statusIgnored";
  const status = t(`goalManage.${statusKey}`);

  const storyItems: StoryItem[] = [
    ...goal.projects.map((p: ParsedProject) => ({
      type: "project" as const,
      sortDate: projectSortDate(p),
      project: p,
    })),
    ...(goal.milestones ?? []).map((m: ParsedMilestone) => ({
      type: "milestone" as const,
      sortDate: milestoneSortDate(m),
      milestone: m,
    })),
  ];
  storyItems.sort((a, b) => {
    const da = a.sortDate?.getTime() ?? Infinity;
    const db = b.sortDate?.getTime() ?? Infinity;
    if (da !== db) return da - db;
    if (a.type === "milestone" && b.type === "milestone")
      return a.milestone.order - b.milestone.order;
    return 0;
  });

  const hasAny = storyItems.length > 0;

  const handleDeleteGoalConfirm = async () => {
    if (!id) return;
    await call({ query: DELETE_GOAL, variables: { id } });
    setDeleteGoalConfirmOpen(false);
    navigate("/activities/goals");
  };

  const goalState = { from: "goal" as const, goalId: id! };
  const isGoalGroup = goal?.isGoalGroup === true;

  const titleBlock = (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {/* Row 1: title + status (left), delete (right) — full width so delete stays on the far right */}
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <InlineEdit
            id="goal-title-edit"
            value={goal.title}
            onSave={(v) => updateGoalField("title", v)}
            displayAs="h1"
            displayClassName="text-2xl font-bold flex-1 min-w-0"
            inputClassName="text-2xl font-bold"
          />
          <Badge variant="outline">{status}</Badge>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => setNotesOpen(true)}
          title={t("notes.openNotes")}
          aria-label={t("notes.openNotes")}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
          onClick={() => setDeleteGoalConfirmOpen(true)}
          title={t("goalManage.deleteGoal")}
          aria-label={t("goalManage.deleteGoal")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {/* Row 2: add/link buttons — stacked on small, row with wrap on bigger */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 text-base font-normal">
        {!isGoalGroup && (
          <Button size="sm" className="justify-start sm:justify-center" onClick={() => navigate(`/activities/project?goalId=${id}`, { state: goalState })}>
            {t("goalManage.addProject")}
          </Button>
        )}
        {!isGoalGroup && (
          <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={openLinkProjectToGoal}>
            {t("goalManage.linkExistingProject")}
          </Button>
        )}
        {isGoalGroup && (
          <>
            <Button size="sm" className="justify-start sm:justify-center" onClick={() => navigate(`/activities/goal?parentGoalId=${id}`)}>
              {t("goalManage.addGoal")}
            </Button>
            <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={openLinkGoalToGoal}>
              {t("goalManage.linkExistingGoal")}
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={handleAddMilestone}>
          {t("goalManage.addMilestone")}
        </Button>
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={() => navigate(`/activities/interval?goalId=${id}`)}>
          {t("goalManage.addInterval")}
        </Button>
        <Button size="sm" variant="outline" className="justify-start sm:justify-center" onClick={openLinkIntervalToGoal}>
          {t("goalManage.linkInterval")}
        </Button>
      </div>
    </div>
  );

  const backLink = goal.parentGoalId
    ? { to: `/activities/goal/${goal.parentGoalId}`, label: `← ${t("goalManage.backToGoal")}` }
    : goal.parentMilestone?.goal
      ? { to: `/activities/goal/${goal.parentMilestone.goal.id}`, label: `← ${t("goalManage.backToGoal")}` }
      : { to: "/activities/goals", label: `← ${t("goalManage.backToGoals")}` };

  return (
    <>
    <ModuleIntroOverlay moduleKey="manage-goal" steps={manageGoalSteps} />
    <InternalPageLayout
      backLink={backLink}
      title={titleBlock}
    >
      {(linkGoalToGoal || linkGoalToMilestone || linkIntervalToGoal || linkProjectToGoal) && (
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 p-3 rounded-md border bg-muted/30">
          <span className="text-sm">
            {linkIntervalToGoal
              ? t("goalManage.linkIntervalHelp")
              : linkProjectToGoal
                ? t("goalManage.linkProjectHelp")
              : linkGoalToMilestone
                ? t("goalManage.linkGoalToMilestoneHelp")
                : t("goalManage.linkGoalToGoalHelp")}
          </span>
          {linkIntervalToGoal ? (
            <select
              value={selectedIntervalToLink}
              onChange={(e) => setSelectedIntervalToLink(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0 sm:min-w-[180px]"
            >
              <option value="">{t("goalManage.selectInterval")}</option>
              {linkableIntervals.map((iv) => (
                <option key={iv.id} value={iv.id}>{iv.title}</option>
              ))}
            </select>
          ) : linkProjectToGoal ? (
            <select
              value={selectedProjectToLink}
              onChange={(e) => setSelectedProjectToLink(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0 sm:min-w-[180px]"
            >
              <option value="">{t("goalManage.selectProject")}</option>
              {linkableProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          ) : (
            <select
              value={selectedGoalToLink}
              onChange={(e) => setSelectedGoalToLink(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-0 sm:min-w-[180px]"
            >
              <option value="">{t("goalManage.selectGoal")}</option>
              {linkableGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={linkIntervalToGoal ? handleLinkInterval : linkProjectToGoal ? handleLinkProject : handleLinkGoal}
              disabled={linkIntervalToGoal ? !selectedIntervalToLink : linkProjectToGoal ? !selectedProjectToLink : !selectedGoalToLink}
              loading={linking}
            >
              {t("goalManage.link")}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeLinkPanels} disabled={linking}>
              {t("goalManage.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-2">
          <InlineEdit
            id="goal-dod-edit"
            value={goal.dod || ""}
            onSave={(v) => updateGoalField("dod", v)}
            displayAs="p"
            displayClassName="text-muted-foreground"
            inputClassName="flex-1 min-w-0"
            placeholder={t("goalManage.dodPlaceholder")}
            emptyDisplay={t("goalManage.dodEmptyDisplay")}
          />

          {/* DoD clarity section */}
          <div className="flex flex-wrap items-center gap-2">
            {goal.dodClarityStatus === "green" && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                {t("dodClarity.clarityGreen")}
              </span>
            )}
            {goal.dodClarityStatus === "amber" && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                {t("dodClarity.clarityAmber")}
              </span>
            )}
            {!goal.dodClarityStatus && (
              <span className="text-xs text-muted-foreground italic">{t("dodClarity.reminder")}</span>
            )}
            {goal.dodClarityStatus === "amber" && (
              <span className="text-xs text-muted-foreground italic">{t("dodClarity.reminderAmber")}</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!goal.dod?.trim()}
              className="gap-2"
              onClick={() => openClarityWizard(
                goal.dodClarityStatus
                  ? firstFlaggedStep(goal.dodFlaggedDimensions ?? [])
                  : 0
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {goal.dodClarityStatus ? t("dodClarity.rerunCheck") : t("dodClarity.runCheck")}
            </Button>
          </div>

          {/* Flagged dimensions panel */}
          {(goal.dodFlaggedDimensions ?? []).length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                {t("dodClarity.flaggedPanel")}
              </p>
              <ul className="space-y-2">
                {(goal.dodFlaggedDimensions as DimensionKey[]).map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <Flag className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-amber-800">
                        {t(`dodClarity.dimension${key.charAt(0).toUpperCase() + key.slice(1)}`)}
                      </span>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {t(`dodClarity.${key}Question`)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-auto shrink-0 text-amber-400 hover:text-amber-600"
                      title={t("dodClarity.tipsToggle")}
                      onClick={() => {
                        const stepIdx = DIMENSION_KEYS.indexOf(key);
                        openClarityWizard(stepIdx !== -1 ? stepIdx : 0);
                      }}
                      aria-label={t("dodClarity.tipsToggle")}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isGoalGroup && (
            <>
              <p className="text-sm text-muted-foreground">
                {goal.startDate && goal.endDate ? (
                  t("goalManage.fromToDates", {
                    from: goal.startDate.toDateString(),
                    to: goal.endDate.toDateString(),
                  })
                ) : (
                  t("goalManage.noScheduledTimeline")
                )}
              </p>
              <Progress value={(done / Math.max(total, 1)) * 100} />
            </>
          )}
        </div>

        {((goal.intervals ?? []).length > 0 || (goal.milestones ?? []).some((m: ParsedMilestone) => (m.intervals ?? []).length > 0)) && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              {t("goalManage.linkedIntervals")}
            </h2>
            {(goal.intervals ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("goalManage.thisGoal")}</h3>
                <ul className="space-y-1">
                  {(goal.intervals ?? []).map((iv: ParsedInterval) => (
                    <li key={iv.id} className="flex flex-wrap items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
                      <span className="font-medium text-sm flex-1 min-w-0">{iv.title}</span>
                      <Badge variant={iv.status === "active" ? "default" : "secondary"} className="text-xs">
                        {iv.status}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/activities/interval/${iv.id}`)}>
                        {t("goalManage.manage")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(goal.milestones ?? []).map((milestone: ParsedMilestone) =>
              (milestone.intervals ?? []).length > 0 ? (
                <div key={milestone.id}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("goalManage.milestonePrefix", { title: milestone.title })}</h3>
                  <ul className="space-y-1">
                    {(milestone.intervals ?? []).map((iv: ParsedInterval) => (
                      <li key={iv.id} className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30">
                        <span className="font-medium text-sm flex-1">{iv.title}</span>
                        <Badge variant={iv.status === "active" ? "default" : "secondary"} className="text-xs">
                          {iv.status}
                        </Badge>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/activities/interval/${iv.id}`)}>
                          {t("goalManage.manage")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        )}

        <div className="pt-4">
          <h2 className="text-lg font-semibold mb-4">{t("goalManage.theStory")}</h2>

          {isGoalGroup ? (
            <div className="space-y-4">
              {(goal.childGoals ?? []).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{t("goalManage.childGoals")}</h3>
                  <div className="space-y-2">
                    {(goal.childGoals ?? []).map((cg: ParsedChildGoal) => (
                      <div
                        key={cg.id}
                        className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2 bg-muted/30"
                      >
                        <span className="font-medium text-sm min-w-0 flex-1">{cg.title}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/activities/goal/${cg.id}`)}
                        >
                          {t("goalManage.manage")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(goal.milestones ?? []).map((milestone: ParsedMilestone) => (
                <div key={milestone.id} className="border rounded-md overflow-hidden shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 bg-muted/50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleMilestone(milestone.id)}
                      className="p-0.5 rounded hover:bg-muted shrink-0"
                      aria-expanded={openMilestoneIds.has(milestone.id)}
                    >
                      {openMilestoneIds.has(milestone.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <span className="font-medium text-sm flex-1 min-w-0">{milestone.title}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => navigate(`/activities/goal?parentMilestoneId=${milestone.id}&returnGoalId=${id}`)}
                      >
                        {t("goalManage.addGoal")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => openLinkGoalToMilestone(milestone.id)}
                      >
                        {t("goalManage.linkGoal")}
                      </Button>
                    </div>
                  </div>
                  {openMilestoneIds.has(milestone.id) && (milestone.childGoals ?? []).length > 0 && (
                    <div className="p-3 space-y-2 border-t">
                      {(milestone.childGoals ?? []).map((cg: ParsedChildGoal) => (
                        <div
                          key={cg.id}
                          className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2 bg-muted/30"
                        >
                          <span className="font-medium text-sm min-w-0 flex-1">{cg.title}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/activities/goal/${cg.id}`)}
                          >
                            {t("goalManage.manage")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {openMilestoneIds.has(milestone.id) && (!milestone.childGoals || milestone.childGoals.length === 0) && (
                    <p className="p-3 text-sm text-muted-foreground border-t">{t("goalManage.noChildGoalsInMilestone")}</p>
                  )}
                </div>
              ))}
              {(goal.childGoals ?? []).length === 0 && (goal.milestones ?? []).length === 0 && (
                <p className="text-muted-foreground">{t("goalManage.addGoalOrMilestoneToStart")}</p>
              )}
            </div>
          ) : (
            <>
          <div className="flex items-center justify-between gap-2 mb-4">
            <Button
              size="sm"
              variant={reorderMode ? "default" : "outline"}
              onClick={() => setReorderMode((v) => !v)}
              className="shrink-0"
            >
              {reorderMode ? (
                t("goalManage.done")
              ) : (
                <>
                  <ListOrdered className="h-4 w-4 mr-1" />
                  {t("goalManage.order")}
                </>
              )}
            </Button>
          </div>

          {reorderMode ? (
            (goal?.milestones ?? []).length === 0 ? (
              <p className="text-muted-foreground">{t("goalManage.noMilestonesYet")}</p>
            ) : (
              <DndContext collisionDetection={closestCenter} onDragEnd={handleMilestonesDragEnd}>
                <SortableContext
                  items={(goal?.milestones ?? []).map((m: ParsedMilestone) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {(goal?.milestones ?? []).map((milestone: ParsedMilestone) => (
                      <SortableMilestoneRow
                        key={milestone.id}
                        milestone={milestone}
                        onSetLast={() => handleSetLastMilestoneClick(milestone.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )
          ) : !hasAny ? (
            <p className="text-muted-foreground">{t("goalManage.noProjectsYet")}</p>
          ) : (
            <div className="space-y-4">
              {storyItems.map((item) => {
                if (item.type === "project") {
                  return (
                    <ProjectPreview
                      key={item.project.id}
                      {...item.project}
                      showControls
                      showGoalContext={false}
                      onDelete={() => handleDeleteProjectClick(item.project.id)}
                      onManage={() => navigate(`/activities/project/${item.project.id}?goalId=${id}`, { state: goalState })}
                      onActionAdded={refetchGoal}
                    />
                  );
                }
                const { milestone } = item;
                const isOpen = openMilestoneIds.has(milestone.id);
                return (
                  <MilestonePreview
                    key={milestone.id}
                    id={milestone.id}
                    title={milestone.title}
                    doa={milestone.doa}
                    projects={milestone.projects}
                    isOpen={isOpen}
                    onToggle={() => toggleMilestone(milestone.id)}
                    goalId={id!}
                    onAddProject={() =>
                      navigate(`/activities/project?goalId=${id}&milestoneId=${milestone.id}`, { state: goalState })
                    }
                    onEdit={() =>
                      navigate(`/activities/goal/${id}/milestone/${milestone.id}`)
                    }
                    onDeleteProject={handleDeleteProjectClick}
                    onManageProject={(projectId) =>
                      navigate(`/activities/project/${projectId}?goalId=${id}`, { state: goalState })
                    }
                    onDeleteMilestone={(choice, targetMilestoneId) =>
                      handleDeleteMilestone(
                        milestone.id,
                        milestone.projects.map((p) => p.id),
                        choice,
                        targetMilestoneId
                      )
                    }
                    otherMilestones={(goal.milestones ?? []).filter((m: ParsedMilestone) => m.id !== milestone.id)}
                    onActionAdded={refetchGoal}
                  />
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {clarityWizardOpen && (() => {
        const activeAnswers =
          clarityPartialAnswers ??
          buildInitialAnswers(goal.dodClarityStatus, goal.dodFlaggedDimensions ?? []);
        const firstUnanswered = activeAnswers
          ? DIMENSION_KEYS.findIndex((k) => activeAnswers[k] === null)
          : -1;
        const resolvedStep =
          clarityWizardStep !== undefined
            ? clarityWizardStep
            : firstUnanswered !== -1
              ? firstUnanswered
              : firstFlaggedStep(goal.dodFlaggedDimensions ?? []);
        return (
          <DodClarityWizard
            initialDod={goal.dod || ""}
            initialAnswers={activeAnswers}
            initialStep={resolvedStep}
            onAnswerChange={(answers) => setClarityPartialAnswers(answers)}
            onComplete={handleClarityComplete}
            onClose={() => { setClarityWizardOpen(false); setClarityWizardStep(undefined); }}
          />
        );
      })()}

      <ConfirmDialog
        open={confirmState?.type === "delete-project"}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={t("goalManage.deleteProjectTitle")}
        confirmLabel={t("goalManage.delete")}
        variant="destructive"
        onConfirm={handleDeleteProjectConfirm}
      />
      <ConfirmDialog
        open={confirmState?.type === "set-last"}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={t("goalManage.setLastMilestoneTitle")}
        description={
          confirmState?.type === "set-last"
            ? t("goalManage.setLastMilestoneConfirm", { title: confirmState.currentLastTitle })
            : undefined
        }
        confirmLabel={t("goalManage.setLast")}
        onConfirm={() => handleSetLastMilestoneConfirm()}
      />
      <ConfirmDialog
        open={deleteGoalConfirmOpen}
        onOpenChange={(open) => !open && setDeleteGoalConfirmOpen(false)}
        title={t("goalManage.deleteGoalTitle")}
        description={isGoalGroup
          ? t("goalManage.deleteGoalDescriptionGroup")
          : t("goalManage.deleteGoalDescriptionGoal")}
        confirmLabel={t("goalManage.delete")}
        variant="destructive"
        onConfirm={handleDeleteGoalConfirm}
      />
      {notesOpen && id && (
        <NotesModal
          entityType="goal"
          entityId={id}
          entityTitle={goal?.title}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </InternalPageLayout>
    </>
  );
}
