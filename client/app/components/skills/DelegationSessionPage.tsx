import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { resolveSessionMode } from "./sessionMode";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import {
  COMMIT_DELEGATION_ESTIMATE,
  COMMIT_DELEGATION_REVISION,
  COMMIT_DELEGATION_SPLIT,
  COMMIT_SEQUENCE_ROUND,
  COMPLETE_SKILL_PROBE,
  SELECT_DELEGATION_CUE,
  START_DELEGATION_ITEM,
} from "~/api/queries";
import MasteryGapList from "./MasteryGapList";
import DelegationRubricRail, { type DelegationCriterionScore } from "./DelegationRubricRail";
import ThreePositionReveal from "./ThreePositionReveal";
import AdvisorSequence, { type SequenceRoundView } from "./AdvisorSequence";
import SkillSelfReportForm from "./SkillSelfReportForm";

type ItemKind = "estimate" | "cue" | "split" | "stakes" | "sequence";

type DelegationItem = {
  itemId: string;
  moduleKey: string;
  difficulty: number;
  kind: ItemKind;
  ask: string;
  unitLabel: string | null;
  plausibleRange: [number, number] | null;
  cueOptions: { cueId: string; label: string }[] | null;
  splitPieces: { pieceId: string; label: string }[] | null;
  stakesPairId: string | null;
  roundIndex: number | null;
  totalRounds: number | null;
};

type Served = { attemptId: string; item: DelegationItem };

type SubmitResult = {
  attemptId: string;
  score: {
    criteria: DelegationCriterionScore[];
    total: number;
    scoredCount: number;
    woaRaw: number | null;
    woaClamped: number | null;
    benchmark: number | null;
    direction: "over" | "under" | "costly" | "ok";
    netGain: number | null;
    adviceQuality: string | null;
    isVoid: boolean;
    pendingPair: boolean;
    truth: number | null;
  };
  moduleState: string;
  masteryUnmet: { code: string; count?: number; required?: number; minTotal?: number }[];
};

/** initial/final/advice are already known to the learner by the reveal — this is a display recomputation, not new information. */
function woaFor(initial: number, advice: number, final: number): number | null {
  if (advice === initial) return null;
  return Math.max(0, Math.min(1, (final - initial) / (advice - initial)));
}

type Stage = "estimate" | "revision" | "cue" | "split" | "sequence" | "result";

const G6_ROUNDS = 3;


/**
 * Persian and Arabic-Indic numerals, and the Persian decimal separator.
 *
 * The field used to be `<input type="number">`, which silently discards
 * anything a Persian keyboard produces: typing `۱۱۰۰` left the value empty
 * with no error and no way to tell why (persona review pass 3, S-7). It is a
 * text field now, and this is the only place a typed estimate becomes a
 * number — the same fold the Monitoring answer matcher does, for the same
 * reason.
 */
function toNumber(raw: string): number {
  const ascii = raw
    .replace(/[۰-۹٠-٩]/g, (d) => String(d.codePointAt(0)! & 0x0f))
    .replace(/[٫،]/g, ".")
    .replace(/[٬\s,]/g, "")
    .trim();
  return Number(ascii);
}

export default function DelegationSessionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { call } = useApi();

  const moduleKey = params.get("module") ?? undefined;
  const probeId = params.get("probeId") ?? undefined;
  const timepoint = params.get("timepoint") ?? undefined;
  const isProbe = params.get("mode") === "assessment" && Boolean(probeId) && Boolean(timepoint);
  const mode = resolveSessionMode({ isProbe, requested: params.get("mode"), moduleKey });

  const [served, setServed] = useState<Served | null>(null);
  const [stage, setStage] = useState<Stage>("estimate");
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeDone, setProbeDone] = useState(false);

  const [initialValue, setInitialValue] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [advice, setAdvice] = useState<number | null>(null);
  const [unitLabel, setUnitLabel] = useState<string | null>(null);
  const [revisionValue, setRevisionValue] = useState("");
  const [recoverabilityMove, setRecoverabilityMove] = useState(false);
  const [cueOptions, setCueOptions] = useState<{ cueId: string; label: string }[]>([]);
  const [splitDispositions, setSplitDispositions] = useState<Record<string, "give" | "keep">>({});
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [roundIndex, setRoundIndex] = useState(0);
  const [roundPhase, setRoundPhase] = useState<"estimate" | "revision">("estimate");
  const [roundHistory, setRoundHistory] = useState<{ roundIndex: number; initial: number; advice: number; final: number; isSeededError: boolean }[]>([]);

  const resultRef = useRef<HTMLElement | null>(null);

  const reset = () => {
    setInitialValue("");
    setConfidence(50);
    setAdvice(null);
    setUnitLabel(null);
    setRevisionValue("");
    setRecoverabilityMove(false);
    setCueOptions([]);
    setSplitDispositions({});
    setResult(null);
    setError(null);
    setRoundIndex(0);
    setRoundPhase("estimate");
    setRoundHistory([]);
  };

  const loadItem = useCallback(async () => {
    setLoading(true);
    reset();

    const data = await call({ query: START_DELEGATION_ITEM, variables: { mode, moduleKey, probeId } });
    if (!data) {
      setError(t("delegation.errors.couldNotStart"));
      setLoading(false);
      return;
    }
    if (!data.startDelegationItem) {
      setExhausted(true);
      setLoading(false);
      return;
    }
    const s: Served = data.startDelegationItem;
    setServed(s);
    setUnitLabel(s.item.unitLabel);
    setStage(s.item.kind === "split" ? "split" : s.item.kind === "sequence" ? "sequence" : "estimate");
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

  // ── estimate / cue / stakes ────────────────────────────────────────────

  const commitEstimate = async () => {
    if (!served || !initialValue.trim()) return;
    setBusy(true);
    const data = await call({
      query: COMMIT_DELEGATION_ESTIMATE,
      variables: { attemptId: served.attemptId, value: toNumber(initialValue), confidence },
    });
    setBusy(false);
    if (!data?.commitDelegationEstimate) return setError(t("delegation.errors.couldNotCommit"));
    setAdvice(data.commitDelegationEstimate.advice);
    setUnitLabel(data.commitDelegationEstimate.unitLabel ?? unitLabel);
    setStage("revision");
  };

  const commitRevision = async () => {
    if (!served || !revisionValue.trim()) return;
    setBusy(true);
    const data = await call({
      query: COMMIT_DELEGATION_REVISION,
      variables: {
        attemptId: served.attemptId,
        value: toNumber(revisionValue),
        recoverabilityMove: served.item.kind === "stakes" ? recoverabilityMove : null,
        timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      },
    });
    setBusy(false);
    if (!data?.commitDelegationRevision) return setError(t("delegation.errors.couldNotCommit"));

    const outcome = data.commitDelegationRevision;
    if (outcome.stage === "scored") {
      setResult(outcome.result);
      setStage("result");
    } else {
      setCueOptions(outcome.cueOptions ?? []);
      setStage("cue");
    }
  };

  const selectCue = async (cueId: string) => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: SELECT_DELEGATION_CUE,
      variables: { attemptId: served.attemptId, cueId, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.selectDelegationCue) return setError(t("delegation.errors.couldNotCommit"));
    setResult(data.selectDelegationCue);
    setStage("result");
  };

  // ── split ──────────────────────────────────────────────────────────────

  const setPiece = (pieceId: string, disposition: "give" | "keep") => {
    setSplitDispositions((prev) => ({ ...prev, [pieceId]: disposition }));
  };

  const commitSplit = async () => {
    if (!served?.item.splitPieces) return;
    const dispositions = served.item.splitPieces.map((p) => ({ pieceId: p.pieceId, disposition: splitDispositions[p.pieceId] ?? "keep" }));
    setBusy(true);
    const data = await call({
      query: COMMIT_DELEGATION_SPLIT,
      variables: { attemptId: served.attemptId, dispositions, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.commitDelegationSplit) return setError(t("delegation.errors.couldNotCommit"));
    setResult(data.commitDelegationSplit);
    setStage("result");
  };

  // ── sequence ───────────────────────────────────────────────────────────

  const commitRoundEstimate = async () => {
    if (!served || !initialValue.trim()) return;
    setBusy(true);
    const data = await call({
      query: COMMIT_SEQUENCE_ROUND,
      variables: { attemptId: served.attemptId, roundIndex, value: toNumber(initialValue), phase: "estimate" },
    });
    setBusy(false);
    if (!data?.commitSequenceRound) return setError(t("delegation.errors.couldNotCommit"));
    setAdvice(data.commitSequenceRound.advice);
    setRoundPhase("revision");
  };

  const commitRoundRevision = async () => {
    if (!served || !revisionValue.trim() || advice === null) return;
    setBusy(true);
    const data = await call({
      query: COMMIT_SEQUENCE_ROUND,
      variables: {
        attemptId: served.attemptId,
        roundIndex,
        value: toNumber(revisionValue),
        phase: "revision",
        timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      },
    });
    setBusy(false);
    if (!data?.commitSequenceRound) return setError(t("delegation.errors.couldNotCommit"));

    setRoundHistory((prev) => [
      ...prev,
      { roundIndex, initial: toNumber(initialValue), advice, final: toNumber(revisionValue), isSeededError: roundIndex === 1 },
    ]);

    const outcome = data.commitSequenceRound;
    if (outcome.stage === "scored") {
      setResult(outcome.result);
      setStage("result");
      return;
    }
    setInitialValue("");
    setRevisionValue("");
    setAdvice(null);
    setRoundIndex((i) => i + 1);
    setRoundPhase("estimate");
  };

  const completeProbe = async (selfReport: number[]) => {
    if (!timepoint) return;
    setBusy(true);
    const data = await call({ query: COMPLETE_SKILL_PROBE, variables: { skillKey: "delegation", timepoint, selfReport } });
    setBusy(false);
    if (!data?.completeSkillProbe) return setError(t("skills.probe.errors.couldNotComplete"));
    setProbeDone(true);
  };

  if (loading) return <LoadingBlock />;

  if (exhausted) {
    if (isProbe) {
      if (probeDone) {
        return (
          <InternalPageLayout title={t("delegation.title")}>
            <div className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-6">
              <h2 className="text-lg font-semibold">{t("skills.probe.completeTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("skills.probe.completeBody")}</p>
              <Button onClick={() => navigate("/tools/skills/delegation")}>{t("skills.probe.backToLab")}</Button>
            </div>
          </InternalPageLayout>
        );
      }
      return (
        <InternalPageLayout title={t("delegation.title")}>
          {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
          <SkillSelfReportForm onSubmit={(values) => void completeProbe(values)} busy={busy} />
        </InternalPageLayout>
      );
    }
    return (
      <InternalPageLayout title={t("delegation.title")}>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("delegation.exhaustedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("delegation.exhaustedBody")}</p>
          <Button onClick={() => navigate("/tools/skills/delegation")}>{t("delegation.backToLab")}</Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!served) {
    return (
      <InternalPageLayout title={t("delegation.title")}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{error ?? t("delegation.errors.couldNotStart")}</p>
        </div>
      </InternalPageLayout>
    );
  }

  const item = served.item;

  return (
    <InternalPageLayout title={t("delegation.title")}>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="text-sm text-muted-foreground">{t(`delegation.moduleName.${item.moduleKey}`, { defaultValue: item.moduleKey })}</div>

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

          <section className="space-y-2 overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/40 p-3">
              <Label icon={FileText} text={t("delegation.askLabel")} />
              <p className="text-sm">{item.ask}</p>
            </div>
          </section>

          {/* ── estimate + confidence, committed together, before advice exists ── */}
          {stage === "estimate" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("delegation.estimateTitle")} />
              <Input
                type="text"
                inputMode="decimal"
                value={initialValue}
                onChange={(e) => setInitialValue(e.target.value)}
                placeholder={unitLabel ? `— ${unitLabel}` : "—"}
                autoComplete="off"
              />
              <div>
                <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("delegation.confidenceLabel")}</span>
                  <span className="font-mono">{confidence}</span>
                </p>
                <input type="range" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className="w-full" />
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void commitEstimate()} disabled={busy || !initialValue.trim()}>
                  {t("delegation.commitEstimate")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("delegation.adviceNotYetVisible")}</span>
              </div>
            </section>
          )}

          {/* ── advice revealed; the initial value stays visible while revising ── */}
          {stage === "revision" && advice !== null && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("delegation.revisionTitle")} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">{t("delegation.youSaid")}</p>
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {initialValue} {unitLabel}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-muted-foreground">{t("delegation.assistantSays")}</p>
                  <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                    {advice} {unitLabel}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("delegation.revisionHint")}</p>
              <Input type="text" inputMode="decimal" value={revisionValue} onChange={(e) => setRevisionValue(e.target.value)} placeholder={unitLabel ? `— ${unitLabel}` : "—"} autoComplete="off" />

              {item.kind === "stakes" && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={recoverabilityMove} onChange={(e) => setRecoverabilityMove(e.target.checked)} />
                  {t("delegation.recoverabilityMoveLabel")}
                </label>
              )}

              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void commitRevision()} disabled={busy || !revisionValue.trim()}>
                  {t("delegation.commitRevision")}
                </Button>
              </div>
            </section>
          )}

          {/* ── which cue did you use? ─────────────────────────────────────────── */}
          {stage === "cue" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("delegation.cueTitle")} />
              <div className="flex flex-col gap-2">
                {cueOptions.map((c) => (
                  <button
                    key={c.cueId}
                    type="button"
                    disabled={busy}
                    onClick={() => void selectCue(c.cueId)}
                    className="rounded-md border px-3 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── split: which piece to hand over, which to keep ─────────────────── */}
          {stage === "split" && item.splitPieces && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("delegation.splitTitle")} />
              <div className="flex flex-col gap-2">
                {item.splitPieces.map((p) => {
                  const chosen = splitDispositions[p.pieceId];
                  return (
                    <div key={p.pieceId} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                      <span className="text-sm">{p.label}</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPiece(p.pieceId, "give")}
                          className={`rounded-md border px-2 py-1 text-xs ${chosen === "give" ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
                        >
                          {t("delegation.give")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPiece(p.pieceId, "keep")}
                          className={`rounded-md border px-2 py-1 text-xs ${chosen === "keep" ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
                        >
                          {t("delegation.keep")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void commitSplit()} disabled={busy || Object.keys(splitDispositions).length < item.splitPieces.length}>
                  {t("delegation.commitSplit")}
                </Button>
              </div>
            </section>
          )}

          {/* ── sequence: 3 rounds, one visibly wrong ───────────────────────────── */}
          {stage === "sequence" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label text={t("delegation.sequence.round", { n: roundIndex + 1 })} />
              {roundPhase === "estimate" ? (
                <>
                  <Input type="text" inputMode="decimal" value={initialValue} onChange={(e) => setInitialValue(e.target.value)} placeholder={unitLabel ? `— ${unitLabel}` : "—"} autoComplete="off" />
                  <div className="flex items-center gap-3 border-t pt-3">
                    <Button onClick={() => void commitRoundEstimate()} disabled={busy || !initialValue.trim()}>
                      {t("delegation.commitEstimate")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-[11px] text-muted-foreground">{t("delegation.youSaid")}</p>
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        {initialValue} {unitLabel}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-muted-foreground">{t("delegation.assistantSays")}</p>
                      <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                        {advice} {unitLabel}
                      </div>
                    </div>
                  </div>
                  <Input type="text" inputMode="decimal" value={revisionValue} onChange={(e) => setRevisionValue(e.target.value)} placeholder={unitLabel ? `— ${unitLabel}` : "—"} autoComplete="off" />
                  <div className="flex items-center gap-3 border-t pt-3">
                    <Button onClick={() => void commitRoundRevision()} disabled={busy || !revisionValue.trim()}>
                      {roundIndex === G6_ROUNDS - 1 ? t("delegation.commitRevision") : t("delegation.nextRound")}
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── result ───────────────────────────────────────────────────────── */}
          {stage === "result" && result && (
            <div ref={resultRef as any} tabIndex={-1}>
              <ResultPanel
                result={result}
                item={item}
                initial={initialValue ? toNumber(initialValue) : null}
                final={revisionValue ? toNumber(revisionValue) : null}
                advice={advice}
                unitLabel={unitLabel}
                roundHistory={roundHistory}
                onNext={() => void loadItem()}
                onBack={() => navigate("/tools/skills/delegation")}
                busy={busy}
              />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 text-sm font-semibold">{t("delegation.rubricTitle")}</p>
            <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("delegation.rubricHint")}</p>
            <DelegationRubricRail scores={result?.score.criteria} />
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
  item: DelegationItem;
  initial: number | null;
  final: number | null;
  advice: number | null;
  unitLabel: string | null;
  roundHistory: { roundIndex: number; initial: number; advice: number; final: number; isSeededError: boolean }[];
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
};

function ResultPanel({ result, item, initial, final, advice, unitLabel, roundHistory, onNext, onBack, busy }: ResultProps) {
  const { t } = useTranslation();
  const { score } = result;
  // The item's own criterion — the one this attempt actually evaluated, even
  // when it came back with no level (a legitimate WOA tie, for instance).
  // "level !== null" alone would miss that case and wrongly fall through to
  // the pending-pair copy, which means something different (spec §4.4).
  const scoredCriterion = score.criteria.find((c) => c.scoredBy !== "unscored");

  const sequenceRounds: SequenceRoundView[] = roundHistory.map((r) => ({
    roundIndex: r.roundIndex,
    woaClamped: woaFor(r.initial, r.advice, r.final),
    isSeededError: r.isSeededError,
  }));

  return (
    <section className="overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04]">
      <header className="border-b border-inherit px-5 py-3">
        <Label text={t("delegation.resultLabel")} />
        <p className="text-base font-semibold">
          {scoredCriterion
            ? scoredCriterion.level !== null
              ? `${scoredCriterion.id}: ${scoredCriterion.level} / 2`
              : `${scoredCriterion.id}: ${t("delegation.unscored")}`
            : score.pendingPair
              ? t("delegation.pendingPairNote")
              : t("delegation.unscored")}
        </p>
      </header>

      <div className="space-y-5 p-5">
        {score.isVoid && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{t("delegation.reveal.voidNote")}</p>}
        {score.pendingPair && <p className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm">{t("delegation.pendingPairNote")}</p>}

        {item.kind === "sequence" ? (
          <AdvisorSequence rounds={sequenceRounds} />
        ) : item.kind !== "split" && initial !== null && final !== null && advice !== null && score.truth !== null ? (
          <ThreePositionReveal
            initial={initial}
            final={final}
            advice={advice}
            truth={score.truth}
            unitLabel={unitLabel}
            direction={score.direction}
            woaRaw={score.woaRaw}
            netGain={score.netGain}
            isVoid={score.isVoid}
          />
        ) : null}

        {scoredCriterion && (
          <div className="rounded-md border bg-background/60 p-3">
            <Label text={t("delegation.evidenceLabel")} />
            <p className="text-sm leading-relaxed">{scoredCriterion.evidence}</p>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label text={t("delegation.perCriterion")} />
          <DelegationRubricRail scores={score.criteria} compact />
        </div>

        {result.masteryUnmet.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <Label text={t("delegation.masteryRemaining")} />
            <MasteryGapList gaps={result.masteryUnmet} ns="delegation" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={onNext} disabled={busy}>
            {t("delegation.nextItem")}
          </Button>
          <Button variant="outline" onClick={onBack}>
            {t("delegation.backToLab")}
          </Button>
        </div>
      </div>
    </section>
  );
}
