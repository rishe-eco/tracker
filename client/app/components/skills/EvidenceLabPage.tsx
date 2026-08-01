import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, Play } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_SKILL_MODULES, GET_SKILL_PROGRESS } from "~/api/queries";
import SkillPlanPanel from "./SkillPlanPanel";

type SkillModule = {
  moduleKey: string;
  title: string;
  concept: string;
  model: string;
  state: string;
  currentStep: number;
  masteredAt: string | null;
  nextReviewAt: string | null;
};

type SkillProgress = {
  contentVersion: string;
  locale: string;
  reviewStatus: string;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  probeReady: boolean;
  probeBlockers: string[];
  calendarPlanningEnabled: boolean;
  totalAttempts: number;
  strictComposite: number;
  hitRate: number;
  falseAlarmRate: number;
  discrimination: number;
  meanBrier: number;
  medianTimeToFirstCheckMs: number | null;
  overTrustRate: number;
  accuracyRate: number;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function EvidenceLabPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [modules, setModules] = useState<SkillModule[] | null>(null);
  const [progress, setProgress] = useState<SkillProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      call({ query: GET_SKILL_MODULES, variables: { skillKey: "evidence" } }),
      call({ query: GET_SKILL_PROGRESS, variables: { skillKey: "evidence" } }),
    ]);
    if (m?.skillModules) setModules(m.skillModules);
    if (p?.skillProgress) setProgress(p.skillProgress);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!modules || !progress) return <LoadingBlock />;

  const introSteps = [
    { title: t("skills.intro.step1Title"), body: t("skills.intro.step1Body") },
    { title: t("skills.intro.step2Title"), body: t("skills.intro.step2Body") },
    { title: t("skills.intro.step3Title"), body: t("skills.intro.step3Body") },
  ];

  return (
    <InternalPageLayout title={t("skills.evidence.title")}>
      <ModuleIntroOverlay moduleKey="skills.evidence" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("skills.evidence.subtitle")}</p>

        {progress.reviewStatus === "draft" && (
          <Banner tone="info" text={t("skills.banners.draftLocale")} />
        )}

        {!progress.probeReady && (
          <Banner
            tone="warn"
            text={t("skills.banners.probeBlocked", { count: progress.probeBlockers.length })}
          />
        )}

        {!progress.hasBaseline && (
          <Banner
            tone="info"
            text={
              progress.assessmentSkipped
                ? t("skills.banners.baselineSkipped")
                : t("skills.banners.noBaseline")
            }
          />
        )}

        {/* Composite and discrimination sit side by side, always. A learner who
            has merely become distrustful posts a strong composite and a
            discrimination near zero — showing the first without the second
            would call that progress. */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("skills.metrics.strictComposite")} value={pct(progress.strictComposite)} />
          <Stat
            label={t("skills.metrics.discrimination")}
            value={pct(progress.discrimination)}
            hint={t("skills.metrics.discriminationHint")}
          />
          <Stat
            label={t("skills.metrics.reflexSpeed")}
            value={
              progress.medianTimeToFirstCheckMs == null
                ? "—"
                : `${Math.round(progress.medianTimeToFirstCheckMs / 1000)}s`
            }
          />
          <Stat label={t("skills.metrics.overTrust")} value={pct(progress.overTrustRate)} />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("skills.metrics.hitRate")} value={pct(progress.hitRate)} />
          <Stat label={t("skills.metrics.falseAlarmRate")} value={pct(progress.falseAlarmRate)} />
          <Stat label={t("skills.metrics.calibration")} value={progress.meanBrier.toFixed(2)} />
          <Stat label={t("skills.metrics.attempts")} value={String(progress.totalAttempts)} />
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/tools/skills/evidence/drill")}>
            <Play className="mr-2 h-4 w-4" aria-hidden />
            {t("skills.evidence.startDrill")}
          </Button>
        </div>

        <SkillPlanPanel enabled={progress.calendarPlanningEnabled} onChanged={() => void load()} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("skills.evidence.modulesTitle")}</h2>
          {modules.map((m) => (
            <div key={m.moduleKey} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  className="flex-1 text-start"
                  onClick={() => setExpanded(expanded === m.moduleKey ? null : m.moduleKey)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <StateIcon state={m.state} />
                    {m.title}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t(`skills.state.${m.state}`)}
                    {m.nextReviewAt &&
                      ` · ${t("skills.evidence.dueOn", {
                        date: new Date(m.nextReviewAt).toLocaleDateString(),
                      })}`}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(`/tools/skills/evidence/drill?mode=module&module=${m.moduleKey}`)
                  }
                >
                  {t("skills.evidence.practiceModule")}
                </Button>
              </div>

              {expanded === m.moduleKey && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.concept}</div>
                  <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
                    {m.model}
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </InternalPageLayout>
  );
}

function StateIcon({ state }: { state: string }) {
  if (state === "mastered" || state === "tested_out")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (state === "due_review") return <Clock className="h-4 w-4 text-amber-600" aria-hidden />;
  return <CircleDot className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Banner({ tone, text }: { tone: "info" | "warn"; text: string }) {
  const styles =
    tone === "warn"
      ? "border-amber-500/40 bg-amber-500/10"
      : "border-sky-500/40 bg-sky-500/10";
  return (
    <div className={`flex gap-2 rounded-md border p-3 text-sm ${styles}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
