import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import {
  COMMIT_MONITORING_EXPLANATION,
  COMMIT_MONITORING_PREDICTION,
  COMMIT_MONITORING_RATING,
  COMPLETE_SKILL_PROBE,
  MARK_MONITORING_CHECKPOINT,
  MARK_MONITORING_INFLUENCE,
  SELECT_MONITORING_COUNTERMEASURE,
  SELECT_MONITORING_STEPS,
  START_MONITORING_ITEM,
  SUBMIT_MONITORING_ANSWER,
} from "~/api/queries";
import MasteryGapList from "./MasteryGapList";
import MonitoringRubricRail, { type MonitoringCriterionScore } from "./MonitoringRubricRail";
import DeflationDisplay from "./DeflationDisplay";
import TranscriptAudit, { type MonitoringTurn } from "./TranscriptAudit";
import SkillSelfReportForm from "./SkillSelfReportForm";

type ItemKind = "recall" | "pair" | "explain" | "transcript" | "longset";

type MonitoringItem = {
  itemId: string;
  moduleKey: string;
  difficulty: number;
  kind: ItemKind;
  question: string | null;
  explainPrompt: string | null;
  authoredExplanation: string | null;
  pairId: string | null;
  pairHalf: "assisted" | "unassisted" | null;
  turns: MonitoringTurn[] | null;
  checkpoints: { checkpointId: string; text: string }[] | null;
  countermeasureOptions: { optionId: string; label: string }[] | null;
};

type Served = { attemptId: string; item: MonitoringItem };

type SubmitResult = {
  attemptId: string;
  score: {
    criteria: MonitoringCriterionScore[];
    total: number;
    scoredCount: number;
    predictionSample: { prediction: string; outcome: number } | null;
    ratingSample: { pairId: string; pairHalf: string; rating: number } | null;
    deflation: { before: number; after: number } | null;
    influenceResult: { hits: number; falseAlarms: number; plantedTotal: number; misses: number } | null;
    checkRate: { firstThird: number; lastThird: number; decay: number | null } | null;
  };
  moduleState: string;
  masteryUnmet: { code: string; count?: number; required?: number; minTotal?: number }[];
};

const PREDICTION_LEVELS = ["no_idea", "probably_not", "probably", "confident"] as const;

type Stage =
  | "predict"
  | "answer"
  | "rating"
  | "ratingBefore"
  | "explain"
  | "ratingAfter"
  | "selectSteps"
  | "transcript"
  | "checkpoints"
  | "countermeasure"
  | "result";

export default function MonitoringSessionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { call } = useApi();

  const moduleKey = params.get("module") ?? undefined;
  const probeId = params.get("probeId") ?? undefined;
  const timepoint = params.get("timepoint") ?? undefined;
  const isProbe = params.get("mode") === "assessment" && Boolean(probeId) && Boolean(timepoint);
  const mode = isProbe ? "assessment" : moduleKey ? "module" : "calibrated_practice";

  const [served, setServed] = useState<Served | null>(null);
  const [stage, setStage] = useState<Stage>("predict");
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeDone, setProbeDone] = useState(false);

  const [predictionLevel, setPredictionLevel] = useState<(typeof PREDICTION_LEVELS)[number] | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingBefore, setRatingBefore] = useState<number | null>(null);
  const [explanationText, setExplanationText] = useState("");
  const [steps, setSteps] = useState<{ stepId: string; label: string }[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const resultRef = useRef<HTMLElement | null>(null);

  const reset = () => {
    setPredictionLevel(null);
    setAnswerText("");
    setRatingValue(5);
    setRatingBefore(null);
    setExplanationText("");
    setSteps([]);
    setSelectedStepIds([]);
    setChecked({});
    setResult(null);
    setError(null);
  };

  const loadItem = useCallback(async () => {
    setLoading(true);
    reset();

    const data = await call({ query: START_MONITORING_ITEM, variables: { mode, moduleKey, probeId } });
    if (!data) {
      setError(t("monitoring.errors.couldNotStart"));
      setLoading(false);
      return;
    }
    if (!data.startMonitoringItem) {
      setExhausted(true);
      setLoading(false);
      return;
    }
    const s: Served = data.startMonitoringItem;
    setServed(s);
    if (s.item.kind === "recall" || (s.item.kind === "pair" && s.item.pairHalf === "unassisted")) setStage("predict");
    else if (s.item.kind === "pair" && s.item.pairHalf === "assisted") setStage("rating");
    else if (s.item.kind === "explain") setStage("ratingBefore");
    else if (s.item.kind === "transcript") setStage("transcript");
    else if (s.item.kind === "longset") setStage("checkpoints");
    setLoading(false);
  }, [call, mode, moduleKey, probeId, t]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (stage !== "result") return;
    resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    resultRef.current?.focus?.({ preventScroll: true });
  }, [stage]);

  const finishWithResult = (r: SubmitResult) => {
    setResult(r);
    setStage("result");
  };

  // ── recall / pair-unassisted: predict -> answer -> (rating for pair) ──────

  const commitPrediction = async () => {
    if (!served || !predictionLevel) return;
    setBusy(true);
    const data = await call({ query: COMMIT_MONITORING_PREDICTION, variables: { attemptId: served.attemptId, level: predictionLevel } });
    setBusy(false);
    if (!data?.commitMonitoringPrediction) return setError(t("monitoring.errors.couldNotCommit"));
    setStage("answer");
  };

  const submitAnswer = async () => {
    if (!served || !answerText.trim()) return;
    setBusy(true);
    const data = await call({
      query: SUBMIT_MONITORING_ANSWER,
      variables: { attemptId: served.attemptId, text: answerText, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.submitMonitoringAnswer) return setError(t("monitoring.errors.couldNotCommit"));
    const outcome = data.submitMonitoringAnswer;
    if (outcome.stage === "needsRating") {
      setStage("rating");
    } else {
      finishWithResult(outcome.result);
    }
  };

  // ── pair rating (both halves), single "after" phase ───────────────────────

  const submitPairRating = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: COMMIT_MONITORING_RATING,
      variables: { attemptId: served.attemptId, phase: "after", value: ratingValue, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.commitMonitoringRating?.result) return setError(t("monitoring.errors.couldNotCommit"));
    finishWithResult(data.commitMonitoringRating.result);
  };

  // ── explain: rate before -> explain -> rate after -> select steps ────────

  const submitRatingBefore = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({ query: COMMIT_MONITORING_RATING, variables: { attemptId: served.attemptId, phase: "before", value: ratingValue } });
    setBusy(false);
    if (!data?.commitMonitoringRating) return setError(t("monitoring.errors.couldNotCommit"));
    setRatingBefore(ratingValue);
    setRatingValue(5);
    setStage("explain");
  };

  const submitExplanation = async () => {
    if (!served || !explanationText.trim()) return;
    setBusy(true);
    const data = await call({ query: COMMIT_MONITORING_EXPLANATION, variables: { attemptId: served.attemptId, text: explanationText } });
    setBusy(false);
    if (!data?.commitMonitoringExplanation) return setError(t("monitoring.errors.couldNotCommit"));
    // Steps are already in hand, but the ordering rule (D-45, spec §10) means
    // they aren't rendered until after the re-rating — held in state, not shown.
    setSteps(data.commitMonitoringExplanation.steps);
    setStage("ratingAfter");
  };

  const submitRatingAfter = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({ query: COMMIT_MONITORING_RATING, variables: { attemptId: served.attemptId, phase: "after", value: ratingValue } });
    setBusy(false);
    if (!data?.commitMonitoringRating) return setError(t("monitoring.errors.couldNotCommit"));
    setStage("selectSteps");
  };

  const toggleStep = (stepId: string) => {
    setSelectedStepIds((prev) => (prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]));
  };

  const submitSteps = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: SELECT_MONITORING_STEPS,
      variables: { attemptId: served.attemptId, stepIds: selectedStepIds, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.selectMonitoringSteps) return setError(t("monitoring.errors.couldNotCommit"));
    finishWithResult(data.selectMonitoringSteps);
  };

  // ── transcript ─────────────────────────────────────────────────────────

  const submitInfluence = async (marks: { turnId: string; movedWhat: string }[]) => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: MARK_MONITORING_INFLUENCE,
      variables: { attemptId: served.attemptId, marks, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.markMonitoringInfluence) return setError(t("monitoring.errors.couldNotCommit"));
    finishWithResult(data.markMonitoringInfluence);
  };

  // ── longset ────────────────────────────────────────────────────────────

  const toggleCheckpoint = async (checkpointId: string) => {
    if (!served) return;
    const next = !checked[checkpointId];
    setChecked((prev) => ({ ...prev, [checkpointId]: next }));
    await call({ query: MARK_MONITORING_CHECKPOINT, variables: { attemptId: served.attemptId, checkpointId, checked: next } });
  };

  const selectCountermeasure = async (optionId: string) => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: SELECT_MONITORING_COUNTERMEASURE,
      variables: { attemptId: served.attemptId, optionId, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.selectMonitoringCountermeasure) return setError(t("monitoring.errors.couldNotCommit"));
    finishWithResult(data.selectMonitoringCountermeasure);
  };

  const completeProbe = async (selfReport: number[]) => {
    if (!timepoint) return;
    setBusy(true);
    const data = await call({ query: COMPLETE_SKILL_PROBE, variables: { skillKey: "monitoring", timepoint, selfReport } });
    setBusy(false);
    if (!data?.completeSkillProbe) return setError(t("skills.probe.errors.couldNotComplete"));
    setProbeDone(true);
  };

  if (loading) return <LoadingBlock />;

  if (exhausted) {
    if (isProbe) {
      if (probeDone) {
        return (
          <InternalPageLayout title={t("monitoring.title")}>
            <div className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-6">
              <h2 className="text-lg font-semibold">{t("skills.probe.completeTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("skills.probe.completeBody")}</p>
              <Button onClick={() => navigate("/tools/skills/monitoring")}>{t("skills.probe.backToLab")}</Button>
            </div>
          </InternalPageLayout>
        );
      }
      return (
        <InternalPageLayout title={t("monitoring.title")}>
          {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
          <SkillSelfReportForm onSubmit={(values) => void completeProbe(values)} busy={busy} />
        </InternalPageLayout>
      );
    }
    return (
      <InternalPageLayout title={t("monitoring.title")}>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("monitoring.exhaustedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("monitoring.exhaustedBody")}</p>
          <Button onClick={() => navigate("/tools/skills/monitoring")}>{t("monitoring.backToLab")}</Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!served) {
    return (
      <InternalPageLayout title={t("monitoring.title")}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{error ?? t("monitoring.errors.couldNotStart")}</p>
        </div>
      </InternalPageLayout>
    );
  }

  const item = served.item;

  return (
    <InternalPageLayout title={t("monitoring.title")}>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="text-sm text-muted-foreground">{t(`monitoring.moduleName.${item.moduleKey}`, { defaultValue: item.moduleKey })}</div>

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

          {/* ── recall / pair-unassisted: predict ─────────────────────────── */}
          {stage === "predict" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.questionLabel")} />
              <p className="text-sm">{item.question}</p>
              <div className="border-t pt-3">
                <p className="mb-2 text-xs text-muted-foreground">{t("monitoring.predictLabel")}</p>
                <div className="flex flex-wrap gap-2">
                  {PREDICTION_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPredictionLevel(level)}
                      className={`rounded-md border px-3 py-1.5 text-xs ${predictionLevel === level ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
                    >
                      {t(`monitoring.predictionLevel.${level}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void commitPrediction()} disabled={busy || !predictionLevel}>
                  {t("monitoring.commitPrediction")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("monitoring.answerNotYetVisible")}</span>
              </div>
            </section>
          )}

          {/* ── recall / pair-unassisted: answer ──────────────────────────── */}
          {stage === "answer" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.questionLabel")} />
              <p className="text-sm">{item.question}</p>
              <div className="border-t pt-3">
                <input
                  type="text"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder={t("monitoring.answerPlaceholder")}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitAnswer()} disabled={busy || !answerText.trim()}>
                  {t("monitoring.commitAnswer")}
                </Button>
              </div>
            </section>
          )}

          {/* ── pair rating (both halves) ─────────────────────────────────── */}
          {stage === "rating" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              {item.pairHalf === "assisted" && item.authoredExplanation && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm leading-relaxed">{item.authoredExplanation}</div>
              )}
              <RatingSlider value={ratingValue} onChange={setRatingValue} label={t("monitoring.ratingLabel")} />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitPairRating()} disabled={busy}>
                  {t("monitoring.commitRating")}
                </Button>
              </div>
            </section>
          )}

          {/* ── explain: rate before ──────────────────────────────────────── */}
          {stage === "ratingBefore" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.explainPromptLabel")} />
              <p className="text-sm">{item.explainPrompt}</p>
              <RatingSlider value={ratingValue} onChange={setRatingValue} label={t("monitoring.ratingBeforeLabel")} />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitRatingBefore()} disabled={busy}>
                  {t("monitoring.commitRating")}
                </Button>
              </div>
            </section>
          )}

          {/* ── explain: free-text explanation ────────────────────────────── */}
          {stage === "explain" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.explainPromptLabel")} />
              <p className="text-sm">{item.explainPrompt}</p>
              <textarea
                value={explanationText}
                onChange={(e) => setExplanationText(e.target.value)}
                rows={5}
                placeholder={t("monitoring.explainPlaceholder")}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitExplanation()} disabled={busy || !explanationText.trim()}>
                  {t("monitoring.commitExplanation")}
                </Button>
              </div>
            </section>
          )}

          {/* ── explain: rate after — before the steps are ever shown ────────── */}
          {stage === "ratingAfter" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <RatingSlider value={ratingValue} onChange={setRatingValue} label={t("monitoring.ratingAfterLabel")} />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitRatingAfter()} disabled={busy}>
                  {t("monitoring.commitRating")}
                </Button>
              </div>
            </section>
          )}

          {/* ── explain: select which steps your explanation covered ─────────── */}
          {stage === "selectSteps" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.selectStepsLabel")} />
              <div className="flex flex-col gap-2">
                {steps.map((s) => (
                  <label key={s.stepId} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                    <input type="checkbox" checked={selectedStepIds.includes(s.stepId)} onChange={() => toggleStep(s.stepId)} />
                    {s.label}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitSteps()} disabled={busy}>
                  {t("monitoring.commitSteps")}
                </Button>
              </div>
            </section>
          )}

          {/* ── transcript ─────────────────────────────────────────────────── */}
          {stage === "transcript" && item.turns && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.transcriptLabel")} />
              <TranscriptAudit turns={item.turns} onSubmit={(marks) => void submitInfluence(marks)} busy={busy} />
            </section>
          )}

          {/* ── longset: checkpoints ───────────────────────────────────────── */}
          {stage === "checkpoints" && item.checkpoints && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.checkpointsLabel")} />
              <div className="flex flex-col gap-1.5">
                {item.checkpoints.map((c) => (
                  <label key={c.checkpointId} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <input type="checkbox" checked={!!checked[c.checkpointId]} onChange={() => void toggleCheckpoint(c.checkpointId)} />
                    {c.text}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => setStage("countermeasure")}>{t("monitoring.doneReviewing")}</Button>
              </div>
            </section>
          )}

          {/* ── longset: countermeasure — unlabelled, fixed order (never sorted) ── */}
          {stage === "countermeasure" && item.countermeasureOptions && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("monitoring.countermeasureLabel")} />
              <div className="flex flex-col gap-2">
                {item.countermeasureOptions.map((o) => (
                  <button
                    key={o.optionId}
                    type="button"
                    disabled={busy}
                    onClick={() => void selectCountermeasure(o.optionId)}
                    className="rounded-md border px-3 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── result ───────────────────────────────────────────────────────── */}
          {stage === "result" && result && (
            <div ref={resultRef as any} tabIndex={-1}>
              <ResultPanel result={result} onNext={() => void loadItem()} onBack={() => navigate("/tools/skills/monitoring")} busy={busy} />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 text-sm font-semibold">{t("monitoring.rubricTitle")}</p>
            <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("monitoring.rubricHint")}</p>
            <MonitoringRubricRail scores={result?.score.criteria} />
          </div>
        </aside>
      </div>
    </InternalPageLayout>
  );
}

function Label({ text }: { text: string }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{text}</p>;
}

function RatingSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </p>
      <input type="range" min={0} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

type ResultProps = { result: SubmitResult; onNext: () => void; onBack: () => void; busy: boolean };

function ResultPanel({ result, onNext, onBack, busy }: ResultProps) {
  const { t } = useTranslation();
  const { score } = result;
  const scoredCriterion = score.criteria.find((c) => c.scoredBy !== "unscored");

  return (
    <section className="overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04]">
      <header className="border-b border-inherit px-5 py-3">
        <Label text={t("monitoring.resultLabel")} />
        <p className="text-base font-semibold">
          {scoredCriterion
            ? scoredCriterion.level !== null
              ? `${scoredCriterion.id}: ${scoredCriterion.level} / 2`
              : `${scoredCriterion.id}: ${t("monitoring.unscored")}`
            : t("monitoring.unscored")}
        </p>
      </header>

      <div className="space-y-5 p-5">
        {score.deflation && <DeflationDisplay before={score.deflation.before} after={score.deflation.after} />}

        {score.influenceResult && (
          <div className="rounded-md border bg-background/60 p-3 text-sm">
            {t("monitoring.influenceSummary", {
              hits: score.influenceResult.hits,
              total: score.influenceResult.plantedTotal,
              falseAlarms: score.influenceResult.falseAlarms,
            })}
          </div>
        )}

        {scoredCriterion && (
          <div className="rounded-md border bg-background/60 p-3">
            <Label text={t("monitoring.evidenceLabel")} />
            <p className="text-sm leading-relaxed">{scoredCriterion.evidence}</p>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label text={t("monitoring.perCriterion")} />
          <MonitoringRubricRail scores={score.criteria} compact />
        </div>

        {result.masteryUnmet.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <Label text={t("monitoring.masteryRemaining")} />
            <MasteryGapList gaps={result.masteryUnmet} ns="monitoring" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={onNext} disabled={busy}>
            {t("monitoring.nextItem")}
          </Button>
          <Button variant="outline" onClick={onBack}>
            {t("monitoring.backToLab")}
          </Button>
        </div>
      </div>
    </section>
  );
}
