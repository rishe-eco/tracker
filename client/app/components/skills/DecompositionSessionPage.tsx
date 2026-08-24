import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { FileText, Lock, PenLine } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import {
  COMPLETE_SKILL_PROBE,
  LOCK_DECOMPOSITION_DIAGNOSIS,
  LOCK_DECOMPOSITION_WHOLE,
  LOG_SKILL_CHECK_EVENT,
  START_DECOMPOSITION_ITEM,
  START_DECOMPOSITION_REVISION,
  SUBMIT_DECOMPOSITION_ATTEMPT,
} from "~/api/queries";
import MasteryGapList, { type MasteryGap } from "./MasteryGapList";
import DecompositionRubricRail, { type DecompositionCriterionScore } from "./DecompositionRubricRail";
import BreakdownCanvas, { type CanvasNode } from "./BreakdownCanvas";
import RecomposeReveal, { type Reveal } from "./RecomposeReveal";
import SkillSelfReportForm from "./SkillSelfReportForm";

const FAULT_TAGS = ["monolith", "overlap", "missing_element", "inverted_dependency", "premature_split"] as const;

type DecompositionItem = {
  itemId: string;
  moduleKey: string;
  type: "arrangement" | "breakdown" | "repair" | "control";
  difficulty: number;
  scenario: string;
  palette: { id: string; label: string }[] | null;
  suppliedTree: { id: string; parentId: string | null; depth: number; label: string; dependsOn: string[] }[] | null;
  suppliedWhole: { statement: string; doneWhen: string } | null;
};

type Served = {
  attemptId: string;
  item: DecompositionItem;
  needsDiagnosis: boolean;
  draftStructure: string | null;
};

type SubmitResult = {
  attemptId: string;
  score: {
    criteria: DecompositionCriterionScore[];
    total: number;
    scoredCount: number;
    coverage: { found: number; required: number } | null;
    bfi: number | null;
    overDecomposed: boolean;
    isVoid: boolean;
    isComplete: boolean;
  };
  diagnosisCorrect: boolean | null;
  delta: number | null;
  moduleState: string;
  masteryUnmet: MasteryGap[];
  atCriterion: boolean;
  reveal: Reveal;
};

/**
 * The stage order differs by item type, and not arbitrarily: a repair item
 * diagnoses someone else's structure before touching it (that's the reading
 * exercise); every other type states the whole first, because until it's
 * locked there is nothing to arrange pieces against. What is constant:
 * whatever the learner commits, they commit it before any score appears.
 */
type Stage = "diagnose" | "whole" | "canvas" | "result";

function firstStage(item: DecompositionItem, isRevision: boolean): Stage {
  if (isRevision) return "whole";
  return item.type === "repair" ? "diagnose" : "whole";
}

function initialNodesFor(item: DecompositionItem): CanvasNode[] {
  if (item.type === "repair" && item.suppliedTree) {
    return item.suppliedTree.map((n) => ({ id: n.id, parentId: n.parentId, label: n.label, doneWhen: "", dependsOn: n.dependsOn }));
  }
  return [];
}

export default function DecompositionSessionPage() {
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
  const [stage, setStage] = useState<Stage>("whole");
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeDone, setProbeDone] = useState(false);

  const [faultTag, setFaultTag] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [committedLabels, setCommittedLabels] = useState<{ id: string; label: string }[]>([]);
  const [committedWhole, setCommittedWhole] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const resultRef = useRef<HTMLElement | null>(null);

  const reset = () => {
    setFaultTag(null);
    setStatement("");
    setDoneWhen("");
    setNodes([]);
    setResult(null);
    setError(null);
  };

  const loadItem = useCallback(async () => {
    setLoading(true);
    reset();

    const data = await call({ query: START_DECOMPOSITION_ITEM, variables: { mode, moduleKey, probeId } });
    if (!data) {
      setError(t("decomposition.errors.couldNotStart"));
      setLoading(false);
      return;
    }
    if (!data.startDecompositionItem) {
      setExhausted(true);
      setLoading(false);
      return;
    }
    const next: Served = data.startDecompositionItem;
    setServed(next);
    setNodes(initialNodesFor(next.item));
    setStage(firstStage(next.item, false));
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

  const lockDiagnosis = async () => {
    if (!served || !faultTag) return;
    setBusy(true);
    const ok = await call({ query: LOCK_DECOMPOSITION_DIAGNOSIS, variables: { attemptId: served.attemptId, tags: [faultTag] } });
    setBusy(false);
    if (!ok) return setError(t("decomposition.errors.couldNotLock"));
    setStage("whole");
  };

  const lockWhole = async () => {
    if (!served) return;
    setBusy(true);
    const ok = await call({
      query: LOCK_DECOMPOSITION_WHOLE,
      variables: { attemptId: served.attemptId, statement, doneWhen },
    });
    setBusy(false);
    if (!ok) return setError(t("decomposition.errors.couldNotLock"));
    setStage("canvas");
  };

  const logEvent = (kind: "node_added" | "node_moved" | "dependency_set", payload: unknown) => {
    if (!served) return;
    void call({
      query: LOG_SKILL_CHECK_EVENT,
      variables: { attemptId: served.attemptId, kind, payload: JSON.stringify(payload) },
    });
  };

  const depthOf = (list: CanvasNode[], id: string): 1 | 2 => {
    const n = list.find((x) => x.id === id);
    return n?.parentId ? 2 : 1;
  };

  const addNode = (input: { id: string; label: string; parentId: string | null }) => {
    setNodes((prev) => {
      const next = [...prev, { id: input.id, parentId: input.parentId, label: input.label, doneWhen: "", dependsOn: [] as string[] }];
      logEvent("node_added", { nodeId: input.id, parentId: input.parentId, depth: input.parentId ? 2 : 1 });
      return next;
    });
  };

  const removeNode = (id: string) => setNodes((prev) => prev.filter((n) => n.id !== id && n.parentId !== id));
  const relabelNode = (id: string, label: string) => setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, label } : n)));
  const setDoneWhenOn = (id: string, value: string) => setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, doneWhen: value } : n)));
  const reparentNode = (id: string, parentId: string | null) => {
    setNodes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, parentId } : n));
      logEvent("node_moved", { nodeId: id, parentId, depth: parentId ? 2 : 1 });
      return next;
    });
  };
  const setDependsOnFor = (id: string, dependsOn: string[]) => {
    setNodes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, dependsOn } : n));
      logEvent("dependency_set", { nodeId: id, dependsOn });
      return next;
    });
  };

  const commit = async () => {
    if (!served) return;
    setBusy(true);
    const structure = {
      whole: { statement, doneWhen },
      nodes: nodes.map((n, i) => ({
        id: n.id,
        parentId: n.parentId,
        label: n.label,
        doneWhen: n.doneWhen,
        order: i + 1,
        dependsOn: n.dependsOn,
      })),
    };
    const data = await call({
      query: SUBMIT_DECOMPOSITION_ATTEMPT,
      variables: { attemptId: served.attemptId, structure, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.submitDecompositionAttempt) return setError(t("decomposition.errors.couldNotSubmit"));
    setCommittedLabels(nodes.map((n) => ({ id: n.id, label: n.label })));
    setCommittedWhole(statement);
    setResult(data.submitDecompositionAttempt);
    setStage("result");
  };

  const startRevision = async () => {
    if (!served) return;
    setBusy(true);
    const data = await call({ query: START_DECOMPOSITION_REVISION, variables: { attemptId: served.attemptId } });
    setBusy(false);
    if (!data?.startDecompositionRevision) return setError(t("decomposition.errors.couldNotStart"));
    const next: Served = data.startDecompositionRevision;
    reset();
    setServed(next);
    setNodes(initialNodesFor(next.item));
    setStage("whole");
  };

  const completeProbe = async (selfReport: number[]) => {
    if (!timepoint) return;
    setBusy(true);
    const data = await call({
      query: COMPLETE_SKILL_PROBE,
      variables: { skillKey: "decomposition", timepoint, selfReport },
    });
    setBusy(false);
    if (!data?.completeSkillProbe) return setError(t("skills.probe.errors.couldNotComplete"));
    setProbeDone(true);
  };

  if (loading) return <LoadingBlock />;

  if (exhausted) {
    if (isProbe) {
      if (probeDone) {
        return (
          <InternalPageLayout title={t("decomposition.title")}>
            <div className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-6">
              <h2 className="text-lg font-semibold">{t("skills.probe.completeTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("skills.probe.completeBody")}</p>
              <Button onClick={() => navigate("/tools/skills/decomposition")}>{t("skills.probe.backToLab")}</Button>
            </div>
          </InternalPageLayout>
        );
      }
      return (
        <InternalPageLayout title={t("decomposition.title")}>
          {error && <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
          <SkillSelfReportForm onSubmit={(values) => void completeProbe(values)} busy={busy} />
        </InternalPageLayout>
      );
    }
    return (
      <InternalPageLayout title={t("decomposition.title")}>
        <div className="space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("decomposition.exhaustedTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("decomposition.exhaustedBody")}</p>
          <Button onClick={() => navigate("/tools/skills/decomposition")}>{t("decomposition.backToLab")}</Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!served) {
    return (
      <InternalPageLayout title={t("decomposition.title")}>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{error ?? t("decomposition.errors.couldNotStart")}</p>
        </div>
      </InternalPageLayout>
    );
  }

  const item = served.item;

  return (
    <InternalPageLayout title={t("decomposition.title")}>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t(`decomposition.moduleName.${item.moduleKey}`, { defaultValue: item.moduleKey })}</span>
            <span className="rounded border px-1.5 py-0.5 font-mono text-[10px]">{t(`decomposition.itemType.${item.type}`)}</span>
          </div>

          {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

          <section className="rounded-lg border bg-card p-5">
            <Label icon={FileText} text={t("decomposition.task")} />
            <p className="text-sm font-medium leading-relaxed">{item.scenario}</p>
          </section>

          {/* ── Repair: diagnose the supplied structure first ───────────────── */}
          {stage === "diagnose" && item.suppliedTree && (
            <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
              <div>
                <Label icon={Lock} text={t("decomposition.diagnoseTitle")} />
                <p className="text-sm">{t("decomposition.diagnoseBody")}</p>
              </div>
              {item.suppliedWhole && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{item.suppliedWhole.statement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.suppliedWhole.doneWhen}</p>
                </div>
              )}
              <SuppliedTreeView tree={item.suppliedTree} />
              <div className="flex flex-wrap gap-2">
                {FAULT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFaultTag(tag)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      faultTag === tag ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t(`decomposition.faultTag.${tag}`)}
                  </button>
                ))}
              </div>
              <div className="border-t pt-3">
                <Button onClick={() => void lockDiagnosis()} disabled={busy || !faultTag}>
                  <Lock className="mr-2 h-4 w-4" aria-hidden />
                  {t("decomposition.lockDiagnosis")}
                </Button>
              </div>
            </section>
          )}

          {/* ── The whole, stated and locked before any piece ────────────────── */}
          {stage === "whole" && (
            <section className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <Label icon={Lock} text={t("decomposition.wholeTitle")} />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t("decomposition.wholeStatementLabel")}</p>
                <Input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder={t("decomposition.wholeStatementPlaceholder")} autoComplete="off" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t("decomposition.wholeDoneWhenLabel")}</p>
                <Input value={doneWhen} onChange={(e) => setDoneWhen(e.target.value)} placeholder={t("decomposition.wholeDoneWhenPlaceholder")} autoComplete="off" />
              </div>
              <p className="text-[11px] text-muted-foreground">{t("decomposition.wholeGateHint")}</p>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void lockWhole()} disabled={busy || !statement.trim() || !doneWhen.trim()}>
                  {t("decomposition.lockWhole")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("decomposition.wholeNotEditable")}</span>
              </div>
            </section>
          )}

          {/* ── The breakdown canvas ─────────────────────────────────────────── */}
          {stage === "canvas" && (
            <section className="space-y-3 rounded-lg border bg-card p-5">
              <Label icon={PenLine} text={t("decomposition.canvasTitle")} />
              <div className="rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{statement}</span> — {doneWhen}
              </div>
              <BreakdownCanvas
                nodes={nodes}
                palette={item.palette ?? undefined}
                freeAuthoring={item.type !== "arrangement"}
                disabled={busy}
                onAdd={addNode}
                onRemove={removeNode}
                onRelabel={relabelNode}
                onDoneWhenChange={setDoneWhenOn}
                onReparent={reparentNode}
                onDependsOnChange={setDependsOnFor}
              />
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void commit()} disabled={busy}>
                  {t("decomposition.commit")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("decomposition.commitLocks")}</span>
              </div>
            </section>
          )}

          {/* ── Result ────────────────────────────────────────────────────────── */}
          {stage === "result" && result && (
            <div ref={resultRef as any} tabIndex={-1}>
              <ResultPanel
                result={result}
                itemType={item.type}
                wholeStatement={committedWhole}
                submittedLabels={committedLabels}
                onRevise={() => void startRevision()}
                onNext={() => void loadItem()}
                onBack={() => navigate("/tools/skills/decomposition")}
                busy={busy}
              />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 text-sm font-semibold">{t("decomposition.rubricTitle")}</p>
            <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("decomposition.rubricHint")}</p>
            <DecompositionRubricRail scores={result?.score.criteria} />
          </div>
        </aside>
      </div>
    </InternalPageLayout>
  );
}

function SuppliedTreeView({ tree }: { tree: DecompositionItem["suppliedTree"] }) {
  if (!tree) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {tree.map((n, i) => (
        <div key={n.id} className={n.parentId ? "ms-6 border-s-2 ps-3" : ""}>
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground">
              {i + 1}
            </span>
            <span className="flex-1">{n.label}</span>
            {n.dependsOn.length > 0 && (
              <span className="shrink-0 rounded-full border border-dashed px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {n.dependsOn.length}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
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
  itemType: string;
  wholeStatement: string;
  submittedLabels: { id: string; label: string }[];
  onRevise: () => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
};

function ResultPanel({ result, itemType, wholeStatement, submittedLabels, onRevise, onNext, onBack, busy }: ResultProps) {
  const { t } = useTranslation();
  const { score } = result;
  const maxPossible = score.scoredCount * 2;
  const d6 = score.criteria.find((c) => c.id === "D6");

  return (
    <section className="overflow-hidden rounded-lg border-2 border-primary/40 bg-primary/[0.04]">
      <header className="border-b border-inherit px-5 py-3">
        <Label text={t("decomposition.resultLabel")} />
        <p className="text-base font-semibold">
          {result.diagnosisCorrect === true
            ? t("decomposition.diagnosisCorrect")
            : result.diagnosisCorrect === false
              ? t("decomposition.diagnosisIncorrect")
              : t("decomposition.scored")}
        </p>
      </header>

      <div className="space-y-5 p-5">
        {score.isVoid && <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{t("decomposition.voidNote")}</p>}

        <div>
          <Label text={t("decomposition.recomposeTitle")} />
          <RecomposeReveal
            wholeStatement={wholeStatement}
            submittedLabels={submittedLabels}
            reveal={result.reveal}
            coverageScored={d6?.level !== null && d6?.level !== undefined}
          />
        </div>

        <div className="space-y-2">
          <Label text={t("decomposition.perCriterion")} />
          {score.criteria.map((c) => (
            <CriterionRow key={c.id} score={c} />
          ))}
        </div>

        {/* The number, last and small — n/scoredCount*2, never a silently weakened n/12. */}
        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <div className="rounded-md border bg-background/60 p-3">
            <Label text={t("decomposition.total")} />
            <p className="text-2xl font-semibold tabular-nums">{score.scoredCount === 0 ? "—" : `${score.total} / ${maxPossible}`}</p>
            <p className="text-[11px] text-muted-foreground">
              {score.scoredCount === 0 ? t("decomposition.nothingScored") : t("decomposition.ofCriteria", { scored: score.scoredCount, total: 6, max: maxPossible })}
            </p>
          </div>
          <div className="rounded-md border bg-background/60 p-3">
            <Label text={t("decomposition.overDecomposedLabel")} />
            <p className="text-2xl font-semibold tabular-nums">{result.delta == null ? "—" : result.delta > 0 ? `+${result.delta}` : String(result.delta)}</p>
            <p className="text-[11px] text-muted-foreground">
              {itemType === "control"
                ? score.overDecomposed
                  ? t("decomposition.overDecomposedYes")
                  : t("decomposition.overDecomposedNo")
                : t(result.delta == null ? "decomposition.deltaHint" : "decomposition.deltaSetHint")}
            </p>
          </div>
        </div>

        {result.masteryUnmet.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <Label text={t("decomposition.masteryRemaining")} />
            <MasteryGapList gaps={result.masteryUnmet} ns="decomposition" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {result.delta == null && (
            <Button onClick={onRevise} disabled={busy}>
              {t("decomposition.reviseIt")}
            </Button>
          )}
          <Button variant={result.delta == null ? "outline" : "default"} onClick={onNext} disabled={busy}>
            {t("decomposition.nextItem")}
          </Button>
          <Button variant="outline" onClick={onBack}>
            {t("decomposition.backToLab")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CriterionRow({ score }: { score: DecompositionCriterionScore }) {
  const { t } = useTranslation();
  const unscored = score.level === null;
  return (
    <div className={`rounded-md border p-3 ${unscored ? "border-dashed bg-muted/30" : "bg-background/60"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          <span className="font-mono text-xs text-muted-foreground">{score.id}</span> {t(`decomposition.rubric.${score.id}.label`)}
        </p>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{unscored ? t("decomposition.unscored") : `${score.level} / 2`}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{unscored ? t("decomposition.unscoredHint") : score.evidence}</p>
    </div>
  );
}
