import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, PenLine } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_CLARITY_MODULES, GET_CLARITY_PROGRESS } from "~/api/queries";
import RichText from "./RichText";
import RubricRail, { CRITERIA } from "./RubricRail";

type ClarityModule = {
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

type ClarityProgress = {
  rubricVersion: string;
  locale: string;
  reviewStatus: string;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  readerAvailable: boolean;
  anyCriterionCalibrated: boolean;
  detectorCriteria: string[];
  totalAttempts: number;
  criterionMeans: CriterionMean[];
  revisionDeltas: number[];
  meanDelta: number | null;
};

export default function ClarityLabPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [modules, setModules] = useState<ClarityModule[] | null>(null);
  const [progress, setProgress] = useState<ClarityProgress | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const [m, p] = await Promise.all([
      call({ query: GET_CLARITY_MODULES }),
      call({ query: GET_CLARITY_PROGRESS }),
    ]);
    if (!m?.clarityModules || !p?.clarityProgress) {
      setFailed(true);
      return;
    }
    setModules(m.clarityModules);
    setProgress(p.clarityProgress);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("clarity.title")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("clarity.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("skills.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!modules || !progress) return <LoadingBlock />;

  const introSteps = [1, 2, 3, 4, 5, 6].map((n) => ({
    title: t(`clarity.intro.step${n}Title`),
    body: t(`clarity.intro.step${n}Body`),
  }));

  const started = progress.totalAttempts > 0;

  return (
    <InternalPageLayout title={t("clarity.title")}>
      <ModuleIntroOverlay moduleKey="skills.clarity" steps={introSteps} />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{t("clarity.subtitle")}</p>

        <HowASittingWorks defaultOpen={!started} />

        {/* The way in comes before the caveats. Everything below is a notice
            about what this installation cannot score — honest, and the wrong
            first thing to meet on a page whose main path works. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate("/tools/skills/clarity/session")}>
            <PenLine className="mr-2 h-4 w-4" aria-hidden />
            {started ? t("clarity.startSitting") : t("clarity.startFirstSitting")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("clarity.sittingLength")}</span>
        </div>

        {progress.reviewStatus === "draft" && (
          <Banner tone="info" text={t("skills.banners.draftLocale")} />
        )}

        {/* The honest state, stated rather than worked around. Without a reader
            three of six criteria go unscored and elicitation items are withheld
            — that is a real limit on what the tool can tell you, so it is on the
            page rather than buried in a tooltip. */}
        {!progress.readerAvailable && (
          <Banner
            tone="warn"
            text={t("clarity.banners.noReader", unscoredCriteriaCopy(t, progress.detectorCriteria))}
          />
        )}
        {progress.readerAvailable && !progress.anyCriterionCalibrated && (
          <Banner tone="info" text={t("clarity.banners.uncalibrated")} />
        )}

        {!progress.hasBaseline && (
          <Banner
            tone="info"
            text={
              progress.assessmentSkipped
                ? t("skills.banners.baselineSkipped")
                : t("clarity.banners.noBaseline")
            }
          />
        )}

        {started && (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {t("clarity.metrics.perCriterion")}
              </p>
              <p className="mb-3 mt-0.5 text-[11px] leading-tight text-muted-foreground">
                {t("clarity.metrics.perCriterionHint")}
              </p>
              <ul className="space-y-1.5">
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
                      {c.count === 0 ? t("clarity.unscored") : `${c.mean?.toFixed(2)} / 2`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {t("clarity.metrics.revisionDelta")}
              </p>
              {/* Says out loud that down is good. Every instinct reads a
                  shrinking number as regression, and here it means the draft
                  arrived closer to where the revision would have ended up. */}
              <p className="mb-3 mt-0.5 text-[11px] leading-tight text-muted-foreground">
                {t("clarity.metrics.revisionDeltaHint")}
              </p>
              {progress.revisionDeltas.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("clarity.metrics.noRevisionsYet")}</p>
              ) : (
                <>
                  <div className="flex h-16 items-end gap-1.5">
                    {progress.revisionDeltas.slice(-10).map((d, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-t-sm bg-primary/25"
                        style={{ height: `${Math.max(6, Math.min(100, (d / 6) * 100))}%` }}
                        title={`+${d}`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {progress.meanDelta == null ? "—" : `+${progress.meanDelta.toFixed(1)}`}
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t("clarity.modulesTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("clarity.modulesSubtitle")}</p>
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
                      <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {m.criterion}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(`skills.state.${m.state}`)}
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/tools/skills/clarity/session?module=${m.moduleKey}`)
                    }
                  >
                    {t("clarity.practiceModule")}
                  </Button>
                </div>

                {expanded === m.moduleKey && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("clarity.conceptLabel")}
                      </p>
                      <RichText text={m.concept} className="text-sm leading-relaxed" />
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("clarity.exampleLabel")}
                      </p>
                      <RichText text={m.model} className="text-sm leading-relaxed" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Always on screen — the rubric is the teaching object, not a hidden
              grading scheme. */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-semibold">{t("clarity.rubricTitle")}</p>
              <p className="mb-3 text-[11px] leading-tight text-muted-foreground">
                {t("clarity.rubricHint")}
              </p>
              <RubricRail
                detectorCriteria={progress.detectorCriteria}
                readerAvailable={progress.readerAvailable}
              />
            </div>
          </aside>
        </section>
      </div>
    </InternalPageLayout>
  );
}

/**
 * Session mechanics, re-openable. The intro overlay is shown once and gone; a
 * learner returning for their second sitting wants this, not that.
 */
function HowASittingWorks({ defaultOpen }: { defaultOpen: boolean }) {
  const { t } = useTranslation();
  const steps = ["read", "write", "diagnose", "score", "revise"];

  return (
    <details open={defaultOpen} className="rounded-lg border bg-card">
      <summary className="cursor-pointer list-none p-4 text-sm font-semibold">
        {t("clarity.how.title")}
      </summary>
      <div className="space-y-4 border-t p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("clarity.how.premise")}</p>
        <ol className="space-y-2">
          {steps.map((key, i) => (
            <li key={key} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px]">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">
                <span className="font-medium">{t(`clarity.how.${key}Title`)}</span>{" "}
                <span className="text-muted-foreground">{t(`clarity.how.${key}Body`)}</span>
              </p>
            </li>
          ))}
        </ol>
        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3">
          <p className="text-sm font-medium">{t("clarity.how.lockTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed">{t("clarity.how.lockBody")}</p>
        </div>
      </div>
    </details>
  );
}

/**
 * Which criteria this install cannot score, named rather than assumed.
 *
 * The copy used to say "three of the six criteria — deliverable, context and
 * success criteria". Both halves were locale-specific and neither was derived:
 * Persian has no working detectors at all, so five rows read as unscored while
 * the sentence named three, and the two it left out were unscored too.
 */
function unscoredCriteriaCopy(
  t: (k: string, o?: any) => string,
  detectorCriteria: string[]
): { count: number; criteria: string } {
  const unscored = CRITERIA.filter((c) => !detectorCriteria.includes(c));
  const labels = unscored.map((c) => t(`clarity.rubric.${c}.label`));
  return { count: unscored.length, criteria: joinList(labels, t) };
}

/** Intl handles the "a, b and c" shape per language; the fallback is for old runtimes. */
function joinList(items: string[], t: (k: string, o?: any) => string): string {
  const locale = t("clarity.listLocale", { defaultValue: "en" });
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(t("clarity.listSeparator", { defaultValue: ", " }));
  }
}

function StateIcon({ state }: { state: string }) {
  if (state === "mastered" || state === "tested_out")
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (state === "due_review") return <Clock className="h-4 w-4 text-amber-600" aria-hidden />;
  return <CircleDot className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function Banner({ tone, text }: { tone: "info" | "warn"; text: string }) {
  const styles =
    tone === "warn" ? "border-amber-500/40 bg-amber-500/10" : "border-sky-500/40 bg-sky-500/10";
  return (
    <div className={`flex gap-2 rounded-md border p-3 text-sm ${styles}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{text}</p>
    </div>
  );
}
