import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Pencil, Sparkles, Flag, Info } from "lucide-react";
import HintPopover from "~/components/ui/HintPopover";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import { ADD_GOAL } from "~/api/queries";
import DodClarityWizard, {
  DIMENSION_KEYS,
  type ClarityResult,
  type DimensionKey,
  type DimensionAnswer,
  buildInitialAnswers,
  firstFlaggedStep,
} from "./DodClarityWizard";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

export default function GoalForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentGoalId = searchParams.get("parentGoalId") ?? undefined;
  const parentMilestoneId = searchParams.get("parentMilestoneId") ?? undefined;
  const returnGoalId = searchParams.get("returnGoalId") ?? undefined;

  const [title, setTitle] = useState("");
  const [dod, setDod] = useState("");
  const [isGoalGroup, setIsGoalGroup] = useState(false);
  const [clarityStatus, setClarityStatus] = useState<string | undefined>();
  const [flaggedDimensions, setFlaggedDimensions] = useState<DimensionKey[]>([]);
  const [partialAnswers, setPartialAnswers] = useState<Record<DimensionKey, DimensionAnswer> | undefined>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTargetStep, setWizardTargetStep] = useState<number | undefined>();
  const { call } = useApi(ADD_GOAL);
  const { submitting, run } = useSubmitGuard();

  function handleClarityComplete(result: ClarityResult) {
    setDod(result.dod);
    setClarityStatus(result.status);
    setFlaggedDimensions(result.flaggedDimensions);
    setPartialAnswers(buildInitialAnswers(result.status, result.flaggedDimensions));
    setWizardOpen(false);
    setWizardTargetStep(undefined);
  }

  function openWizard(startStep?: number) {
    setWizardTargetStep(startStep);
    setWizardOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(performGoalSubmit);
  };

  const performGoalSubmit = async () => {
    const variables = {
      title,
      dod,
      isGoalGroup,
      ...(parentGoalId && { parentGoalId }),
      ...(parentMilestoneId && { parentMilestoneId }),
      ...(clarityStatus && { dodClarityStatus: clarityStatus }),
      ...(clarityStatus && { dodFlaggedDimensions: flaggedDimensions }),
    };
    try {
      const res = await call({ variables });
      if (res?.addGoal) {
        if (returnGoalId) navigate(`/activities/goal/${returnGoalId}`);
        else if (parentGoalId) navigate(`/activities/goal/${parentGoalId}`);
        else navigate("/activities/goals");
      }
    } catch (err) {
      console.error("Failed to submit goal", err);
    }
  };

  const backTo = returnGoalId || parentGoalId
    ? { to: returnGoalId ? `/activities/goal/${returnGoalId}` : `/activities/goal/${parentGoalId}`, label: `← ${t("goalManage.backToGoal")}` }
    : { to: "/activities/goals", label: `← ${t("goalManage.backToGoals")}` };

  const activeAnswers =
    partialAnswers ?? buildInitialAnswers(clarityStatus, flaggedDimensions);

  const firstUnansweredStep = activeAnswers
    ? DIMENSION_KEYS.findIndex((k) => activeAnswers[k] === null)
    : -1;

  const resolvedInitialStep =
    wizardTargetStep !== undefined
      ? wizardTargetStep
      : firstUnansweredStep !== -1
        ? firstUnansweredStep
        : firstFlaggedStep(flaggedDimensions);

  return (
    <InternalPageLayout
      backLink={backTo}
      title={t("goalsList.newGoal")}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="goal-title" className="flex items-center gap-2">
            {t("goalsList.goalTitle")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          </Label>
          <Input
            id="goal-title"
            placeholder={t("goalsList.goalTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal-dod" className="flex items-center gap-2">
            {t("goalsList.dodOptional")} <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
            <HintPopover textKey="hints.dod" conceptsAnchor="hierarchy" />
          </Label>
          <Input
            id="goal-dod"
            placeholder={t("goalsList.dodOptional")}
            value={dod}
            onChange={(e) => setDod(e.target.value)}
          />

          {/* Clarity check button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dod.trim()}
            className="gap-2"
            onClick={() => openWizard()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {clarityStatus ? t("dodClarity.rerunCheck") : t("dodClarity.checkButton")}
            {clarityStatus === "green" && (
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            )}
            {clarityStatus === "amber" && (
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            )}
          </Button>

          {/* Flagged dimensions panel */}
          {flaggedDimensions.length > 0 && (
            <ul className="space-y-1 pt-1">
              {flaggedDimensions.map((key, i) => {
                const label = t(`dodClarity.dimension${key.charAt(0).toUpperCase() + key.slice(1)}`);
                return (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <Flag className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-amber-700">{label}</span>
                      <span className="text-muted-foreground mx-1">—</span>
                      <span className="text-muted-foreground">{t(`dodClarity.${key}Question`)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const stepIdx = DIMENSION_KEYS.indexOf(key);
                        openWizard(stepIdx !== -1 ? stepIdx : 0);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title={t("dodClarity.tipsToggle")}
                      aria-label={t("dodClarity.tipsToggle")}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isGoalGroup"
            checked={isGoalGroup}
            onCheckedChange={(v) => setIsGoalGroup(v === true)}
          />
          <Label htmlFor="isGoalGroup" className="text-sm font-normal cursor-pointer">
            {t("goalsList.goalGroupLabel")}
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={submitting}>{t("common.submit")}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>

      {wizardOpen && (
        <DodClarityWizard
          initialDod={dod}
          initialAnswers={activeAnswers}
          initialStep={resolvedInitialStep}
          onAnswerChange={(answers) => setPartialAnswers(answers)}
          onComplete={handleClarityComplete}
          onClose={() => { setWizardOpen(false); setWizardTargetStep(undefined); }}
        />
      )}
    </InternalPageLayout>
  );
}
