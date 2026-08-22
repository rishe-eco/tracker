import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, PenLine } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_VERIFICATION_MODULES, GET_VERIFICATION_PROGRESS, SET_VERIFICATION_RUNG } from "~/api/queries";
import RichText from "./RichText";
import VerificationRubricRail from "./VerificationRubricRail";
import SkillProbeBanner from "./SkillProbeBanner";

type VerificationModule = {
  moduleKey: string;
  title: string;
  concept: string;
  model: string;
  rung: "assisted" | "unassisted";
  state: string;
  masteredAt: string | null;
  nextReviewAt: string | null;
  promotionOffered: boolean;
};

type CriterionMean = { criterion: string; mean: number | null; count: number };

type VerificationProgress = {
  reviewStatus: string;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  totalAttempts: number;
  criterionMeans: CriterionMean[];
  strictComposite: number | null;
  ritualRate: number | null;
  discrimination: number | null;
  meanCostRatio: number | null;
  correctUnverifiedCount: number;
  falseUnverifiedCount: number;
  probeReady: boolean;
  probeBlockers: string[];
};

export default function VerificationLabPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [modules, setModules] = useState<VerificationModule[] | null>(null);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [m, p] = await Promise.all([
      call({ query: GET_VERIFICATION_MODULES }),
      call({ query: GET_VERIFICATION_PROGRESS }),
    ]);
    if (!m?.verificationModules || !p?.verificationProgress) {
      setFailed(true);
      return;
    }
    setModules(m.verificationModules);
    setProgress(p.verificationProgress);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const stepUp = async (moduleKey: string) => {
    setBusy(true);
    await call({ query: SET_VERIFICATION_RUNG, variables: { moduleKey, rung: "unassisted" } });
    setBusy(false);
    void load();
  };

  if (failed) {
    return (
      <InternalPageLayout title={t("verification.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("verification.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("skills.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!modules || !progress) return <LoadingBlock />;

  const introSteps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`verification.intro.step${n}Title`),
    body: t(`verification.intro.step${n}Body`),
  }));

  const started = progress.totalAttempts > 0;

  return (
    <InternalPageLayout title={t("verification.title")}>
      <ModuleIntroOverlay moduleKey="skills.verification" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("verification.subtitle")}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate("/tools/skills/verification/session")}>
            <PenLine className="mr-2 h-4 w-4" aria-hidden />
            {started ? t("verification.startSitting") : t("verification.startFirstSitting")}
          </Button>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">{t("verification.realWork.entryTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("verification.realWork.entryBody")}</p>
          <Button variant="outline" className="mt-3" onClick={() => navigate("/tools/skills/verification/real-work")}>
            {t("verification.realWork.entryButton")}
          </Button>
        </div>

        {progress.reviewStatus === "draft" && <Banner tone="info" text={t("skills.banners.draftLocale")} />}

        {!progress.probeReady ? (
          <Banner tone="warn" text={t("skills.banners.probeBlocked", { count: progress.probeBlockers.length })} />
        ) : (
          <SkillProbeBanner
            skillKey="verification"
            sessionRoute="/tools/skills/verification/session"
            hasBaseline={progress.hasBaseline}
            assessmentSkipped={progress.assessmentSkipped}
            onSkipped={() => void load()}
          />
        )}

        {started && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label={t("verification.metrics.strictComposite")}
              value={progress.strictComposite == null ? "—" : `${Math.round(progress.strictComposite * 100)}%`}
            />
            <Metric
              label={t("verification.metrics.ritualRate")}
              value={progress.ritualRate == null ? "—" : progress.ritualRate.toFixed(2)}
              hint={t("verification.metrics.ritualRateHint")}
            />
            <Metric
              label={t("verification.metrics.discrimination")}
              value={
                progress.discrimination == null
                  ? "—"
                  : `${progress.discrimination >= 0 ? "+" : ""}${progress.discrimination.toFixed(2)}`
              }
            />
            <Metric
              label={t("verification.metrics.costRatio")}
              value={progress.meanCostRatio == null ? "—" : `${progress.meanCostRatio.toFixed(1)}x`}
            />
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t("verification.modulesTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("verification.modulesSubtitle")}</p>
            </div>

            {modules.map((m) => (
              <div key={m.moduleKey} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button className="flex-1 text-start" onClick={() => setExpanded(expanded === m.moduleKey ? null : m.moduleKey)}>
                    <span className="flex items-center gap-2 font-medium">
                      <StateIcon state={m.state} />
                      {m.title}
                      <span
                        className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${
                          m.rung === "unassisted" ? "border-primary/50 text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {t(`verification.rung.${m.rung}`)}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t(`skills.state.${m.state}`)}</span>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/tools/skills/verification/session?module=${m.moduleKey}`)}>
                    {t("verification.practiceModule")}
                  </Button>
                </div>

                {m.promotionOffered && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-2.5">
                    <p className="text-xs">{t("verification.promotion.offer")}</p>
                    <Button size="sm" disabled={busy} onClick={() => void stepUp(m.moduleKey)}>
                      {t("verification.promotion.stepUp")}
                    </Button>
                  </div>
                )}

                {expanded === m.moduleKey && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("verification.conceptLabel")}
                      </p>
                      <RichText text={m.concept} className="text-sm leading-relaxed" />
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("verification.exampleLabel")}
                      </p>
                      <RichText text={m.model} className="text-sm leading-relaxed" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-semibold">{t("verification.rubricTitle")}</p>
              <p className="mb-3 text-[11px] leading-tight text-muted-foreground">{t("verification.rubricHint")}</p>
              <VerificationRubricRail />
            </div>
          </aside>
        </section>
      </div>
    </InternalPageLayout>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</p>}
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
