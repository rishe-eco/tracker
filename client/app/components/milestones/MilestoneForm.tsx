import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { DatePickerGrid } from "~/components/ui/date-picker-grid";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import { ADD_MILESTONE, DELETE_MILESTONE, GET_GOAL, UPDATE_MILESTONE } from "~/api/queries";
import { Pencil, Trash2 } from "lucide-react";
import HintPopover from "~/components/ui/HintPopover";
import { isValid } from "date-fns";
import { useAppDate } from "~/i18n/useAppDate";
import { parseDateOnly, toLocalDateString } from "~/utils/dateUtils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

export default function MilestoneForm() {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  const { goalId, milestoneId } = useParams<{ goalId: string; milestoneId?: string }>();
  const navigate = useNavigate();
  const { call } = useApi();
  const { submitting, run } = useSubmitGuard();

  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const isEdit = Boolean(milestoneId);

  const [goalTitle, setGoalTitle] = useState("");
  const [title, setTitle] = useState("");
  const [doa, setDoa] = useState("");
  const [predictionDate, setPredictionDate] = useState<Date | undefined>(undefined);
  const [predictionDateLocked, setPredictionDateLocked] = useState(false);
  const [isLast, setIsLast] = useState(false);
  const [otherLastMilestoneTitle, setOtherLastMilestoneTitle] = useState<string | null>(null);
  const [confirmSetLastOpen, setConfirmSetLastOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!goalId) return;
    call({ query: GET_GOAL, variables: { id: goalId } }).then((res) => {
      const goal = res?.goal;
      if (!goal) return;
      setGoalTitle(goal.title ?? "");
      const milestones = goal.milestones ?? [];
      const otherLast = milestones.find((m: any) => m.id !== milestoneId && m.isLast);
      setOtherLastMilestoneTitle(otherLast ? otherLast.title : null);
      if (isEdit && milestoneId) {
        const milestone = milestones.find((m: any) => m.id === milestoneId);
        if (milestone) {
          setTitle(milestone.title ?? "");
          setDoa(milestone.doa ?? "");
          setIsLast(milestone.isLast ?? false);
          if (milestone.predictionDate) {
            setPredictionDate(parseDateOnly(milestone.predictionDate));
            setPredictionDateLocked(true);
          }
        }
      }
    });
  }, [goalId, milestoneId, isEdit]);

  const handleIsLastChange = (checked: boolean) => {
    if (!checked) {
      setIsLast(false);
      return;
    }
    if (otherLastMilestoneTitle) {
      setIsLast(true);
      setConfirmSetLastOpen(true);
      return;
    }
    setIsLast(true);
  };

  const handleConfirmSetLast = () => setConfirmSetLastOpen(false);

  const handleCancelSetLast = () => {
    setIsLast(false);
    setConfirmSetLastOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!milestoneId) return;
    await call({ query: DELETE_MILESTONE, variables: { id: milestoneId } });
    setDeleteConfirmOpen(false);
    navigate(`/activities/goal/${goalId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(performMilestoneSubmit);
  };

  const performMilestoneSubmit = async () => {
    if (!goalId) return;

    const predictionDateStr =
      predictionDate && isValid(predictionDate) ? toLocalDateString(predictionDate) : undefined;

    try {
      if (isEdit && milestoneId) {
        const res = await call({
          query: UPDATE_MILESTONE,
          variables: {
            id: milestoneId,
            title: title.trim(),
            doa: doa.trim() || null,
            predictionDate: predictionDateStr ?? null,
            isLast,
          },
        });
        if (res?.updateMilestone) {
          navigate(`/activities/goal/${goalId}`);
        }
      } else {
        const res = await call({
          query: ADD_MILESTONE,
          variables: {
            goalId,
            title: title.trim(),
            doa: doa.trim() || undefined,
            predictionDate: predictionDateStr,
            isLast,
          },
        });
        if (res?.addMilestone) {
          navigate(`/activities/goal/${goalId}`);
        }
      }
    } catch (err) {
      console.error("Failed to save milestone", err);
    }
  };

  const canSetPrediction =
    !isEdit || (isEdit && !predictionDateLocked);
  const showPredictionReadOnly = isEdit && predictionDate != null && predictionDateLocked;

  const handlePredictionSelect = (d: Date | undefined) => {
    setPredictionDate(d ?? undefined);
    if (d) setPredictionDateLocked(true);
  };

  if (!goalId) {
    return (
      <InternalPageLayout title={t("milestones.title")}>
        <p className="text-muted-foreground">{t("milestones.missingGoal")}</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate(-1)}>
          {t("common.cancel")}
        </Button>
      </InternalPageLayout>
    );
  }

  return (
    <InternalPageLayout
      backLink={{ to: `/activities/goal/${goalId}`, label: `← ${t("goalManage.backToGoal")}` }}
      title={isEdit ? t("milestones.editMilestone") : t("milestones.newMilestone")}
      maxWidth="max-w-xl"
      actions={
        isEdit ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive ml-2"
            onClick={() => setDeleteConfirmOpen(true)}
            title={t("milestones.deleteMilestone")}
            aria-label={t("milestones.deleteMilestone")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>{t("milestones.goal")}</Label>
          <Input value={goalTitle} readOnly className="bg-muted" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="milestone-title" className="flex items-center gap-2">
            {t("milestones.milestoneTitle")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <Input
            id="milestone-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("milestones.milestoneTitle")}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="doa" className="flex items-center gap-2">
            {t("milestones.doa")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            <HintPopover textKey="hints.doa" conceptsAnchor="hierarchy" />
          </Label>
          <Input
            id="doa"
            value={doa}
            onChange={(e) => setDoa(e.target.value)}
            placeholder={t("milestones.doaPlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("milestones.predictionDate")}</Label>
          {showPredictionReadOnly && predictionDate && isValid(predictionDate) ? (
            <div className="flex items-center gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                {fmt(predictionDate, "dayMonthYear")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPredictionDateLocked(false)}
              >
                {t("common.change")}
              </Button>
            </div>
          ) : canSetPrediction ? (
            <DatePickerGrid
              selected={predictionDate ?? null}
              onSelect={handlePredictionSelect}
              min={startOfToday}
              className="border rounded-md w-fit"
            />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="is-last"
            checked={isLast}
            onCheckedChange={(v) => handleIsLastChange(v === true)}
          />
          <Label htmlFor="is-last" className="font-normal cursor-pointer flex items-center gap-2">
            {t("milestones.lastMilestoneLabel")}
            <HintPopover textKey="hints.lastMilestone" conceptsAnchor="hierarchy" />
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={submitting}>{t("common.submit")}</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/activities/goal/${goalId}`)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmSetLastOpen}
        onOpenChange={(open) => !open && setConfirmSetLastOpen(false)}
        onCancel={handleCancelSetLast}
        title={t("milestones.setLastTitle")}
        description={
          otherLastMilestoneTitle
            ? t("milestones.setLastConfirm", { title: otherLastMilestoneTitle })
            : undefined
        }
        confirmLabel={t("milestones.setLast")}
        onConfirm={handleConfirmSetLast}
      />

      {isEdit && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => !open && setDeleteConfirmOpen(false)}
          title={t("milestones.deleteMilestoneConfirm")}
          description={t("milestones.deleteMilestoneDescription")}
          confirmLabel={t("common.delete")}
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />
      )}
    </InternalPageLayout>
  );
}
