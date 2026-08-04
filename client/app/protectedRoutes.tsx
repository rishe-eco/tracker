import ActivitiesPage from "./components/activities/ActivitiesPage";
import ConceptsPage from "./components/concepts/ConceptsPage";
import CalendarPage from "./components/calendar/CalendarPage";
import ToolsPage from "./components/tools/ToolsPage";
import ToolsHomePage from "./components/tools/ToolsHomePage";
import SettingsPage from "./components/settings/SettingsPage";
import TodayPage from "./components/today/TodayPage";
import ActionsListPage from "./components/actions/ActionsListPage";
import ActionForm from "./components/actions/ActionForm";
import ProjectsListPage from "./components/projects/ProjectsListPage";
import ProjectForm from "./components/projects/ProjectForm";
import GoalsListPage from "./components/goals/GoalsListPage";
import GoalForm from "./components/goals/GoalForm";
import ManageGoalPage from "./components/goals/ManageGoal";
import MilestoneForm from "./components/milestones/MilestoneForm";
import IntervalsListPage from "./components/intervals/IntervalsListPage";
import IntervalForm from "./components/intervals/IntervalForm";
import JournalsListPage from "./components/journals/JournalsListPage";
import JournalDetailPage from "./components/journals/JournalDetailPage";
import EvidenceLabPage from "./components/skills/EvidenceLabPage";
import EvidenceDrillPage from "./components/skills/EvidenceDrillPage";
import ClarityLabPage from "./components/skills/ClarityLabPage";
import ClaritySessionPage from "./components/skills/ClaritySessionPage";
import FeelingsNeedsPage from "./components/learn/FeelingsNeedsPage";
import FeelingsNeedsLoopPage from "./components/learn/FeelingsNeedsLoopPage";
import FeelingsNeedsHistoryPage from "./components/learn/FeelingsNeedsHistoryPage";
import FeelingsNeedsFramePage from "./components/learn/FeelingsNeedsFramePage";
import { Navigate } from "react-router";

export default [
  {
    index: true,
    element: <Navigate to="/today" replace />,
  },
  {
    path: "/concepts",
    element: <ConceptsPage />,
  },
  {
    path: "/activities",
    element: <ActivitiesPage />,
  },
  {
    path: "/tools",
    element: <ToolsHomePage />,
  },
  {
    path: "/tools/time-map",
    element: <ToolsPage />,
  },
  {
    path: "/tools/journals",
    element: <JournalsListPage />,
  },
  {
    path: "/tools/skills/evidence",
    element: <EvidenceLabPage />,
  },
  {
    path: "/tools/skills/evidence/drill",
    element: <EvidenceDrillPage />,
  },
  {
    path: "/tools/skills/clarity",
    element: <ClarityLabPage />,
  },
  {
    path: "/tools/skills/clarity/session",
    element: <ClaritySessionPage />,
  },
  {
    // Learn · Feelings & Needs (Module 1). Namespaced under /tools/learn per the
    // demo plan, mirroring how the skill tools sit under /tools/skills.
    path: "/tools/learn/feelings-needs",
    element: <FeelingsNeedsPage />,
  },
  {
    path: "/tools/learn/feelings-needs/frame",
    element: <FeelingsNeedsFramePage />,
  },
  {
    path: "/tools/learn/feelings-needs/loop",
    element: <FeelingsNeedsLoopPage />,
  },
  {
    path: "/tools/learn/feelings-needs/history",
    element: <FeelingsNeedsHistoryPage />,
  },
  {
    path: "/tools/journals/:id",
    element: <JournalDetailPage />,
  },
  {
    path: "/settings",
    element: <SettingsPage />,
  },
  {
    path: "/calendar",
    element: <CalendarPage />,
  },
  {
    path: "/today",
    element: <TodayPage />,
  },
  {
    path: "/activities/actions",
    element: <ActionsListPage />,
  },
  {
    path: "/activities/action/:id?",
    element: <ActionForm />,
  },
  {
    path: "/activities/projects",
    element: <ProjectsListPage />,
  },
  {
    path: "/activities/project/:id?",
    element: <ProjectForm />,
  },
  {
    path: "/activities/intervals",
    element: <IntervalsListPage />,
  },
  {
    path: "/activities/interval/:id?",
    element: <IntervalForm mode="interval" />,
  },
  {
    path: "/activities/routine/:id?",
    element: <IntervalForm mode="routine" />,
  },
  {
    path: "/activities/goals",
    element: <GoalsListPage />,
  },
  {
    path: "/activities/goal",
    element: <GoalForm />,
  },
  {
    path: "/activities/goal/:id",
    element: <ManageGoalPage />,
  },
  {
    path: "/activities/goal/:goalId/milestone/:milestoneId?",
    element: <MilestoneForm />,
  },
]
