import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleSlash, FileText, Lock, PenLine, Quote, XCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import {
  GET_CLARITY_PROGRESS,
  LOCK_CLARITY_DIAGNOSIS,
  LOCK_CLARITY_PREDICTION,
  START_CLARITY_ITEM,
  START_CLARITY_REVISION,
  SUBMIT_CLARITY_ATTEMPT,
} from "~/api/queries";
import RichText from "./RichText";
import MasteryGapList, { type MasteryGap } from "./MasteryGapList";
import RubricRail, { CRITERIA, type CriterionScore } from "./RubricRail";

type ClarityItem = {
  itemId: string;
  moduleKey: string;
  type: "elicitation" | "revision" | "repair";
  difficulty: number;
  scenario: string;
  contextSheet: string | null;
  weakText: string | null;
  authoredMisread: string | null;
};

type Served = {
  attemptId: string;
  item: ClarityItem;
  needsPrediction: boolean;
  needsDiagnosis: boolean;
  draftText: string | null;
};

type Result = {
  attemptId: string;
  score: {
    criteria: CriterionScore[];
    total: number;
    maxPossible: number;
    scoredCount: number;
    unscored: string[];
    isVoid: boolean;
    isComplete: boolean;
  };
  diagnosis: Diagnosis | null;
  repairPassed: boolean | null;
  delta: number | null;
  reveal: string;
  revealIsAboutItemText: boolean;
  moduleState: string;
  masteryUnmet: MasteryGap[];
  atCriterion: boolean;
  feedbackOnly: string[];
};

type Diagnosis = {
  correct: string[];
  missed: string[];
  spurious: string[];
  /** Tagged, but nothing scored it — neither credited nor held against you. */
  unverifiable?: string[];
};

/**
 * A sitting runs in stages, and the order differs by item type — not
 * arbitrarily, but because the diagnose step means something different in each:
 *
 * - **revision** — study someone else's text and its misread, diagnose *that*,
 *   then rewrite. Diagnosis comes first because it is the reading exercise.
 * - **elicitation** — write, predict what a reader will do with it, see the gap,
 *   then diagnose your *own* text. Diagnosis comes last because until the gap
 *   reveal there is nothing to diagnose.
 * - **repair** — one seeded fault, named in the prompt. Nothing to diagnose.
 *
 * What is constant is the rule: whatever the learner commits, they commit it
 * before any score is shown.
 */
type Stage = "study" | "diagnose" | "write" | "predict" | "gap" | "result";

function firstStage(item: ClarityItem, isRevision: boolean): Stage {
  if (isRevision) return "write";
  return item.type === "revision" ? "study" : "write";
}

export default function ClaritySessionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { call } = useApi();

  const moduleKey = params.get("module") ?? undefined;
  const mode = moduleKey ? "module" : "calibrated_practice";

  const [served, setServed] = useState<Served | null>(null);
  const [stage, setStage] = useState<Stage>("write");
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState("");
  const [prediction, setPrediction] = useState("");
  const [tagged, setTagged] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [detectorCriteria, setDetectorCriteria] = useState<string[]>([]);
  const [readerAvailable, setReaderAvailable] = useState(true);

  const resultRef = useRef<HTMLElement | null>(null);

  const reset = () => {
    setText("");
    setPrediction("");
    setTagged([]);
    setResult(null);
    setError(null);
  };

  const loadItem = useCallback(async () => {
    setLoading(true);
    reset();

    const [data, progress] = await Promise.all([
      call({ query: START_CLARITY_ITEM, variables: { mode, moduleKey } }),
      call({ query: GET_CLARITY_PROGRESS }),
    ]);

    if (progress?.clarityProgress) {
      setDetectorCriteria(progress.clarityProgress.detectorCriteria);
      setReaderAvailable(progress.clarityProgress.readerAvailable);
    }
    if (!data) {
      setError(t("clarity.errors.couldNotStart"));
      setLoading(false);
      return;
    }
    if (!data.startClarityItem) {
      setExhausted(true);
      setLoading(false);
      return;
    }
    const next: Served = data.startClarityItem;
    setServed(next);
    setStage(firstStage(next.item, false));
    setLoading(false);
  }, [call, mode, moduleKey, t]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (stage !== "result") return;
    // Guarded: scrollIntoView is absent in some environments, and an
    // unguarded call here takes down the whole result panel — losing the
    // learner's scores to make the page scroll nicely.
    resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    resultRef.current?.focus?.({ preventScroll: true });
  }, [stage]);

  const lockDiagnosis = async () => {
    if (!served) return;
    setBusy(true);
    const ok = await call({
      query: LOCK_CLARITY_DIAGNOSIS,
      variables: { attemptId: served.attemptId, criteria: tagged },
    });
    setBusy(false);
    if (!ok) return setError(t("clarity.errors.couldNotLock"));
    // Revision items diagnose the supplied text and then rewrite it;
    // elicitation items have already written, so the next stop is the score.
    setStage(served.item.type === "revision" ? "write" : "result");
    if (served.item.type !== "revision") await submit();
  };

  const lockPrediction = async () => {
    if (!served) return;
    setBusy(true);
    const ok = await call({
      query: LOCK_CLARITY_PREDICTION,
      variables: { attemptId: served.attemptId, prediction },
    });
    setBusy(false);
    if (!ok) return setError(t("clarity.errors.couldNotLock"));
    setStage("gap");
  };

  const submit = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: SUBMIT_CLARITY_ATTEMPT,
      variables: {
        attemptId: served.attemptId,
        text,
        timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
      },
    });
    setBusy(false);
    if (!data?.submitClarityAttempt) return setError(t("clarity.errors.couldNotSubmit"));
    setResult(data.submitClarityAttempt);
    setStage("result");
  };

  const startRevision = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({
      query: START_CLARITY_REVISION,
      variables: { attemptId: served.attemptId },
    });
    setBusy(false);
    if (!data?.startClarityRevision) return setError(t("clarity.errors.couldNotStart"));
    const next: Served = data.startClarityRevision;
    reset();
    setServed(next);
    setText("");
    setStage("write");
  };

  if (loading) return <LoadingBlock />;

  if (exhausted) {
    return (
      <InternalPageLayout title={t("clarity.title")}>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("clarity.exhaustedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("clarity.exhaustedBody")}</p>
          <Button onClick={() => navigate("/tools/skills/clarity")}>{t("clarity.backToLab")}</Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!served) {
    return (
      <InternalPageLayout title={t("clarity.title")}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{error ?? t("clarity.errors.couldNotStart")}</p>
        </div>
      </InternalPageLayout>
    );
  }

  const item = served.item;
  const isRevisionPass = served.draftText != null;

  return (
    <InternalPageLayout title={t("clarity.title")}>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t(`clarity.moduleName.${item.moduleKey}`, { defaultValue: item.moduleKey })}</span>
            <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]">
              {t(`clarity.itemType.${item.type}`)}
            </span>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>
          )}

          {/* ── The task ─────────────────────────────────────────────────── */}
          <section className="rounded-lg border bg-card p-5">
            <Label icon={FileText} text={t("clarity.task")} />
            <p className="text-sm font-medium leading-relaxed">{item.scenario}</p>

            {item.contextSheet && (
              <div className="mt-4 rounded-md border border-dashed bg-muted/40 p-3">
                <Label text={t("clarity.contextSheet")} />
                <RichText text={item.contextSheet} className="text-sm leading-relaxed" />
                <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
                  {t("clarity.contextSheetHint")}
                </p>
              </div>
            )}

            {item.weakText && (
              <div className="mt-4 rounded-md border p-3">
                <Label text={t("clarity.weakText")} />
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.weakText}</p>
              </div>
            )}

            {/* The misread is the stimulus on a revision item, not a reveal —
                it ships with the pack, which is what lets these run with no
                model configured. */}
            {item.authoredMisread && (
              <div className="mt-3 rounded-md border border-sky-500/40 bg-sky-500/[0.06] p-3">
                <Label text={t("clarity.whatTheReaderDid")} />
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.authoredMisread}</p>
              </div>
            )}
          </section>

          {stage === "study" && (
            <div className="flex items-center gap-3">
              <Button onClick={() => setStage("diagnose")}>{t("clarity.diagnoseIt")}</Button>
              <span className="text-xs text-muted-foreground">{t("clarity.diagnoseFirstHint")}</span>
            </div>
          )}

          {/* ── Diagnose ─────────────────────────────────────────────────── */}
          {stage === "diagnose" && (
            <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
              <div>
                <Label icon={Lock} text={t("clarity.diagnoseTitle")} />
                <p className="text-sm">{t("clarity.diagnoseBody")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CRITERIA.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setTagged((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
                    }
                    className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      tagged.includes(c)
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="font-mono">{c}</span> {t(`clarity.rubric.${c}.label`)}
                  </button>
                ))}
              </div>
              <div className="border-t pt-3">
                <p className="mb-2 text-xs text-muted-foreground">{t("clarity.diagnoseWarning")}</p>
                <Button onClick={() => void lockDiagnosis()} disabled={busy || tagged.length === 0}>
                  <Lock className="mr-2 h-4 w-4" aria-hidden />
                  {t("clarity.lockDiagnosis")}
                </Button>
              </div>
            </section>
          )}

          {/* ── Write ────────────────────────────────────────────────────── */}
          {stage === "write" && (
            <section className="space-y-3 rounded-lg border bg-card p-5">
              <Label icon={PenLine} text={isRevisionPass ? t("clarity.rewrite") : t("clarity.yourAttempt")} />

              {isRevisionPass && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <Label text={t("clarity.draftLocked")} />
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {served.draftText}
                  </p>
                </div>
              )}

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={t("clarity.editorPlaceholder")}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="font-normal"
              />
              {/* Stated because it will look like a missing feature: a helper in
                  the box would train the helper, not the learner. */}
              <p className="text-[11px] text-muted-foreground">{t("clarity.noAssistNote")}</p>

              <div className="flex items-center gap-3 border-t pt-3">
                <Button
                  onClick={() => (served.needsPrediction ? setStage("predict") : void submit())}
                  disabled={busy || !text.trim()}
                >
                  {served.needsPrediction ? t("clarity.continueToPrediction") : t("clarity.getFeedback")}
                </Button>
                {!served.needsPrediction && (
                  <span className="text-xs text-muted-foreground">{t("clarity.submitLocks")}</span>
                )}
              </div>
            </section>
          )}

          {/* ── Predict, then the gap ────────────────────────────────────── */}
          {stage === "predict" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label icon={Lock} text={t("clarity.predictTitle")} />
              <p className="text-sm">{t("clarity.predictBody")}</p>
              <Textarea
                value={prediction}
                onChange={(e) => setPrediction(e.target.value)}
                rows={4}
                placeholder={t("clarity.predictPlaceholder")}
              />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void lockPrediction()} disabled={busy || !prediction.trim()}>
                  <Lock className="mr-2 h-4 w-4" aria-hidden />
                  {t("clarity.lockPrediction")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("clarity.predictNotEditable")}</span>
              </div>
            </section>
          )}

          {stage === "gap" && (
            <section className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Pane label={t("clarity.whatYouWrote")} body={text} />
                <Pane label={t("clarity.whatYouPredicted")} body={prediction} tone="primary" />
                <Pane label={t("clarity.whatTheReaderProduced")} body={t("clarity.readerPending")} tone="sky" />
              </div>
              <Button onClick={() => setStage("diagnose")}>{t("clarity.diagnoseIt")}</Button>
            </section>
          )}

          {/* ── Result ───────────────────────────────────────────────────── */}
          {stage === "result" && result && (
            <div ref={resultRef as any} tabIndex={-1}>
              <ResultPanel
                result={result}
                itemType={item.type}
                onRevise={() => void startRevision()}
                onNext={() => void loadItem()}
                onBack={() => navigate("/tools/skills/clarity")}
                busy={busy}
              />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 text-sm font-semibold">{t("clarity.rubricTitle")}</p>
            <p className="mb-3 text-[11px] leading-tight text-muted-foreground">
              {t("clarity.rubricHint")}
            </p>
            <RubricRail
              scores={result?.score.criteria}
              detectorCriteria={detectorCriteria}
              readerAvailable={readerAvailable}
            />
          </div>
        </aside>
      </div>
    </InternalPageLayout>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Label({ icon: Icon, text }: { icon?: any; text: string }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {text}
    </p>
  );
}

function Pane({ label, body, tone }: { label: string; body: string; tone?: "primary" | "sky" }) {
  const styles =
    tone === "primary"
      ? "border-primary/40 bg-primary/[0.06]"
      : tone === "sky"
        ? "border-sky-500/40 bg-sky-500/[0.06]"
        : "";
  return (
    <div className={`rounded-md border p-3 ${styles}`}>
      <Label text={label} />
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}

type ResultProps = {
  result: Result;
  itemType: string;
  onRevise: () => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
};

/**
 * Per-criterion first, aggregate last — the inverse of Evidence Lab, and
 * deliberately so. There the verdict is the question; here the number is the
 * least useful thing on the screen and six lines with evidence are the most.
 */
function ResultPanel({ result, itemType, onRevise, onNext, onBack, busy }: ResultProps) {
  const { t } = useTranslation();
  const { score } = result;

  return (
    <section className="overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04]">
      <header className="border-b border-inherit px-5 py-3">
        <Label text={t("clarity.resultLabel")} />
        <p className="text-base font-semibold">
          {result.repairPassed === true
            ? t("clarity.repairPassed")
            : result.repairPassed === false
              ? t("clarity.repairFailed")
              : t("clarity.scored")}
        </p>
      </header>

      <div className="space-y-5 p-5">
        {score.isVoid && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {t("clarity.voidNote")}
        </p>}

        {result.diagnosis && <DiagnosisRow diagnosis={result.diagnosis} />}

        <div className="space-y-2">
          <Label text={t("clarity.perCriterion")} />
          {score.criteria.map((c) => (
            <CriterionRow key={c.criterion} score={c} feedbackOnly={result.feedbackOnly.includes(c.criterion)} />
          ))}
        </div>

        {/* Authored commentary, and on every item but write-from-scratch it is
            about the text the item shipped rather than about what the learner
            wrote. Rendered flush under their own per-criterion scores, using the
            same R-codes, an unlabelled version reads as being about their text. */}
        <div className="space-y-1.5">
          <Label
            text={
              result.revealIsAboutItemText
                ? t("clarity.explanationOfOriginal")
                : t("clarity.explanation")
            }
          />
          <RichText text={result.reveal} className="text-sm leading-relaxed" />
        </div>

        {/* The number, last and small. `7/10, 5 of 6 criteria` — never a
            silently weakened 7/12. */}
        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          {/* With no reader and no detectors for this language, nothing at all
              was assessed. "0 / 0" reads as a score of zero; it is the absence
              of one. */}
          <div className="rounded-md border bg-background/60 p-3">
            <Label text={t("clarity.total")} />
            <p className="text-2xl font-semibold tabular-nums">
              {score.scoredCount === 0 ? "—" : `${score.total} / ${score.maxPossible}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {score.scoredCount === 0
                ? t("clarity.nothingScored")
                : t("clarity.ofCriteria", { scored: score.scoredCount, total: 6 })}
            </p>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <Label text={t("clarity.delta")} />
            <p className="text-2xl font-semibold tabular-nums">
              {result.delta == null ? "—" : result.delta > 0 ? `+${result.delta}` : String(result.delta)}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("clarity.deltaHint")}</p>
          </div>
        </div>

        {result.masteryUnmet.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <Label text={t("clarity.masteryRemaining")} />
            <MasteryGapList gaps={result.masteryUnmet} ns="clarity" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {result.delta == null && itemType !== "repair" && (
            <Button onClick={onRevise} disabled={busy}>
              {t("clarity.reviseIt")}
            </Button>
          )}
          <Button variant={result.delta == null ? "outline" : "default"} onClick={onNext} disabled={busy}>
            {t("clarity.nextItem")}
          </Button>
          <Button variant="outline" onClick={onBack}>
            {t("clarity.backToLab")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CriterionRow({ score, feedbackOnly }: { score: CriterionScore; feedbackOnly: boolean }) {
  const { t } = useTranslation();
  const unscored = score.level === null;

  return (
    <div className={`rounded-md border p-3 ${unscored ? "border-dashed bg-muted/30" : "bg-background/60"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          <span className="font-mono text-xs text-muted-foreground">{score.criterion}</span>{" "}
          {t(`clarity.rubric.${score.criterion}.label`)}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {unscored ? t("clarity.unscored") : `${score.level} / 2`}
        </span>
      </div>

      {unscored ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("clarity.unscoredHint")}</p>
      ) : (
        <>
          {score.findings.map((f, i) => (
            <p key={i} className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {f}
            </p>
          ))}
          {/* A level without evidence is an opinion with a number on it. */}
          {score.evidenceQuote && (
            <p className="mt-1.5 flex gap-1.5 border-s-2 border-sky-500/60 ps-2 text-xs italic leading-relaxed">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-sky-600" aria-hidden />
              {score.evidenceQuote}
            </p>
          )}
          {feedbackOnly && (
            <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-500">
              {t("clarity.feedbackOnly")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Tagged versus what actually failed. The miss is the interesting cell. */
function DiagnosisRow({ diagnosis }: { diagnosis: Diagnosis }) {
  const { t } = useTranslation();
  // The fourth cell only appears when it has something in it — usually because
  // no AI scorer is configured, so R2/R3/R5 carry no level. Filing those under
  // "flagged but fine" would be the app asserting a verdict it doesn't have.
  // Defaulted, not asserted: the same rule as the guarded `scrollIntoView`
  // above — a missing field must not take the whole result panel down and lose
  // the learner their scores.
  const unverifiable = diagnosis.unverifiable ?? [];
  const hasUnverifiable = unverifiable.length > 0;

  return (
    <div className="rounded-md border bg-background/60 p-3">
      <Label text={t("clarity.yourDiagnosis")} />
      <div className={`grid gap-3 text-xs ${hasUnverifiable ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        <Cell icon={CheckCircle2} tone="good" label={t("clarity.spotted")} items={diagnosis.correct} />
        <Cell icon={XCircle} tone="warn" label={t("clarity.missed")} items={diagnosis.missed} />
        <Cell icon={XCircle} tone="muted" label={t("clarity.spurious")} items={diagnosis.spurious} />
        {hasUnverifiable && (
          <Cell
            icon={CircleSlash}
            tone="muted"
            label={t("clarity.diagnosisUnverifiable")}
            items={unverifiable}
          />
        )}
      </div>
      {hasUnverifiable && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {t("clarity.diagnosisUnverifiableHint")}
        </p>
      )}
    </div>
  );
}

function Cell({
  icon: Icon,
  tone,
  label,
  items,
}: {
  icon: any;
  tone: "good" | "warn" | "muted";
  label: string;
  items: string[];
}) {
  const colour =
    tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-muted-foreground";
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className={`h-3 w-3 ${colour}`} aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 font-mono">{items.length ? items.join(" ") : "—"}</p>
    </div>
  );
}
