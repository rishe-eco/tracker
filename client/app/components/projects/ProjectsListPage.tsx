import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import ProjectPreview, { type ProjectPreviewProps, getProjectStatus } from "./ProjectPreview";
import { useApi } from "../../api/useApi";
import { GET_PROJECTS } from "~/api/queries";
import { parseDateOnly } from "~/utils/dateUtils";
import ListFilters from "~/components/ui/list-filters";
import { LoadingBlock } from "~/components/ui/spinner";

function getFirstTbdAction(actions: ProjectPreviewProps["actions"]): ProjectPreviewProps["firstTbdAction"] | undefined {
  return [...actions]
    .filter((a) => a.tbd && !a.done)
    .sort((a, b) => +a.tbd! - +b.tbd!)[0];
}

export default function ProjectsListPage() {
  const { t } = useTranslation();
  const projectsListSteps = [
    { title: t("onboarding.modules.projects-list.step1Title"), body: t("onboarding.modules.projects-list.step1Body") },
    { title: t("onboarding.modules.projects-list.step2Title"), body: t("onboarding.modules.projects-list.step2Body") },
  ];
  const [projects, setProjects] = useState<ProjectPreviewProps[] | null>(null);
  const [showLinksFilters, setShowLinksFilters] = useState(false);
  const [showStatusFilters, setShowStatusFilters] = useState(false);
  const [linkFilters, setLinkFilters] = useState({
    milestones: true,
    goals: true,
  });
  const [statusFilters, setStatusFilters] = useState({
    backlog: true,
    tbd: true,
    inProgress: true,
    ignored: true,
    done: true,
  });
  const navigate = useNavigate();
  const { call } = useApi(GET_PROJECTS);

  useEffect(() => {
    async function fetchProjects() {
      call({}).then((res) => {
        const data = res?.projects ?? [];
        const parsed = data.map((project: any) => ({
          ...project,
          actions: project.actions.map((a: any) => ({
            ...a,
            tbd: a.tbd ? parseDateOnly(a.tbd) : undefined,
          })),
          goalTitle: project.goal?.title ?? undefined,
          milestoneTitle: project.milestone?.title ?? undefined,
          showGoalContext: true,
        }));
        setProjects(parsed)
      });
    }

    fetchProjects();
  }, []);

  if (!projects) return <LoadingBlock className="p-6" />;

  const allLinksSelected = linkFilters.milestones && linkFilters.goals;
  const allStatusesSelected =
    statusFilters.backlog &&
    statusFilters.tbd &&
    statusFilters.inProgress &&
    statusFilters.ignored &&
    statusFilters.done;

  const linksLabel = allLinksSelected
    ? t("filters.all")
    : [
        linkFilters.milestones ? t("filters.milestones") : null,
        linkFilters.goals ? t("filters.goals") : null,
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

  const matchesLinkFilter = (p: ProjectPreviewProps) => {
    const isMilestone = Boolean(p.milestoneTitle);
    const isGoal = !isMilestone && Boolean(p.goalTitle);
    const isNone = !isMilestone && !isGoal;
    if (!linkFilters.milestones && !linkFilters.goals) return isNone;
    if (linkFilters.milestones && linkFilters.goals) return true;
    return (isMilestone && linkFilters.milestones) || (isGoal && linkFilters.goals);
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
      default:
        return false;
    }
  };

  const visibleProjects = projects.filter((p) => {
    const status = getProjectStatus(p);
    return matchesLinkFilter(p) && matchesStatusFilter(status);
  });

  // Keep previous behavior: if Done status is excluded, hide done actions inside project previews too.
  const displayProjects = statusFilters.done
    ? visibleProjects
    : visibleProjects.map((p) => ({
        ...p,
        actions: p.actions.filter((a) => !a.done),
      }));

  const resetFilters = () => {
    setLinkFilters({ milestones: true, goals: true });
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

  const linkOptions = [
    {
      id: "all",
      label: t("filters.all"),
      active: allLinksSelected,
      onClick: () => setLinkFilters({ milestones: true, goals: true }),
    },
    {
      id: "milestones",
      label: t("filters.milestones"),
      active: linkFilters.milestones,
      onClick: () => setLinkFilters((prev) => ({ ...prev, milestones: !prev.milestones })),
    },
    {
      id: "goals",
      label: t("filters.goals"),
      active: linkFilters.goals,
      onClick: () => setLinkFilters((prev) => ({ ...prev, goals: !prev.goals })),
    },
    {
      id: "none",
      label: t("filters.none"),
      alwaysMuted: true,
      onClick: () => setLinkFilters({ milestones: false, goals: false }),
    },
  ];

  const statusOptionDefs: [keyof typeof statusFilters, string][] = [
    ["backlog", t("goalManage.statusBacklog")],
    ["tbd", t("goalManage.statusTbd")],
    ["inProgress", t("goalManage.statusInProgress")],
    ["ignored", t("goalManage.statusIgnored")],
    ["done", t("goalManage.statusDone")],
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
      <ModuleIntroOverlay moduleKey="projects-list" steps={projectsListSteps} />
      <InternalPageLayout
      backLink={{ to: "/activities", label: `← ${t("activities.backToActivities")}` }}
      title={t("projects.title")}
      actions={
        <Button size="sm" onClick={() => navigate("/activities/project")}>
          <Plus className="h-4 w-4 mr-2" /> {t("projects.addProject")}
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
          {displayProjects.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("projects.noProjectsMatch")}</p>
          )}
          {displayProjects.map((project, i) => (
            <ProjectPreview
              key={project.id ?? i}
              {...project}
              showControls
              onDelete={(id) => setProjects((prev) => prev?.filter((p) => p.id !== id) ?? [])}
              firstTbdAction={getFirstTbdAction(project.actions)}
              goalTitle={project.goalTitle}
              milestoneTitle={project.milestoneTitle}
            />
          ))}
        </div>
      </div>
    </InternalPageLayout>
    </>
  );
}

export const mockProjects: ProjectPreviewProps[] = [
  {
    title: "Redesign landing page",
    id: "some-id34-5555-uyti-1123",
    dod: "All sections implemented and reviewed",
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    actions: [
      { id: "a1", done: true, title: "a1", tbd: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { id: "a2", done: false, title: "a2", tbd: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
      { id: "a3", done: false, title: "a3", tbd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    title: "Write blog series",
    id: "some-id34-5555-uyti-1125",
    dod: "3-part post complete",
    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    actions: [
      { id: "b1", done: false, title: "b1", tbd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
      { id: "b2", done: false, title: "b2", tbd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    title: "Refactor authentication flow",
    id: "some-id34-5555-uyti-1127",
    actions: [
      { id: "c1", done: false, title: "c1" },
    ],
  },
  {
    title: "Launch MVP",
    id: "some-id34-5555-uyti-1129",
    dod: "All core features launched",
    startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    actions: [
      { id: "d1", done: true, title: "d1", tbd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { id: "d2", done: false, title: "d2", tbd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { id: "d3", done: false, title: "d3", tbd: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    title: "Clean out email inbox",
    id: "some-id34-5555-uyti-1128",
    dod: "Inbox zero achieved",
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    actions: [
      { id: "e1", done: true, title: "e1", tbd: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
      { id: "e2", done: true, title: "e2", tbd: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  },
];
