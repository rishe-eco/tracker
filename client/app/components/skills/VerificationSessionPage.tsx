import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FileText, Lock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import {
  COMMIT_VERIFICATION_VERDICT,
  COMPLETE_SKILL_PROBE,
  LOAD_VERIFICATION_ELEMENTS,
  NAME_VERIFICATION_ORACLE,
  REVEAL_VERIFICATION_CHECK,
  SET_VERIFICATION_LOCALIZATION,
  START_VERIFICATION_ITEM,
} from "~/api/queries";
import MasteryGapList, { type MasteryGap } from "./MasteryGapList";
import VerificationRubricRail, { type VerificationCriterionScore } from "./VerificationRubricRail";
import OracleBench, { type BenchEntry, type RevealedOutcome } from "./OracleBench";
import VerificationReveal, { type Reveal } from "./VerificationReveal";
import SkillSelfReportForm from "./SkillSelfReportForm";

const VERDICTS = ["supported", "unsupported", "outdated", "cannot_verify"] as const;

type VerificationItem = {
  itemId: string;
  moduleKey: string;
  difficulty: number;
  ask: string;
  answer: string;
  bench: BenchEntry[];
};

type Served = {
  attemptId: string;
  rung: "assisted" | "unassisted";
  assistedCeilingSeconds: number | null;
  item: VerificationItem;
};

type LocalisationElement = { elementId: string; label: string };

type SubmitResult = {
  attemptId: string;
  score: {
    criteria: VerificationCriterionScore[];
    total: number;
    scoredCount: number;
    strict: boolean;
    ritualState: "none-run" | "none-could-fail" | "some-could-fail" | "all-could-fail";
    costSpent: number;
    costRatio: number | null;
    rung: "assisted" | "unassisted";
    isVoid: boolean;
    isComplete: boolean;
  };
  moduleState: string;
  masteryUnmet: MasteryGap[];
  promotionOffered: boolean;
  reveal: Reveal;
};

/**
 * Stage order is the measurement, not a UI convenience: the oracle has to be
 * named before the bench opens (V1), the element list is never on screen
 * while checks are being chosen (contaminates V1/V3), and on the unassisted
 * rung the list only exists after the free-text commit (04-verification-lab.md
 * §4a, §10).
 */
type Stage = "oracle" | "bench" | "commit" | "localise" | "result";

export default function VerificationSessionPage() {
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
  const [stage, setStage] = useState<Stage>("oracle");
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeDone, setProbeDone] = useState(false);

  const [oracleText, setOracleText] = useState("");
  const [predictedCostSeconds, setPredictedCostSeconds] = useState("");
  const [revealed, setRevealed] = useState<RevealedOutcome[]>([]);
  const [verdict, setVerdict] = useState<(typeof VERDICTS)[number] | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [residualRisk, setResidualRisk] = useState("");
  const [elementFreeText, setElementFreeText] = useState("");
  const [elements, setElements] = useState<LocalisationElement[] | null>(null);
  const [elementId, setElementId] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const resultRef = useRef<HTMLElement | null>(null);

  const reset = () => {
    setOracleText("");
    setPredictedCostSeconds("");
    setRevealed([]);
    setVerdict(null);
    setConfidence(50);
    setResidualRisk("");
    setElementFreeText("");
    setElements(null);
    setElementId(null);
    setResult(null);
    setError(null);
  };

  const loadItem = useCallback(async () => {
    setLoading(true);
    reset();

    const data = await call({ query: START_VERIFICATION_ITEM, variables: { mode, moduleKey, probeId } });
    if (!data) {
      setError(t("verification.errors.couldNotStart"));
      setLoading(false);
      return;
    }
    if (!data.startVerificationItem) {
      setExhausted(true);
      setLoading(false);
      return;
    }
    setServed(data.startVerificationItem);
    setStage("oracle");
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

  const nameOracle = async () => {
    if (!served || !oracleText.trim()) return;
    setBusy(true);
    const data = await call({
      query: NAME_VERIFICATION_ORACLE,
      variables: {
        attemptId: served.attemptId,
        text: oracleText,
        predictedCostSeconds: predictedCostSeconds ? Number(predictedCostSeconds) : null,
      },
    });
    setBusy(false);
    if (!data) return setError(t("verification.errors.couldNotLock"));
    setStage("bench");
  };

  const revealCheck = async (checkId: string) => {
    if (!served) return;
    setBusy(true);
    const data = await call({ query: REVEAL_VERIFICATION_CHECK, variables: { attemptId: served.attemptId, checkId } });
    setBusy(false);
    if (!data?.revealVerificationCheck) return setError(t("verification.errors.couldNotReveal"));
    setRevealed((prev) => [...prev, data.revealVerificationCheck]);
  };

  const goToCommit = async () => {
    if (!served) return;
    if (served.rung === "assisted") {
      setBusy(true);
      const data = await call({ query: LOAD_VERIFICATION_ELEMENTS, variables: { attemptId: served.attemptId } });
      setBusy(false);
      if (!data?.loadVerificationElements) return setError(t("verification.errors.couldNotStart"));
      setElements(data.loadVerificationElements);
    }
    setStage("commit");
  };

  const submitCommit = async () => {
    if (!served || !verdict || !residualRisk.trim()) return;
    if (served.rung === "assisted" && !elementId) return;
    if (served.rung === "unassisted" && !elementFreeText.trim()) return;

    setBusy(true);
    const data = await call({
      query: COMMIT_VERIFICATION_VERDICT,
      variables: {
        attemptId: served.attemptId,
        verdict,
        confidence,
        residualRisk,
        elementId: served.rung === "assisted" ? elementId : null,
        elementFreeText: served.rung === "unassisted" ? elementFreeText : null,
        timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      },
    });
    setBusy(false);
    if (!data?.commitVerificationVerdict) return setError(t("verification.errors.couldNotSubmit"));

    const commit = data.commitVerificationVerdict;
    if (commit.stage === "scored") {
      setResult(commit.result);
      setStage("result");
    } else {
      setElements(commit.elements);
      setStage("localise");
    }
  };

  const pickLocalisation = async (id: string) => {
    if (!served) return;
    setElementId(id);
    setBusy(true);
    const data = await call({
      query: SET_VERIFICATION_LOCALIZATION,
      variables: { attemptId: served.attemptId, elementId: id, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.setVerificationLocalization) return setError(t("verification.errors.couldNotSubmit"));
    setResult(data.setVerificationLocalization);
    setStage("result");
  };

  const completeProbe = async (selfReport: number[]) => {
    if (!timepoint) return;
    setBusy(true);
    const data = await call({ query: COMPLETE_SKILL_PROBE, variables: { skillKey: "verification", timepoint, selfReport } });
    setBusy(false);
    if (!data?.completeSkillProbe) return setError(t("skills.probe.errors.couldNotComplete"));
    setProbeDone(true);
  };

  if (loading) return <LoadingBlock />;

  if (exhausted) {
    if (isProbe) {
      if (probeDone) {
        return (
          <InternalPageLayout title={t("verification.title")}>
            <div className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-6">
              <h2 className="text-lg font-semibold">{t("skills.probe.completeTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("skills.probe.completeBody")}</p>
              <Button onClick={() => navigate("/tools/skills/verification")}>{t("skills.probe.backToLab")}</Button>
            </div>
          </InternalPageLayout>
        );
      }
      return (
        <InternalPageLayout title={t("verification.title")}>
          {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
          <SkillSelfReportForm onSubmit={(values) => void completeProbe(values)} busy={busy} />
        </InternalPageLayout>
      );
    }
    return (
      <InternalPageLayout title={t("verification.title")}>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("verification.exhaustedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("verification.exhaustedBody")}</p>
          <Button onClick={() => navigate("/tools/skills/verification")}>{t("verification.backToLab")}</Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!served) {
    return (
      <InternalPageLayout title={t("verification.title")}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{error ?? t("verification.errors.couldNotStart")}</p>
        </div>
      </InternalPageLayout>
    );
  }

  const item = served.item;
  const canCommit = Boolean(verdict) && Boolean(residualRisk.trim()) && (served.rung === "unassisted" ? Boolean(elementFreeText.trim()) : Boolean(elementId));

  return (
    <InternalPageLayout title={t("verification.title")}>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t(`verification.moduleName.${item.moduleKey}`, { defaultValue: item.moduleKey })}</span>
            <span
              className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${
                served.rung === "unassisted" ? "border-primary/50 text-primary" : ""
              }`}
            >
              {t(`verification.rung.${served.rung}`)}
            </span>
          </div>

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

          <section className="space-y-2 overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 p-3">
              <Label icon={FileText} text={t("verification.askLabel")} />
              <p className="text-sm">{item.ask}</p>
            </div>
            <div className="p-3">
              <Label text={t("verification.answerLabel")} />
              <p className="text-sm font-medium leading-relaxed">{item.answer}</p>
            </div>
          </section>

          {/* ── Name the oracle before the bench opens ───────────────────────── */}
          {stage === "oracle" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label icon={Lock} text={t("verification.oracleTitle")} />
              <p className="text-sm">{t("verification.oracleBody")}</p>
              <Input
                value={oracleText}
                onChange={(e) => setOracleText(e.target.value)}
                placeholder={t("verification.oraclePlaceholder")}
                autoComplete="off"
              />
              {served.rung === "unassisted" && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("verification.predictedCostLabel")}</p>
                  <Input
                    type="number"
                    value={predictedCostSeconds}
                    onChange={(e) => setPredictedCostSeconds(e.target.value)}
                    placeholder={t("verification.predictedCostPlaceholder")}
                    className="max-w-[10rem]"
                  />
                </div>
              )}
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void nameOracle()} disabled={busy || !oracleText.trim()}>
                  {t("verification.lockOracle")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("verification.oracleNotEditable")}</span>
              </div>
            </section>
          )}

          {/* ── The oracle bench ──────────────────────────────────────────────── */}
          {stage === "bench" && (
            <section className="space-y-3 rounded-lg border bg-card p-5">
              <Label text={t("verification.benchTitle")} />
              <OracleBench
                bench={item.bench}
                revealed={revealed}
                rung={served.rung}
                ceilingSeconds={served.assistedCeilingSeconds}
                disabled={busy}
                onReveal={(checkId) => void revealCheck(checkId)}
              />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void goToCommit()} disabled={busy}>
                  {t("verification.commitVerdictButton")}
                </Button>
              </div>
            </section>
          )}

          {/* ── Commit verdict, confidence, residual risk (+ element on assisted) ── */}
          {stage === "commit" && (
            <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label icon={Lock} text={t("verification.commitTitle")} />

              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">{t("verification.verdictLabel")}</p>
                <div className="flex flex-wrap gap-2">
                  {VERDICTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVerdict(v)}
                      className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                        verdict === v ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {t(`verification.verdict.${v}`)}
                    </button>
                  ))}
                </div>
              </div>

              {served.rung === "assisted" && elements && (
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">{t("verification.elementLabel")}</p>
                  <div className="flex flex-wrap gap-2">
                    {elements.map((el) => (
                      <button
                        key={el.elementId}
                        type="button"
                        onClick={() => setElementId(el.elementId)}
                        className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                          elementId === el.elementId ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {el.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {served.rung === "unassisted" && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t("verification.elementFreeTextLabel")}</p>
                  <Input
                    value={elementFreeText}
                    onChange={(e) => setElementFreeText(e.target.value)}
                    placeholder={t("verification.elementFreeTextPlaceholder")}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("verification.elementFreeTextHint")}</p>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t("verification.residualRiskLabel")}</p>
                <Input
                  value={residualRisk}
                  onChange={(e) => setResidualRisk(e.target.value)}
                  placeholder={t("verification.residualRiskPlaceholder")}
                  autoComplete="off"
                />
              </div>

              <div>
                <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("verification.confidenceLabel")}</span>
                  <span className="font-mono">{confidence}</span>
                </p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void submitCommit()} disabled={busy || !canCommit}>
                  {t("verification.commit")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("verification.commitLocks")}</span>
              </div>
            </section>
          )}

          {/* ── Unassisted: the list appears only after the free-text commit ─── */}
          {stage === "localise" && elements && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label icon={Lock} text={t("verification.localiseTitle")} />
              <p className="text-sm">{t("verification.localiseBody")}</p>
              <div className="flex flex-wrap gap-2">
                {elements.map((el) => (
                  <button
                    key={el.elementId}
                    type="button"
                    disabled={busy}
                    onClick={() => void pickLocalisation(el.elementId)}
                    className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {el.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Result: ritual-first reveal, then the rest ─────────────────────── */}
          {stage === "result" && result && (
            <div ref={resultRef as any} tabIndex={-1}>
              <ResultPanel
                result={result}
                bench={item.bench}
                revealed={revealed}
                predictedCostSeconds={predictedCostSeconds ? Number(predictedCostSeconds) : null}
                onNext={() => void loadItem()}
                onBack={() => navigate("/tools/skills/verification")}
                busy={busy}
              />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 text-sm font-semibold">{t("verification.rubricTitle")}</p>
            <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("verification.rubricHint")}</p>
            <VerificationRubricRail scores={result?.score.criteria} />
          </div>
        </aside>
      </div>
    </InternalPageLayout>
  );
}

function Label({ icon: Icon, text }: { icon?: any; text: string }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {text}
    </p>
  );
}

type ResultProps = {
  result: SubmitResult;
  bench: BenchEntry[];
  revealed: RevealedOutcome[];
  predictedCostSeconds: number | null;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
};

function ResultPanel({ result, bench, revealed, predictedCostSeconds, onNext, onBack, busy }: ResultProps) {
  const { t } = useTranslation();
  const { score } = result;
  const maxPossible = score.scoredCount * 2;
  const v3 = score.criteria.find((c) => c.id === "V3");
  const v6 = score.criteria.find((c) => c.id === "V6");
  const verdictCorrect = v6 ? v6.level !== null && v6.level > 0 : false;

  return (
    <section className="overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04]">
      <header className="border-b border-inherit px-5 py-3">
        <Label text={t("verification.resultLabel")} />
        <p className="text-base font-semibold">{score.strict ? t("verification.strictYes") : t("verification.strictNo")}</p>
      </header>

      <div className="space-y-5 p-5">
        {score.isVoid && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{t("verification.voidNote")}</p>}

        <VerificationReveal
          ritualLine={v3?.evidence ?? ""}
          ritualState={score.ritualState}
          verdictCorrect={verdictCorrect}
          bench={bench}
          revealed={revealed}
          reveal={result.reveal}
          costSpent={score.costSpent}
          costRatio={score.costRatio}
          predictedCostSeconds={score.rung === "unassisted" ? predictedCostSeconds : null}
        />

        <div className="space-y-2 border-t pt-4">
          <Label text={t("verification.perCriterion")} />
          {score.criteria.map((c) => (
            <CriterionRow key={c.id} score={c} />
          ))}
        </div>

        <div className="rounded-md border bg-background/60 p-3">
          <Label text={t("verification.total")} />
          <p className="text-2xl font-semibold tabular-nums">{score.scoredCount === 0 ? "—" : `${score.total} / ${maxPossible}`}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("verification.ofCriteria", { scored: score.scoredCount, total: 6 })}
          </p>
        </div>

        {result.promotionOffered && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">{t("verification.promotion.offerInline")}</div>
        )}

        {result.masteryUnmet.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <Label text={t("verification.masteryRemaining")} />
            <MasteryGapList gaps={result.masteryUnmet} ns="verification" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={onNext} disabled={busy}>
            {t("verification.nextItem")}
          </Button>
          <Button variant="outline" onClick={onBack}>
            {t("verification.backToLab")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CriterionRow({ score }: { score: VerificationCriterionScore }) {
  const { t } = useTranslation();
  const unscored = score.level === null;
  return (
    <div className={`rounded-md border p-3 ${unscored ? "border-dashed bg-muted/30" : "bg-background/60"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          <span className="font-mono text-xs text-muted-foreground">{score.id}</span> {t(`verification.rubric.${score.id}.label`)}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{unscored ? t("verification.unscored") : `${score.level} / 2`}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{unscored ? t("verification.unscoredHint") : score.evidence}</p>
    </div>
  );
}
