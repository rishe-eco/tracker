import ActivityPanel from "~/components/activities/ActivityPanel";
import ActionPreview from "../actions/ActionPreview";
import { useEffect, useState, type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import ProjectPreview, { type Project } from "../projects/ProjectPreview";
import { type Action } from "../actions/ActionsListPage";
import type { Goal } from "../goals/GoalPreview";
import GoalPreview from "../goals/GoalPreview";
import IntervalPreview, { type IntervalPreviewProps } from "../intervals/IntervalPreview";
import { GET_ACTIONS, GET_GOALS, GET_PROJECTS, GET_INTERVALS } from "~/api/queries";
import { useApi } from "~/api/useApi";

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const [actions, setActions] = useState<Action[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [intervals, setIntervals] = useState<IntervalPreviewProps[]>([]);
  const { call } = useApi();

  useEffect(() => {
    async function fetchActions() {
      call({ query: GET_ACTIONS }).then(res => {
        setActions(res?.actions ?? []);
      })
      // const { gql } = await import("@apollo/client");
      // const query = gql(GET_ACTIONS);
      // const res = await fetch("http://localhost:4000/graphql", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ query: query.loc?.source.body }),
      // });
      // const json = await res.json();
    }
    async function fetchProjects() {
      call({
        query: GET_PROJECTS
      }).then(res => {
        setProjects(res?.projects ?? []);
      })
      // const { gql } = await import("@apollo/client");
      // const query = gql(GET_PROJECTS);
      // const res = await fetch("http://localhost:4000/graphql", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ query: query.loc?.source.body }),
      // });
      // const json = await res.json();
    }
    async function fetchGoals() {
      call({ query: GET_GOALS }).then(res => {
        setGoals(res?.goals ?? []);
      })
    }
    async function fetchIntervals() {
      call({ query: GET_INTERVALS }).then(res => {
        setIntervals(res?.intervals ?? []);
      });
    }

    fetchActions();
    fetchProjects();
    fetchGoals();
    fetchIntervals();
  }, []);

  const handleDeleteAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };
  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };
  const handleDeleteInterval = (id: string) => {
    setIntervals((prev) => prev.filter((iv) => iv.id !== id));
  };

  const handleToggleDone = async (id: string, done: boolean) => {
    setActions(prev => prev.map((a) =>
    a.id === id ? { ...a, done } : a
  )); // <-- keep all actions, even done ones
  };
  

  const renderActionPreviews = useCallback(() => {
    const visible = actions.filter((a) => !a.done);
    const result: { preview1?: ReactNode; preview2?: ReactNode } = {};
    if (visible[0]) {
      result.preview1 = (
        <ActionPreview
          action={visible[0]}
          onDelete={() => handleDeleteAction(visible[0].id ?? '')}
          onToggle={handleToggleDone}
        />
      );
    }
    if (visible[1]) {
      result.preview2 = (
        <ActionPreview
          action={visible[1]}
          onDelete={() => handleDeleteAction(visible[1].id ?? '')}
          onToggle={handleToggleDone}
        />
      );
    }
    return result;
  }, [actions])

  const renderProjectPreviews = () => {
    if (!projects?.[0]) return {};
    const result: { preview1?: ReactNode; preview2?: ReactNode } = {};
    result.preview1 = <ProjectPreview compact showControls {...projects[0]} onDelete={handleDeleteProject} />;
    if (projects[1]) result.preview2 = <ProjectPreview compact showControls {...projects[1]} onDelete={handleDeleteProject} />;
    return result;
  };

  const renderGoalPreviews = () => {
    if (!goals?.[0]) return {};
    const result: { preview1?: ReactNode; preview2?: ReactNode } = {};
    result.preview1 = <GoalPreview showControls {...goals[0]} />;
    if (goals[1]) result.preview2 = <GoalPreview showControls {...goals[1]} />;
    return result;
  };

  const renderIntervalPreviews = () => {
    const active = intervals.filter((iv) => iv.status === "active");
    if (!active[0]) return {};
    const result: { preview1?: ReactNode; preview2?: ReactNode } = {};
    result.preview1 = <IntervalPreview showControls {...active[0]} onDelete={handleDeleteInterval} />;
    if (active[1]) result.preview2 = <IntervalPreview showControls {...active[1]} onDelete={handleDeleteInterval} />;
    return result;
  };

  return (
    <main className="space-y-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("activities.title")}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <ActivityPanel type="goal" title={t("activities.goals")} {...renderGoalPreviews()} />
        <ActivityPanel type="project" title={t("activities.projects")} {...renderProjectPreviews()} />
        <ActivityPanel type="interval" title={t("activities.intervalsAndRoutines")} {...renderIntervalPreviews()} />
        <ActivityPanel type="action" title={t("activities.actions")} {...renderActionPreviews()} />
      </div>
    </main>
  );
}
