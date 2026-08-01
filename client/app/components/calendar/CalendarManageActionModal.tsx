import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

export type ManageModalAction = {
  id: string;
  title: string;
  done?: boolean;
  project?: {
    id: string;
    title: string;
    goal?: { id: string; title: string } | null;
    milestone?: { id: string; title: string } | null;
  } | null;
};

type ManageModalProject = {
  id: string;
  title: string;
  actions: { id: string; title: string; done?: boolean }[];
  goal?: { id: string; title: string } | null;
  milestone?: { id: string; title: string } | null;
};

type ManageModalGoal = {
  id: string;
  title: string;
  milestones?: { id: string; title: string }[];
};

interface CalendarManageActionModalProps {
  open: boolean;
  actions: ManageModalAction[];
  projects: ManageModalProject[];
  goals: ManageModalGoal[];
  initiallySelectedActionIds: string[];
  onClose: () => void;
  onApply: (actionIds: string[]) => void;
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function CalendarManageActionModal({
  open,
  actions,
  projects,
  goals,
  initiallySelectedActionIds,
  onClose,
  onApply,
}: CalendarManageActionModalProps) {
  const { t } = useTranslation();
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(new Set());
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<string>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(
    () => new Set(initiallySelectedActionIds)
  );

  useEffect(() => {
    if (!open) return;
    setSelectedActionIds(new Set(initiallySelectedActionIds));
  }, [open, initiallySelectedActionIds]);

  const projectById = useMemo(() => {
    const map = new Map<string, ManageModalProject>();
    for (const project of projects) map.set(project.id, project);
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
    const goalMap = new Map<
      string,
      { id: string; title: string; milestones: { id: string; title: string }[] }
    >();

    for (const goal of goals) {
      goalMap.set(goal.id, {
        id: goal.id,
        title: goal.title,
        milestones: goal.milestones ?? [],
      });
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

    return Array.from(goalMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("calendarPage.addActionsToQueue")}
    >
      <div
        className="h-full w-full bg-card p-4 sm:mx-auto sm:my-8 sm:h-auto sm:max-h-[86vh] sm:max-w-4xl sm:rounded-lg sm:border sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("calendarPage.addActionsToQueue")}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("calendarPage.close")}
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {t("calendarPage.selectActionsHelp")}
        </p>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {groupedGoals.map((goal) => {
            const goalProjects =
              (goalToProjectIds.get(goal.id) ?? [])
                .map((id) => projectById.get(id))
                .filter((p): p is ManageModalProject => !!p) ?? [];

            return (
              <div key={goal.id} className="space-y-2 rounded-md border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={selectedGoalIds.has(goal.id)}
                    onCheckedChange={() =>
                      setSelectedGoalIds((prev) => toggleSet(prev, goal.id))
                    }
                  />
                  {goal.title}
                  <Badge variant="secondary">{t("tools.entityGoal")}</Badge>
                </label>

                {goal.milestones?.map((milestone) => {
                  const milestoneProjects =
                    (milestoneToProjectIds.get(milestone.id) ?? [])
                      .map((id) => projectById.get(id))
                      .filter((p): p is ManageModalProject => !!p) ?? [];

                  return (
                    <div key={milestone.id} className="ml-4 space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedMilestoneIds.has(milestone.id)}
                          onCheckedChange={() =>
                            setSelectedMilestoneIds((prev) =>
                              toggleSet(prev, milestone.id)
                            )
                          }
                        />
                        {milestone.title}
                        <Badge variant="secondary">{t("tools.entityMilestone")}</Badge>
                      </label>

                      {milestoneProjects.map((project) => (
                        <div key={project.id} className="ml-4 space-y-1.5">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={selectedProjectIds.has(project.id)}
                              onCheckedChange={() =>
                                setSelectedProjectIds((prev) =>
                                  toggleSet(prev, project.id)
                                )
                              }
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
                                    onCheckedChange={() =>
                                      setSelectedActionIds((prev) =>
                                        toggleSet(prev, action.id)
                                      )
                                    }
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
                          onCheckedChange={() =>
                            setSelectedProjectIds((prev) =>
                              toggleSet(prev, project.id)
                            )
                          }
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
                                onCheckedChange={() =>
                                  setSelectedActionIds((prev) =>
                                    toggleSet(prev, action.id)
                                  )
                                }
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
                    onCheckedChange={() =>
                      setSelectedActionIds((prev) => toggleSet(prev, action.id))
                    }
                  />
                  {action.title}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {t("calendarPage.selectedActionsCount", { count: selectedActionsFromEntities.length })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => onApply(selectedActionsFromEntities)}>
              {t("calendarPage.addSelected")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
