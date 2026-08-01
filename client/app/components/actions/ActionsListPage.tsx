import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ActionPreview from "./ActionPreview";
import { useApi } from "~/api/useApi";
import { GET_ACTIONS, DELETE_ACTION } from "~/api/queries";
import { parseDateOnly } from "~/utils/dateUtils";
import { format, isAfter, isBefore, isToday, isValid } from "date-fns";
import ListFilters from "~/components/ui/list-filters";
import { LoadingBlock } from "~/components/ui/spinner";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

export interface Action {
  id?: string;
  title: string;
  tbd?: Date;
  done?: boolean;
  priority?: string;
  project?: { id: string; title: string } | null;
  goal?: { id: string; title: string } | null;
  milestone?: { id: string; title: string } | null;
}



export default function ActionsListPage() {
  const { t } = useTranslation();
  const [actions, setActions] = useState<Action[] | null>(null);
  const [showLinksFilters, setShowLinksFilters] = useState(false);
  const [showStatusFilters, setShowStatusFilters] = useState(false);
  const [linkFilters, setLinkFilters] = useState({
    project: true,
    milestones: true,
    goals: true,
  });
  const [statusFilters, setStatusFilters] = useState({
    backlog: true,
    bucketList: true,
    tbd: true,
    inProgress: true,
    ignored: true,
    done: true,
  });
  const { call } = useApi();

  useEffect(() => {
    async function fetchActions() {
      call({ query: GET_ACTIONS }).then((res) => {
        const list = (res?.actions ?? []).map((a: any) => ({
          ...a,
          tbd: a.tbd ? parseDateOnly(a.tbd) : undefined,
          goal: a.project?.goal ?? undefined,
          milestone: a.project?.milestone ?? undefined,
        }));
        setActions(list);
      });
    }

    fetchActions();
  }, []);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  function getActionStatus(action: Action): string {
    if (action.done) return "Done";
    if (!action.tbd) return "Backlog";
    const tbd = parseDateOnly(action.tbd);
    if (!isValid(tbd)) return "Backlog";
    if (isToday(tbd)) return "In Progress";
    if (isBefore(tbd, new Date())) return "Ignored";
    if (isAfter(tbd, new Date())) return "TBD";
    return "";
  }

  function toggleDone(id: string, done: boolean) {
    setActions((prev) =>
      (prev as Action[]).map((a) => (a.id === id ? { ...a, done } : a))
    );
  }

  function deleteAction(id: string) {
    setActions((prev) => (prev as Action[]).filter((a) => a.id !== id));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { submitting: bulkDeleting, run: runBulkDelete } = useSubmitGuard();

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await runBulkDelete(async () => {
      try {
        await Promise.all(
          ids.map((id) => call({ query: DELETE_ACTION, variables: { id } }))
        );
        setActions((prev) => (prev as Action[]).filter((a) => a.id && !selectedIds.has(a.id)));
        setSelectedIds(new Set());
        setSelectionMode(false);
      } catch (err) {
        console.error("Failed to delete selected:", err);
      }
    });
  }

  const sorted = [...(actions ?? [])].sort((a, b) => {
    if (!a.tbd) return -1;
    if (!b.tbd) return 1;
    const aTbd = parseDateOnly(a.tbd);
    const bTbd = parseDateOnly(b.tbd);
    return aTbd.getTime() - bTbd.getTime();
  });

  const allLinksSelected = linkFilters.project && linkFilters.milestones && linkFilters.goals;
  const allStatusesSelected =
    statusFilters.backlog &&
    statusFilters.bucketList &&
    statusFilters.tbd &&
    statusFilters.inProgress &&
    statusFilters.ignored &&
    statusFilters.done;

  const linksLabel = allLinksSelected
    ? t("filters.all")
    : [
        linkFilters.project ? t("filters.project") : null,
        linkFilters.milestones ? t("filters.milestones") : null,
        linkFilters.goals ? t("filters.goals") : null,
      ]
        .filter(Boolean)
        .join(", ") || t("filters.none");

  const statusLabel = allStatusesSelected
    ? t("filters.all")
    : [
        statusFilters.backlog ? t("goalManage.statusBacklog") : null,
        statusFilters.bucketList ? t("filters.bucketList") : null,
        statusFilters.tbd ? t("goalManage.statusTbd") : null,
        statusFilters.inProgress ? t("goalManage.statusInProgress") : null,
        statusFilters.ignored ? t("goalManage.statusIgnored") : null,
        statusFilters.done ? t("goalManage.statusDone") : null,
      ]
        .filter(Boolean)
        .join(", ") || t("filters.none");

  const matchesLinkFilter = (a: Action) => {
    const isProject = Boolean(a.project?.id);
    const isMilestone = Boolean(a.milestone?.id);
    const isGoal = !isMilestone && Boolean(a.goal?.id);
    const isNone = !isProject && !isMilestone && !isGoal;
    if (!linkFilters.project && !linkFilters.milestones && !linkFilters.goals) return isNone;
    if (linkFilters.project && linkFilters.milestones && linkFilters.goals) return true;
    return (
      (isProject && linkFilters.project) ||
      (isMilestone && linkFilters.milestones) ||
      (isGoal && linkFilters.goals)
    );
  };

  const matchesStatusFilter = (status: string, action: Action) => {
    const isBucketList = status === "Backlog" && !action.project && !action.goal && !action.milestone;
    if (isBucketList) return statusFilters.bucketList;
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

  const visible = sorted.filter((a) => {
    const status = getActionStatus(a);
    return matchesLinkFilter(a) && matchesStatusFilter(status, a);
  });

  const resetFilters = () => {
    setLinkFilters({ project: true, milestones: true, goals: true });
    setStatusFilters({
      backlog: true,
      bucketList: true,
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
      onClick: () => setLinkFilters({ project: true, milestones: true, goals: true }),
    },
    {
      id: "project",
      label: t("filters.project"),
      active: linkFilters.project,
      onClick: () => setLinkFilters((prev) => ({ ...prev, project: !prev.project })),
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
      onClick: () => setLinkFilters({ project: false, milestones: false, goals: false }),
    },
  ];
  const statusOptionDefs: [keyof typeof statusFilters, string][] = [
    ["backlog", t("goalManage.statusBacklog")],
    ["bucketList", t("filters.bucketList")],
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
          bucketList: true,
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

  if (!actions) return <LoadingBlock />;

  return (
    <InternalPageLayout
      backLink={{ to: "/activities", label: `← ${t("activities.backToActivities")}` }}
      title={t("actionsList.title")}
      actions={
        <Button size="sm" onClick={() => navigate("/activities/action")}>
          <Plus className="h-4 w-4 mr-2" /> {t("actionsList.addAction")}
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

        <div className="flex items-center gap-4 flex-wrap">
        {!selectionMode ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectionMode(true);
              setSelectedIds(new Set());
            }}
          >
            {t("actionsList.select")}
          </Button>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">
              {t("actionsList.selectedCount", { count: selectedIds.size })}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              loading={bulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t("common.delete")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
            >
              {t("actionsList.doneSelecting")}
            </Button>
          </>
        )}
        </div>

      <div className="space-y-4">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("actionsList.noActionsMatch")}</p>
        )}
        {selectionMode ? (
          visible.map((action) => {
            const id = action.id ?? "";
            const selected = selectedIds.has(id);
            return (
              <div
                key={id}
                className="flex items-center gap-3 rounded-md border px-4 py-2 shadow-sm cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSelected(id)}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleSelected(id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm line-clamp-1">{action.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {action.tbd
                      ? format(parseDateOnly(action.tbd), "MMM d, yyyy")
                      : t("actions.statusNoDate")}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          visible.map((action) => (
            <ActionPreview
              key={action.id}
              action={action}
              onDelete={deleteAction}
              onToggle={toggleDone}
            />
          ))
        )}
      </div>
      </div>
    </InternalPageLayout>
  );
}
