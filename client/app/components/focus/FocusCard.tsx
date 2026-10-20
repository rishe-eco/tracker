import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { TOGGLE_ACTION, UPDATE_FOCUS_PERIOD } from "~/api/queries";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import AddActionForm from "./AddActionForm";
import CardMenu from "./CardMenu";
import FocusProjectCard from "./FocusProjectCard";
import ReschedulePopover from "./ReschedulePopover";
import { toKey, type FocusAction, type FocusPeriod, type FocusProject } from "./focusLogic";

type Props = {
  project: FocusProject;
  period: FocusPeriod;
  todayKey: string;
  /** Refetches the overview. After every change the page re-reads the server (B3 card, decision 1). */
  onChanged: () => void;
  /** An action was completed; the page shows its Undo toast. */
  onCompleted: (action: FocusAction) => void;
};

/**
 * `FocusProjectCard` with B3's row actions wired into its slots: complete,
 * reschedule, inline add, and the ⋯ menu. All state here is per card; the
 * server stays the only source of the counts, so every change ends in
 * `onChanged` rather than patching local state.
 */
export default function FocusCard({ project, period, todayKey, onChanged, onCompleted }: Props) {
  const { t } = useTranslation();
  const { call } = useApi();
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A second tap while the toggle is in flight would undo the first.
  const pending = useRef(false);

  const complete = async (action: FocusAction) => {
    if (pending.current) return;
    pending.current = true;
    try {
      setError(null);
      const res = await call({ query: TOGGLE_ACTION, variables: { id: action.id } });
      if (!res) {
        setError(t("focus.saveError"));
        return;
      }
      onCompleted(action);
      onChanged();
    } finally {
      pending.current = false;
    }
  };

  // PD-5: removing is `updateFocusPeriod` with this project's id left out.
  const remove = async () => {
    setError(null);
    const res = await call({
      query: UPDATE_FOCUS_PERIOD,
      variables: {
        id: period.id,
        input: {
          title: period.title,
          startDate: toKey(period.startDate),
          endDate: toKey(period.endDate),
          projectIds: period.projects.filter((p) => p.id !== project.id).map((p) => p.id),
        },
      },
    });
    if (res) onChanged();
    else setError(t("focus.saveError"));
  };

  const projectHref = `/activities/project/${project.id}`;

  return (
    <div className="space-y-1">
      <FocusProjectCard
        project={project}
        onComplete={complete}
        onDayClick={(a) => setRescheduleId((cur) => (cur === a.id ? null : a.id))}
        renderBelowRow={(a) =>
          rescheduleId === a.id ? (
            <ReschedulePopover
              action={a}
              todayKey={todayKey}
              onSaved={onChanged}
              onClose={() => setRescheduleId(null)}
            />
          ) : null
        }
        onAddAction={() => setAdding(true)}
        addForm={
          adding ? (
            <AddActionForm
              projectId={project.id}
              todayKey={todayKey}
              onAdded={onChanged}
              onCancel={() => setAdding(false)}
            />
          ) : undefined
        }
        menu={<CardMenu projectHref={projectHref} onRemove={() => setConfirmRemove(true)} />}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={() => setConfirmRemove(false)}
        title={t("focus.removeConfirmTitle", { project: project.title, period: period.title })}
        description={t("focus.removeConfirmBody")}
        confirmLabel={t("focus.remove")}
        cancelLabel={t("focus.cancel")}
        variant="destructive"
        onConfirm={remove}
      />
    </div>
  );
}
