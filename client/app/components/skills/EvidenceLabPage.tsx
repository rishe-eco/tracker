import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  MessageSquare,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_SKILL_MODULES, GET_SKILL_PROGRESS } from "~/api/queries";
import SkillPlanPanel from "./SkillPlanPanel";
import RichText from "./RichText";

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
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [m, p] = await Promise.all([
      call({ query: GET_SKILL_MODULES, variables: { skillKey: "evidence" } }),
      call({ query: GET_SKILL_PROGRESS, variables: { skillKey: "evidence" } }),
    ]);
    // A failed request used to leave state null and the page on a spinner
    // forever, which reads as "still working" rather than "broken" — the worst
    // possible failure display, because the only way out is a reload the learner
    // has no reason to try.
    if (!m?.skillModules || !p?.skillProgress) {
      setFailed(true);
      return;
    }
    setModules(m.skillModules);
    setProgress(p.skillProgress);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("skills.evidence.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("skills.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("skills.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!modules || !progress) return <LoadingBlock />;

  // Six steps, not three, and they start further back: what the tool is, why it
  // exists, what a session physically looks like, and only then the rules. The
  // first version opened on "check, don't judge", which is a rule for something
  // the reader hadn't been told about yet.
  //
  // The key is versioned. `ModuleIntroViewed` is unique per (user, moduleKey),
  // so reusing "skills.evidence" would leave anyone who dismissed the old intro
  // with no way to see the new one.
  const introSteps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`skills.intro.step${n}Title`),
    body: t(`skills.intro.step${n}Body`),
  }));

  const started = progress.totalAttempts > 0;

  return (
    <InternalPageLayout title={t("skills.evidence.title")}>
      <ModuleIntroOverlay moduleKey="skills.evidence.v2" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("skills.evidence.subtitle")}</p>

        <HowItWorks defaultOpen={!started} />

        {/* The way in comes before the caveats. What follows are notices about
            an optional baseline and about content review — true, worth saying,
            and not what someone opening the page is here for. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate("/tools/skills/evidence/drill")}>
            <Play className="mr-2 h-4 w-4" aria-hidden />
            {started ? t("skills.evidence.startDrill") : t("skills.evidence.startFirstDrill")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("skills.evidence.drillLength")}</span>
        </div>

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

        {/* Hidden until there is something to show. Eight zeroed statistics on a
            first visit are not a dashboard, they are eight questions the page
            hasn't answered yet — and they were the first thing a new reader
            met. */}
        {started && (
          <>
            {/* Composite and discrimination sit side by side, always. A learner
                who has merely become distrustful posts a strong composite and a
                discrimination near zero — showing the first without the second
                would call that progress. */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label={t("skills.metrics.strictComposite")}
                value={pct(progress.strictComposite)}
              />
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
              <Stat
                label={t("skills.metrics.falseAlarmRate")}
                value={pct(progress.falseAlarmRate)}
              />
              <Stat label={t("skills.metrics.calibration")} value={progress.meanBrier.toFixed(2)} />
              <Stat label={t("skills.metrics.attempts")} value={String(progress.totalAttempts)} />
            </section>
          </>
        )}

        <SkillPlanPanel enabled={progress.calendarPlanningEnabled} onChanged={() => void load()} />

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t("skills.evidence.modulesTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("skills.evidence.modulesSubtitle")}
            </p>
          </div>
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
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("skills.evidence.conceptLabel")}
                    </p>
                    <RichText text={m.concept} className="text-sm leading-relaxed" />
                  </div>
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("skills.evidence.exampleLabel")}
                    </p>
                    <RichText text={m.model} className="text-sm leading-relaxed" />
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

/**
 * The recoverable half of the orientation.
 *
 * The intro overlay is shown once per user and then gone for good, which makes
 * it the wrong home for anything a person might want again — and "what is this
 * and what happens when I press the button" is exactly that. So the overlay
 * frames the tool and this explains the mechanics, open on a first visit and
 * one click away afterwards.
 */
function HowItWorks({ defaultOpen }: { defaultOpen: boolean }) {
  const { t } = useTranslation();

  const steps = [
    { icon: MessageSquare, title: t("skills.how.readTitle"), body: t("skills.how.readBody") },
    { icon: Search, title: t("skills.how.checkTitle"), body: t("skills.how.checkBody") },
    { icon: ShieldCheck, title: t("skills.how.commitTitle"), body: t("skills.how.commitBody") },
    { icon: Sparkles, title: t("skills.how.revealTitle"), body: t("skills.how.revealBody") },
  ];

  return (
    <details open={defaultOpen} className="rounded-lg border bg-card">
      <summary className="cursor-pointer list-none p-4 text-sm font-semibold">
        {t("skills.how.title")}
      </summary>
      <div className="space-y-5 border-t p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("skills.how.premise")}</p>

        <ol className="space-y-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {i + 1}. {title}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3">
          <p className="text-sm font-medium">{t("skills.how.catchTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed">{t("skills.how.catchBody")}</p>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{t("skills.how.privacy")}</p>
      </div>
    </details>
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
