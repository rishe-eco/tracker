import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, PenLine } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_DECOMPOSITION_MODULES, GET_DECOMPOSITION_PROGRESS } from "~/api/queries";
import RichText from "./RichText";
import DecompositionRubricRail from "./DecompositionRubricRail";
import SkillProbeBanner from "./SkillProbeBanner";

type DecompositionModule = {
  moduleKey: string;
  title: string;
  concept: string;
  model: string;
  criterion: string;
  state: string;
  masteredAt: string | null;
  nextReviewAt: string | null;
};

type CriterionMean = { criterion: string; mean: number | null; count: number };

type DecompositionProgress = {
  reviewStatus: string;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  totalAttempts: number;
  criterionMeans: CriterionMean[];
  breadthFirstIndexTrend: number[];
  granularityDiscrimination: number | null;
  probeReady: boolean;
  probeBlockers: string[];
};

export default function DecompositionLabPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [modules, setModules] = useState<DecompositionModule[] | null>(null);
  const [progress, setProgress] = useState<DecompositionProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [m, p] = await Promise.all([
      call({ query: GET_DECOMPOSITION_MODULES }),
      call({ query: GET_DECOMPOSITION_PROGRESS }),
    ]);
    if (!m?.decompositionModules || !p?.decompositionProgress) {
      setFailed(true);
      return;
    }
    setModules(m.decompositionModules);
    setProgress(p.decompositionProgress);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("decomposition.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("decomposition.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("skills.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!modules || !progress) return <LoadingBlock />;

  const introSteps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`decomposition.intro.step${n}Title`),
    body: t(`decomposition.intro.step${n}Body`),
  }));

  // Statistics appear only once there is progress (Evidence Lab §9, learned
  // from real use) — a first visit that opens on zeroed metrics presents
  // unanswered questions in place of an explanation.
  const started = progress.totalAttempts > 0;
  const lastBfi = progress.breadthFirstIndexTrend.length
    ? progress.breadthFirstIndexTrend[progress.breadthFirstIndexTrend.length - 1]
    : null;

  return (
    <InternalPageLayout title={t("decomposition.title")}>
      <ModuleIntroOverlay moduleKey="skills.decomposition" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("decomposition.subtitle")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate("/tools/skills/decomposition/session")}>
            <PenLine className="mr-2 h-4 w-4" aria-hidden />
            {started ? t("decomposition.startSitting") : t("decomposition.startFirstSitting")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("decomposition.sittingLength")}</span>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">{t("decomposition.realWork.entryTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("decomposition.realWork.entryBody")}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => navigate("/tools/skills/decomposition/real-work")}
          >
            {t("decomposition.realWork.entryButton")}
          </Button>
        </div>

        {progress.reviewStatus === "draft" && <Banner tone="info" text={t("skills.banners.draftLocale")} />}

        {!progress.probeReady ? (
          <Banner tone="warn" text={t("skills.banners.probeBlocked", { count: progress.probeBlockers.length })} />
        ) : (
          <SkillProbeBanner
            skillKey="decomposition"
            sessionRoute="/tools/skills/decomposition/session"
            hasBaseline={progress.hasBaseline}
            assessmentSkipped={progress.assessmentSkipped}
            onSkipped={() => void load()}
          />
        )}

        {started && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label={t("decomposition.metrics.breadthFirst")}
              value={lastBfi == null ? "—" : lastBfi.toFixed(2)}
              hint={t("decomposition.metrics.breadthFirstHint")}
            />
            <Metric
              label={t("decomposition.metrics.discrimination")}
              value={
                progress.granularityDiscrimination == null
                  ? "—"
                  : `${progress.granularityDiscrimination >= 0 ? "+" : ""}${progress.granularityDiscrimination.toFixed(2)}`
              }
              hint={t("decomposition.metrics.discriminationHint")}
            />
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("decomposition.metrics.perCriterion")}</p>
              <ul className="mt-2 space-y-1.5">
                {progress.criterionMeans.map((c) => (
                  <li key={c.criterion} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.criterion}</span>
                    <span className="h-1.5 rounded-full bg-muted">
                      <span
                        className="block h-1.5 rounded-full bg-primary"
                        style={{ width: `${((c.mean ?? 0) / 2) * 100}%` }}
                      />
                    </span>
                    <span className="w-14 text-end text-[11px] tabular-nums text-muted-foreground">
                      {c.count === 0 ? t("decomposition.unscored") : `${c.mean?.toFixed(2)} / 2`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t("decomposition.modulesTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("decomposition.modulesSubtitle")}</p>
            </div>

            {modules.map((m) => (
              <div key={m.moduleKey} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button className="flex-1 text-start" onClick={() => setExpanded(expanded === m.moduleKey ? null : m.moduleKey)}>
                    <span className="flex items-center gap-2 font-medium">
                      <StateIcon state={m.state} />
                      {m.title}
                      <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {m.criterion}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t(`skills.state.${m.state}`)}</span>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/tools/skills/decomposition/session?module=${m.moduleKey}`)}
                  >
                    {t("decomposition.practiceModule")}
                  </Button>
                </div>

                {expanded === m.moduleKey && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("decomposition.conceptLabel")}
                      </p>
                      <RichText text={m.concept} className="text-sm leading-relaxed" />
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("decomposition.exampleLabel")}
                      </p>
                      <RichText text={m.model} className="text-sm leading-relaxed" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Always on screen — the teaching object, not a hidden grading scheme. */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-semibold">{t("decomposition.rubricTitle")}</p>
              <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("decomposition.rubricHint")}</p>
              <DecompositionRubricRail />
            </div>
          </aside>
        </section>
      </div>
    </InternalPageLayout>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}

function StateIcon({ state }: { state: string }) {
  if (state === "mastered" || state === "tested_out") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (state === "due_review") return <Clock className="h-4 w-4 text-amber-600" aria-hidden />;
  return <CircleDot className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function Banner({ tone, text }: { tone: "info" | "warn"; text: string }) {
  const styles = tone === "warn" ? "border-amber-500/40 bg-amber-500/10" : "border-sky-500/40 bg-sky-500/10";
  return (
    <div className={`flex gap-2 rounded-md border p-3 text-sm ${styles}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
