import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, PenLine } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_MONITORING_MODULES, GET_MONITORING_PROGRESS } from "~/api/queries";
import RichText from "./RichText";
import MonitoringRubricRail from "./MonitoringRubricRail";
import SkillProbeBanner from "./SkillProbeBanner";

type MonitoringModule = {
  moduleKey: string;
  title: string;
  concept: string;
  model: string;
  state: string;
  masteredAt: string | null;
  nextReviewAt: string | null;
};

type CriterionMean = { criterion: string; mean: number | null; count: number };

type MonitoringProgress = {
  reviewStatus: string;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  totalAttempts: number;
  criterionMeans: CriterionMean[];
  resolutionSampleCount: number;
  resolution: number | null;
  performance: number | null;
  bias: number | null;
  postAiInflation: number | null;
  postAiInflationReady: boolean;
  influenceDiscrimination: number | null;
  probeReady: boolean;
  probeBlockers: string[];
};

export default function MonitoringLabPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [modules, setModules] = useState<MonitoringModule[] | null>(null);
  const [progress, setProgress] = useState<MonitoringProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [m, p] = await Promise.all([call({ query: GET_MONITORING_MODULES }), call({ query: GET_MONITORING_PROGRESS })]);
    if (!m?.monitoringModules || !p?.monitoringProgress) {
      setFailed(true);
      return;
    }
    setModules(m.monitoringModules);
    setProgress(p.monitoringProgress);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("monitoring.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("monitoring.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("skills.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!modules || !progress) return <LoadingBlock />;

  const introSteps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`monitoring.intro.step${n}Title`),
    body: t(`monitoring.intro.step${n}Body`),
  }));

  const started = progress.totalAttempts > 0;

  return (
    <InternalPageLayout title={t("monitoring.title")}>
      <ModuleIntroOverlay moduleKey="skills.monitoring" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("monitoring.subtitle")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate("/tools/skills/monitoring/session")}>
            <PenLine className="mr-2 h-4 w-4" aria-hidden />
            {started ? t("monitoring.startSitting") : t("monitoring.startFirstSitting")}
          </Button>
        </div>

        {progress.reviewStatus === "draft" && <Banner tone="info" text={t("skills.banners.draftLocale")} />}

        {!progress.probeReady ? (
          <Banner tone="warn" text={t("skills.banners.probeBlocked", { count: progress.probeBlockers.length })} />
        ) : (
          <SkillProbeBanner
            skillKey="monitoring"
            sessionRoute="/tools/skills/monitoring/session"
            hasBaseline={progress.hasBaseline}
            assessmentSkipped={progress.assessmentSkipped}
            onSkipped={() => void load()}
          />
        )}

        {started && (
          <>
            {/* Resolution never appears without performance beside it (spec §2, §10) — one bordered pair. */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="col-span-1 grid grid-cols-2 overflow-hidden rounded-lg border sm:col-span-2 lg:col-span-2">
                <Metric
                  label={t("monitoring.metrics.resolution")}
                  value={progress.resolution == null ? t("monitoring.metrics.notMeasurable") : progress.resolution.toFixed(2)}
                  bare
                />
                <Metric
                  label={t("monitoring.metrics.performance")}
                  value={progress.performance == null ? "—" : `${Math.round(progress.performance * 100)}%`}
                  bare
                  leftBorder
                />
              </div>
              <Metric label={t("monitoring.metrics.bias")} value={progress.bias == null ? "—" : `${progress.bias >= 0 ? "+" : ""}${progress.bias.toFixed(2)}`} />
              <Metric
                label={t("monitoring.metrics.influenceDiscrimination")}
                value={progress.influenceDiscrimination == null ? "—" : progress.influenceDiscrimination.toFixed(2)}
              />
            </section>

            {/* The §1.1 finding, withheld until the learner's own number exists (spec §6, §12) — shown attached to it, including near zero. */}
            {progress.postAiInflationReady && progress.postAiInflation !== null && (
              <div className="rounded-lg border bg-amber-500/5 p-4 text-sm leading-relaxed">
                <p className="font-medium">
                  {t("monitoring.metrics.postAiInflation")}: {progress.postAiInflation >= 0 ? "+" : ""}
                  {progress.postAiInflation.toFixed(1)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {Math.abs(progress.postAiInflation) < 0.3 ? t("monitoring.aiLiteracyFinding.near_zero") : t("monitoring.aiLiteracyFinding.attached")}
                </p>
              </div>
            )}
          </>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t("monitoring.modulesTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("monitoring.modulesSubtitle")}</p>
            </div>

            {modules.map((m) => (
              <div key={m.moduleKey} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button className="flex-1 text-start" onClick={() => setExpanded(expanded === m.moduleKey ? null : m.moduleKey)}>
                    <span className="flex items-center gap-2 font-medium">
                      <StateIcon state={m.state} />
                      {m.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t(`skills.state.${m.state}`)}</span>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/tools/skills/monitoring/session?module=${m.moduleKey}`)}>
                    {t("monitoring.practiceModule")}
                  </Button>
                </div>

                {expanded === m.moduleKey && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("monitoring.conceptLabel")}</p>
                      <RichText text={m.concept} className="text-sm leading-relaxed" />
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("monitoring.exampleLabel")}</p>
                      <RichText text={m.model} className="text-sm leading-relaxed" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-semibold">{t("monitoring.rubricTitle")}</p>
              <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("monitoring.rubricHint")}</p>
              <MonitoringRubricRail />
            </div>
          </aside>
        </section>
      </div>
    </InternalPageLayout>
  );
}

function Metric({ label, value, hint, bare, leftBorder }: { label: string; value: string; hint?: string; bare?: boolean; leftBorder?: boolean }) {
  return (
    <div className={bare ? `p-4 ${leftBorder ? "border-l" : ""}` : "rounded-lg border bg-card p-4"}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StateIcon({ state }: { state: string }) {
  if (state === "mastered") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
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
