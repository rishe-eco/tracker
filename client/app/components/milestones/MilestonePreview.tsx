import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import ProjectPreview, { type ProjectPreviewProps } from "../projects/ProjectPreview";
import { isProjectDoneForGoal } from "../goals/GoalPreview";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, StickyNote } from "lucide-react";
import { cn } from "~/lib/utils";
import NotesModal from "~/components/notes/NotesModal";

export type MilestonePreviewProject = {
  id: string;
  title: string;
  startDate?: Date | null;
  endDate?: Date | null;
  done: boolean;
  actions: { id: string; done: boolean }[];
};

export type DeleteMilestoneChoice = "delete-projects" | "move-to-goal" | "move-to-milestone";

export interface MilestonePreviewProps {
  id: string;
  title: string;
  doa?: string | null;
  projects: MilestonePreviewProject[];
  isOpen: boolean;
  onToggle: () => void;
  goalId: string;
  onAddProject: () => void;
  onEdit: () => void;
  onDeleteProject: (projectId: string) => void;
  onManageProject: (projectId: string) => void;
  onDeleteMilestone: (choice: DeleteMilestoneChoice, targetMilestoneId?: string) => void;
  /** Other milestones in the same goal (for "move to another milestone" option). */
  otherMilestones: { id: string; title: string }[];
  onActionAdded?: () => void;
}

export default function MilestonePreview({
  id,
  title,
  doa,
  projects,
  isOpen,
  onToggle,
  onAddProject,
  onEdit,
  onDeleteProject,
  onManageProject,
  onDeleteMilestone,
  otherMilestones,
  onActionAdded,
}: MilestonePreviewProps) {
  const { t } = useTranslation();
  const [showDeleteChoices, setShowDeleteChoices] = useState(false);
  const [moveToMilestoneId, setMoveToMilestoneId] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  const done = projects.filter((p) => isProjectDoneForGoal(p)).length;
  const total = projects.length;
  const progress = total ? (done / total) * 100 : 0;

  const handleDeleteChoice = (choice: DeleteMilestoneChoice) => {
    if (choice === "move-to-milestone" && !moveToMilestoneId) return;
    onDeleteMilestone(choice, choice === "move-to-milestone" ? moveToMilestoneId : undefined);
    setShowDeleteChoices(false);
    setMoveToMilestoneId("");
  };

  return (
    <div className="border rounded-md overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="p-0.5 rounded hover:bg-muted"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <span className="font-medium text-sm flex-1">{title}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onEdit}
          title={t("milestones.editMilestone")}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setNotesOpen(true)}
          title={t("notes.openNotes")}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onAddProject}
          title={t("projects.addProject")}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => setShowDeleteChoices((v) => !v)}
          title={t("milestones.deleteMilestone")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {showDeleteChoices && (
        <div className="px-3 py-2 border-t bg-muted/30 space-y-2 text-sm">
          <p className="font-medium text-foreground">{t("milestones.deleteMilestoneWhatAbout")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteChoice("delete-projects")}
            >
              {t("milestones.deleteProjects")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleDeleteChoice("move-to-goal")}
            >
              {t("milestones.moveToGoal")}
            </Button>
            {otherMilestones.length > 0 ? (
              <div className="flex items-center gap-2">
                <select
                  value={moveToMilestoneId}
                  onChange={(e) => setMoveToMilestoneId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">{t("milestones.anotherMilestone")}</option>
                  {otherMilestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDeleteChoice("move-to-milestone")}
                  disabled={!moveToMilestoneId}
                >
                  {t("milestones.move")}
                </Button>
              </div>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowDeleteChoices(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      )}
      <Progress value={progress} className={cn("rounded-none h-1.5", !isOpen && "opacity-70")} />
      {!isOpen && doa?.trim() && (
        <p className="px-3 py-1.5 text-xs text-muted-foreground border-t line-clamp-2">
          {doa.trim()}
        </p>
      )}
      {isOpen && (
        <div className="p-3 space-y-3 border-t">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("milestones.noProjectsInMilestone")}
            </p>
          ) : (
            projects.map((p) => (
              <ProjectPreview
                key={p.id}
                {...(p as unknown as ProjectPreviewProps)}
                showControls
                showGoalContext={false}
                onDelete={() => onDeleteProject(p.id)}
                onManage={() => onManageProject(p.id)}
                onActionAdded={onActionAdded}
              />
            ))
          )}
        </div>
      )}
      {notesOpen && (
        <NotesModal
          entityType="milestone"
          entityId={id}
          entityTitle={title}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </div>
  );
}
