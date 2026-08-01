import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import InternalPageLayout from "~/layout/InternalPageLayout";
import HintPopover from "~/components/ui/HintPopover";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import GoalPreview, { type GoalPreviewProps, getGoalStatus } from "./GoalPreview";
import type { Action } from "../actions/ActionsListPage";
import { useApi } from "~/api/useApi";
import { GET_GOALS } from "~/api/queries";
import { parseDateOnly } from "~/utils/dateUtils";
import ListFilters from "~/components/ui/list-filters";
import { LoadingBlock } from "~/components/ui/spinner";



function getFirstTbdProject(projects: GoalPreviewProps["projects"]): GoalPreviewProps["firstTbdProject"] | undefined {
  return [...projects]
    .filter((p) => p.startDate && p.endDate && !p.done)
    .sort((a, b) => +a.startDate! - +b.startDate!)[0];
}

export default function GoalsListPage() {
  const { t } = useTranslation();
  const goalsListSteps = [
    { title: t("onboarding.modules.goals-list.step1Title"), body: t("onboarding.modules.goals-list.step1Body") },
    { title: t("onboarding.modules.goals-list.step2Title"), body: t("onboarding.modules.goals-list.step2Body") },
  ];
  const [goals, setGoals] = useState<GoalPreviewProps[] | null>(null);
  const [showLinksFilters, setShowLinksFilters] = useState(false);
  const [showStatusFilters, setShowStatusFilters] = useState(false);
  const [linkFilters, setLinkFilters] = useState({
    groupGoal: true,
    individualGoal: true,
  });
  const [statusFilters, setStatusFilters] = useState({
    backlog: true,
    tbd: true,
    inProgress: true,
    ignored: true,
    done: true,
  });
  const navigate = useNavigate();
  const { call } = useApi(GET_GOALS);

  useEffect(() => {
    async function fetchGoals() {
      call().then(res => {
        const data = res?.goals ?? [];
  
        const parseProject = (p: any) => ({
          id: p.id,
          title: p.title,
          startDate: p.startDate ? parseDateOnly(p.startDate) : undefined,
          endDate: p.endDate ? parseDateOnly(p.endDate) : undefined,
          done: Array.isArray(p.actions) && p.actions.length > 0 && p.actions.every((a: Action) => a.done),
        });
        const parsed = data.map((goal: any) => ({
          ...goal,
          startDate: goal.startDate ? parseDateOnly(goal.startDate) : undefined,
          endDate: goal.endDate ? parseDateOnly(goal.endDate) : undefined,
          milestones: (goal.milestones ?? []).map((m: any) => ({ id: m.id, title: m.title })),
          projects: [
            ...(goal.projects ?? []).map(parseProject),
            ...(goal.milestones ?? []).flatMap((m: any) =>
              (m.projects ?? []).map(parseProject)
            ),
          ],
        }));
  
        setGoals(parsed);
      })
    }

    fetchGoals();
  }, []);

  if (!goals) return <LoadingBlock className="p-6" />;

  const allLinksSelected = linkFilters.groupGoal && linkFilters.individualGoal;
  const allStatusesSelected =
    statusFilters.backlog &&
    statusFilters.tbd &&
    statusFilters.inProgress &&
    statusFilters.ignored &&
    statusFilters.done;

  const linksLabel = allLinksSelected
    ? t("filters.all")
    : [
        linkFilters.groupGoal ? t("filters.groupGoal") : null,
        linkFilters.individualGoal ? t("filters.individualGoal") : null,
      ]
        .filter(Boolean)
        .join(", ") || t("filters.none");

  const statusLabel = allStatusesSelected
    ? t("filters.all")
    : [
        statusFilters.backlog ? t("goalManage.statusBacklog") : null,
        statusFilters.tbd ? t("goalManage.statusTbd") : null,
        statusFilters.inProgress ? t("goalManage.statusInProgress") : null,
        statusFilters.ignored ? t("goalManage.statusIgnored") : null,
        statusFilters.done ? t("goalManage.statusDone") : null,
      ]
        .filter(Boolean)
        .join(", ") || t("filters.none");

  const matchesLinkFilter = (g: GoalPreviewProps) => {
    const isGroupGoal = g.isGoalGroup === true;
    const isIndividualGoal = g.isGoalGroup === false;
    const isNone = g.isGoalGroup == null;
    if (!linkFilters.groupGoal && !linkFilters.individualGoal) return isNone;
    if (linkFilters.groupGoal && linkFilters.individualGoal) return true;
    return (isGroupGoal && linkFilters.groupGoal) || (isIndividualGoal && linkFilters.individualGoal);
  };

  const matchesStatusFilter = (status: string) => {
    switch (status) {
      case "Backlog":
        return statusFilters.backlog;
      case "TBD":
        return statusFilters.tbd;
      case "In Progress":
        return statusFilters.inProgress;
      case "Ignored":
        return statusFilters.ignored;
      case "Done":
        return statusFilters.done;
      // Goal groups are containers without a computable status — always show them
      case "GoalGroup":
        return true;
      default:
        return false;
    }
  };

  const visibleGoals = goals.filter((g) => {
    const status = getGoalStatus(g);
    return matchesLinkFilter(g) && matchesStatusFilter(status);
  });

  const resetFilters = () => {
    setLinkFilters({ groupGoal: true, individualGoal: true });
    setStatusFilters({
      backlog: true,
      tbd: true,
      inProgress: true,
      ignored: true,
      done: true,
    });
    setShowLinksFilters(false);
    setShowStatusFilters(false);
  };

  const statusOptionDefs: [keyof typeof statusFilters, string][] = [
    ["backlog", t("goalManage.statusBacklog")],
    ["tbd", t("goalManage.statusTbd")],
    ["inProgress", t("goalManage.statusInProgress")],
    ["ignored", t("goalManage.statusIgnored")],
    ["done", t("goalManage.statusDone")],
  ];
  const linkOptions = [
    {
      id: "all",
      label: t("filters.all"),
      active: allLinksSelected,
      onClick: () => setLinkFilters({ groupGoal: true, individualGoal: true }),
    },
    {
      id: "groupGoal",
      label: t("filters.groupGoal"),
      active: linkFilters.groupGoal,
      onClick: () => setLinkFilters((prev) => ({ ...prev, groupGoal: !prev.groupGoal })),
    },
    {
      id: "individualGoal",
      label: t("filters.individualGoal"),
      active: linkFilters.individualGoal,
      onClick: () => setLinkFilters((prev) => ({ ...prev, individualGoal: !prev.individualGoal })),
    },
    {
      id: "none",
      label: t("filters.none"),
      alwaysMuted: true,
      onClick: () => setLinkFilters({ groupGoal: false, individualGoal: false }),
    },
  ];
  const statusOptions = [
    {
      id: "all",
      label: t("filters.all"),
      active: allStatusesSelected,
      onClick: () =>
        setStatusFilters({
          backlog: true,
          tbd: true,
          inProgress: true,
          ignored: true,
          done: true,
        }),
    },
    ...statusOptionDefs.map(([key, label]) => ({
      id: key,
      label,
      active: statusFilters[key],
      onClick: () =>
        setStatusFilters((prev) => {
          const selectedCount = Object.values(prev).filter(Boolean).length;
          return {
            ...prev,
            [key]: prev[key] && selectedCount === 1 ? true : !prev[key],
          };
        }),
    })),
  ];

  return (
    <>
      <ModuleIntroOverlay moduleKey="goals-list" steps={goalsListSteps} />
      <InternalPageLayout
      backLink={{ to: "/activities", label: `← ${t("activities.backToActivities")}` }}
      title={
        <span className="flex items-center gap-2">
          {t("goalsList.title")}
          <HintPopover textKey="hints.goalsList" conceptsAnchor="hierarchy" />
        </span>
      }
      actions={
        <Button size="sm" onClick={() => navigate("/activities/goal")}>
          <Plus className="h-4 w-4 mr-2" /> {t("goalsList.addGoal")}
        </Button>
      }
    >
      <div className="space-y-6">
        <ListFilters
          linksLabel={linksLabel}
          statusLabel={statusLabel}
          showLinksFilters={showLinksFilters}
          showStatusFilters={showStatusFilters}
          onToggleLinks={() => {
            setShowLinksFilters((v) => !v);
            setShowStatusFilters(false);
          }}
          onToggleStatus={() => {
            setShowStatusFilters((v) => !v);
            setShowLinksFilters(false);
          }}
          onReset={resetFilters}
          linkOptions={linkOptions}
          statusOptions={statusOptions}
        />

        <div className="space-y-4">
          {visibleGoals.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("goalsList.noGoalsMatch")}</p>
          )}
          {visibleGoals.map((goal, i) => (
            <GoalPreview
              key={goal.id ?? i}
              {...goal}
              showControls
              onDelete={(id) => setGoals((prev) => prev?.filter((g) => g.id !== id) ?? [])}
              firstTbdProject={getFirstTbdProject(goal.projects)}
            />
          ))}
        </div>
      </div>
    </InternalPageLayout>
    </>
  );
}
