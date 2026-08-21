import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FileText, Lock, PenLine, UploadCloud } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useApi } from "~/api/useApi";
import {
  EXPORT_DECOMPOSITION_BREAKDOWN,
  GET_ALL_GOALS,
  GET_PROJECTS,
  LOCK_DECOMPOSITION_WHOLE,
  LOG_SKILL_CHECK_EVENT,
  START_DECOMPOSITION_REAL_WORK,
  SUBMIT_DECOMPOSITION_REAL_WORK,
} from "~/api/queries";
import DecompositionRubricRail, { type DecompositionCriterionScore } from "./DecompositionRubricRail";
import BreakdownCanvas, { type CanvasNode } from "./BreakdownCanvas";

type TargetType = "goal" | "project";
type PickTarget = { targetType: TargetType; targetId: string; title: string };

type Served = { attemptId: string; targetType: TargetType; targetId: string; title: string; dod: string };

type SubmitResult = {
  attemptId: string;
  score: {
    criteria: DecompositionCriterionScore[];
    total: number;
    scoredCount: number;
    isVoid: boolean;
  };
};

type ExportResult = {
  createdProjects: { id: string; title: string }[];
  createdActions: { id: string; title: string; projectId: string | null }[];
  dependencyEdgesDropped: number;
};

/** The stage order is fixed: pick a real target, state the whole, build the breakdown, then review before anything is written. */
type Stage = "pick" | "whole" | "canvas" | "result" | "done";

export default function DecompositionRealWorkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [stage, setStage] = useState<Stage>("pick");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [targets, setTargets] = useState<PickTarget[] | null>(null);
  const [picked, setPicked] = useState<PickTarget | null>(null);

  const [served, setServed] = useState<Served | null>(null);
  const [statement, setStatement] = useState("");
  const [doneWhen, setDoneWhen] = useState("");
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([call({ query: GET_ALL_GOALS }), call({ query: GET_PROJECTS })]).then(([g, p]) => {
      if (cancelled) return;
      const goalTargets: PickTarget[] = (g?.goals ?? [])
        .filter((goal: any) => !goal.isGoalGroup)
        .map((goal: any) => ({ targetType: "goal" as const, targetId: goal.id, title: goal.title }));
      const projectTargets: PickTarget[] = (p?.projects ?? []).map((project: any) => ({
        targetType: "project" as const,
        targetId: project.id,
        title: project.title,
      }));
      setTargets([...goalTargets, ...projectTargets]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [call]);

  const startOnPicked = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const data = await call({
      query: START_DECOMPOSITION_REAL_WORK,
      variables: { targetType: picked.targetType, targetId: picked.targetId },
    });
    setBusy(false);
    if (!data?.startDecompositionRealWork) return setError(t("decomposition.realWork.errors.couldNotStart"));
    setServed(data.startDecompositionRealWork);
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
      query: SUBMIT_DECOMPOSITION_REAL_WORK,
      variables: { attemptId: served.attemptId, structure, timeZoneOffsetMinutes: new Date().getTimezoneOffset() },
    });
    setBusy(false);
    if (!data?.submitDecompositionRealWork) return setError(t("decomposition.errors.couldNotSubmit"));
    setResult(data.submitDecompositionRealWork);
    setSelected(new Set());
    setStage("result");
  };

  const runExport = async () => {
    if (!served) return;
    const data = await call({
      query: EXPORT_DECOMPOSITION_BREAKDOWN,
      variables: { attemptId: served.attemptId, nodeIds: [...selected] },
    });
    if (!data?.exportDecompositionBreakdown) {
      setError(t("decomposition.realWork.errors.couldNotExport"));
      return;
    }
    setExportResult(data.exportDecompositionBreakdown);
    setStage("done");
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dependencyEdgesAmongSelected = nodes
    .filter((n) => selected.has(n.id))
    .reduce((sum, n) => sum + n.dependsOn.filter((dep) => selected.has(dep)).length, 0);

  if (loading) return <LoadingBlock />;

  return (
    <InternalPageLayout title={t("decomposition.realWork.title")}>
      <div className="space-y-6">
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}

        {stage === "pick" && (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("decomposition.realWork.pickBody")}</p>
            {!targets || targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("decomposition.realWork.noTargets")}</p>
            ) : (
              <ul className="space-y-2">
                {targets.map((tgt) => (
                  <li key={`${tgt.targetType}:${tgt.targetId}`}>
                    <button
                      type="button"
                      onClick={() => setPicked(tgt)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-start text-sm transition-colors ${
                        picked?.targetId === tgt.targetId && picked?.targetType === tgt.targetType
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span>{tgt.title}</span>
                      <span className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t(`decomposition.realWork.targetType.${tgt.targetType}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => void startOnPicked()} disabled={!picked || busy}>
              {t("decomposition.realWork.startOnPicked")}
            </Button>
          </section>
        )}

        {stage === "whole" && served && (
          <section className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {t("decomposition.realWork.materialLabel")}
              </p>
              <p className="text-sm font-medium">{served.title}</p>
              {served.dod && <p className="mt-1 text-sm text-muted-foreground">{served.dod}</p>}
            </div>

            <div className="space-y-3 rounded-lg border-2 border-primary/40 bg-card p-5">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {t("decomposition.wholeTitle")}
              </p>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t("decomposition.wholeStatementLabel")}</p>
                <Input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder={t("decomposition.wholeStatementPlaceholder")} autoComplete="off" />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{t("decomposition.wholeDoneWhenLabel")}</p>
                <Input value={doneWhen} onChange={(e) => setDoneWhen(e.target.value)} placeholder={t("decomposition.wholeDoneWhenPlaceholder")} autoComplete="off" />
              </div>
              <div className="flex items-center gap-3 border-t pt-3">
                <Button onClick={() => void lockWhole()} disabled={busy || !statement.trim() || !doneWhen.trim()}>
                  {t("decomposition.lockWhole")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("decomposition.wholeNotEditable")}</span>
              </div>
            </div>
          </section>
        )}

        {stage === "canvas" && (
          <section className="space-y-3 rounded-lg border bg-card p-5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              {t("decomposition.canvasTitle")}
            </p>
            <div className="rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{statement}</span> — {doneWhen}
            </div>
            <BreakdownCanvas
              nodes={nodes}
              freeAuthoring
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

        {stage === "result" && result && served && (
          <section className="space-y-6">
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-semibold">{t("decomposition.rubricTitle")}</p>
              <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("decomposition.realWork.noKeyNote")}</p>
              <DecompositionRubricRail scores={result.score.criteria} />
              <p className="mt-3 text-sm">
                {result.score.scoredCount === 0
                  ? t("decomposition.nothingScored")
                  : `${result.score.total} / ${result.score.scoredCount * 2}`}
              </p>
            </div>

            <div className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-5">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <UploadCloud className="h-4 w-4" aria-hidden />
                  {t("decomposition.realWork.exportTitle")}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("decomposition.realWork.exportBody")}</p>
              </div>

              {/* The d5 honesty note, always visible here — this is where dependency information actually dies. */}
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed">
                {t("decomposition.realWork.dependencyNote")}
              </p>

              <ExportChecklist nodes={nodes} selected={selected} onToggle={toggleSelected} />

              {dependencyEdgesAmongSelected > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {t("decomposition.realWork.dependencyCount", { count: dependencyEdgesAmongSelected })}
                </p>
              )}

              <div className="flex items-center gap-3 border-t pt-4">
                <Button onClick={() => setConfirmOpen(true)} disabled={selected.size === 0 || busy}>
                  {t("decomposition.realWork.exportSelected", { count: selected.size })}
                </Button>
                <Button variant="outline" onClick={() => navigate("/tools/skills/decomposition")}>
                  {t("decomposition.backToLab")}
                </Button>
              </div>
            </div>

            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={t("decomposition.realWork.confirmTitle")}
              description={t("decomposition.realWork.confirmBody", { count: selected.size })}
              confirmLabel={t("decomposition.realWork.confirmButton")}
              onConfirm={() => runExport()}
            />
          </section>
        )}

        {stage === "done" && exportResult && (
          <section className="space-y-4 rounded-lg border-2 border-primary/40 bg-card p-6">
            <h2 className="text-lg font-semibold">{t("decomposition.realWork.doneTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("decomposition.realWork.doneBody", {
                projects: exportResult.createdProjects.length,
                actions: exportResult.createdActions.length,
              })}
            </p>
            {exportResult.dependencyEdgesDropped > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("decomposition.realWork.dependencyCount", { count: exportResult.dependencyEdgesDropped })}
              </p>
            )}
            <Button onClick={() => navigate("/tools/skills/decomposition")}>{t("decomposition.realWork.backToLab")}</Button>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

function ExportChecklist({
  nodes,
  selected,
  onToggle,
}: {
  nodes: CanvasNode[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const topLevel = nodes.filter((n) => n.parentId === null);
  const childrenOf = (id: string) => nodes.filter((n) => n.parentId === id);

  if (nodes.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {topLevel.map((node) => (
        <li key={node.id}>
          <ExportRow node={node} checked={selected.has(node.id)} onToggle={() => onToggle(node.id)} />
          {childrenOf(node.id).length > 0 && (
            <ul className="ms-6 space-y-1.5 border-s-2 ps-3">
              {childrenOf(node.id).map((child) => (
                <li key={child.id}>
                  <ExportRow node={child} checked={selected.has(child.id)} onToggle={() => onToggle(child.id)} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function ExportRow({ node, checked, onToggle }: { node: CanvasNode; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="flex-1">{node.label}</span>
      {node.doneWhen && <span className="shrink-0 text-[11px] text-muted-foreground">{node.doneWhen}</span>}
    </label>
  );
}
