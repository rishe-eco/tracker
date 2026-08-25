import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, FlaskConical } from "lucide-react";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_SKILLS_OVERVIEW } from "~/api/queries";
import {
  LABS,
  dueProbeRows,
  dueReviewRows,
  recommendNext,
  type LabDescriptor,
  type Recommendation,
  type SkillOverview,
} from "./trainingLab";
import HowASittingWorks from "./HowASittingWorks";

/**
 * The AI Training Lab — one door in front of the six labs, and behind it one
 * recommendation.
 *
 * **Not a seventh lab.** Nothing here is scored, no attempt row is written, and
 * `SkillAttempt` gains no `hub` value. It is an index and a recommendation; the
 * lab pages keep their metrics, rubric rails, module lists and probe banners,
 * and every one of them stays reachable directly.
 *
 * **State is decoration; navigation is the job.** If the overview query fails,
 * all six cards still render — without counts, without a ribbon — plus one
 * retry. A hub that answered a failed request with a full-page error and no
 * links would have failed at the only thing it exists for.
 *
 * Spec: 06-specs/07-training-lab-hub.md.
 */
export default function TrainingLabHubPage() {
  const { t, i18n } = useTranslation();
  const { call } = useApi();

  const [overview, setOverview] = useState<SkillOverview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await call({ query: GET_SKILLS_OVERVIEW });
    setLoading(false);
    if (!res?.skillsOverview) {
      setFailed(true);
      return;
    }
    setOverview(res.skillsOverview);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview && !failed) return <LoadingBlock />;

  const byKey = new Map((overview ?? []).map((o) => [o.skillKey, o]));
  const startedCount = (overview ?? []).filter((o) => o.totalAttempts > 0).length;
  const anyStarted = startedCount > 0;
  const recommendation = overview ? recommendNext(overview) : null;
  const reviews = overview ? dueReviewRows(overview) : [];
  const probes = overview ? dueProbeRows(overview) : [];

  return (
    <InternalPageLayout title={t("skills.hub.title")}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-muted-foreground">{t("skills.hub.subtitle")}</p>
          {overview && (
            <p className="text-sm font-medium">
              {t("skills.hub.startedCount", { count: startedCount, total: LABS.length })}
            </p>
          )}
        </div>

        {failed && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">{t("skills.hub.errors.couldNotLoad")}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t("skills.errors.retry")}
            </Button>
          </div>
        )}

        {recommendation && <NextStep recommendation={recommendation} />}

        <HowASittingWorks ns="skills.hub.how" steps={["predict", "do", "compare", "review"]} catchKey="catch" defaultOpen={!anyStarted} />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LABS.map((lab) => (
            <LabCard
              key={lab.skillKey}
              lab={lab}
              overview={byKey.get(lab.skillKey) ?? null}
              recommended={recommendation != null && "skillKey" in recommendation && recommendation.skillKey === lab.skillKey}
            />
          ))}
        </section>

        {/* Absent, not empty. A permanent "Due now" heading reading "nothing"
            is a worse artifact than no heading at all. */}
        {(reviews.length > 0 || probes.length > 0) && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t("skills.hub.dueTitle")}</h2>
            <div className="divide-y rounded-lg border bg-card">
              {probes.map((p) => (
                <DueRow
                  key={`probe-${p.skillKey}`}
                  href={p.href}
                  label={t(`skills.hub.dueProbe.${p.timepoint}`)}
                  lab={t(`skills.hub.labs.${p.skillKey}.title`)}
                  rtl={i18n.dir() === "rtl"}
                />
              ))}
              {reviews.map((r) => (
                <DueRow
                  key={`review-${r.skillKey}-${r.moduleKey}`}
                  href={r.href}
                  label={r.title}
                  lab={t(`skills.hub.labs.${r.skillKey}.title`)}
                  rtl={i18n.dir() === "rtl"}
                />
              ))}
            </div>
          </section>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">{t("skills.hub.orderNote")}</p>
      </div>
    </InternalPageLayout>
  );
}

/**
 * The one recommended action, with its reason attached.
 *
 * `allClear` names no lab — see `recommendNext`. Every other kind is a link,
 * never a button, so ⌘-click and "open in new tab" work.
 */
function NextStep({ recommendation }: { recommendation: Recommendation }) {
  const { t } = useTranslation();

  if (recommendation.kind === "allClear") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm">{t("skills.hub.next.allClear")}</p>
      </div>
    );
  }

  const labName = t(`skills.hub.labs.${recommendation.skillKey}.title`);
  const action =
    recommendation.kind === "probe"
      ? t(`skills.hub.next.probe.${recommendation.timepoint}Action`, { lab: labName })
      : recommendation.kind === "review"
        ? t("skills.hub.next.reviewAction", { module: recommendation.moduleTitle, lab: labName })
        : t(`skills.hub.next.${recommendation.kind}Action`, { lab: labName });
  const reason =
    recommendation.kind === "probe"
      ? t(`skills.hub.next.probe.${recommendation.timepoint}Reason`)
      : t(`skills.hub.next.${recommendation.kind}Reason`);

  return (
    <div className="rounded-lg border border-primary/50 bg-primary/[0.06] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{t("skills.hub.nextStepLabel")}</p>
      <p className="mt-1 text-sm font-medium">{action}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{reason}</p>
      <Button asChild className="mt-3">
        <Link to={recommendation.href}>{t("skills.hub.next.go")}</Link>
      </Button>
    </div>
  );
}

/**
 * One lab.
 *
 * A `<Link>` wrapping the whole card, not a `<Button onClick={navigate}>` — the
 * shape the Tools page used, which silently swallowed middle-click, ⌘-click and
 * "open in new tab". The secondary entrance is a sibling link rather than a
 * nested one, because a link inside a link is not valid HTML.
 *
 * All six are always enabled. There is no locking and no "finish Evidence
 * first": the engine's position is that each lab stands on its own, and a hub
 * that quietly contradicted its own copy would be worse than the six buttons it
 * replaced.
 */
function LabCard({ lab, overview, recommended }: { lab: LabDescriptor; overview: SkillOverview | null; recommended: boolean }) {
  const { t, i18n } = useTranslation();
  const Chevron = i18n.dir() === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${recommended ? "border-primary/50 bg-primary/[0.06]" : "bg-card"}`}
    >
      <Link to={lab.route} className="group flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium group-hover:underline">{t(`skills.hub.labs.${lab.skillKey}.title`)}</span>
          {recommended && (
            <span className="shrink-0 rounded-full border border-primary/50 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {t("skills.hub.recommendedRibbon")}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(`skills.hub.labs.${lab.skillKey}.trains`)}</p>

        {overview && (
          <div className="mt-auto space-y-1 pt-2">
            <Pips mastered={overview.masteredCount} inProgress={overview.inProgressCount} total={overview.moduleCount} />
            <p className="text-xs text-muted-foreground">
              {t("skills.hub.moduleCount", { count: overview.masteredCount, total: overview.moduleCount })}
              {overview.inProgressCount > 0 && <> · {t("skills.hub.inProgressCount", { count: overview.inProgressCount })}</>}
            </p>
            {overview.dueModules.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-amber-600">
                <Clock className="h-3 w-3" aria-hidden />
                {t("skills.hub.reviewsDue", { count: overview.dueModules.length })}
              </p>
            )}
            {/* Per card, not six banners stacked at the top of the page. */}
            {overview.reviewStatus === "draft" && (
              <p className="text-[11px] text-muted-foreground">{t("skills.hub.draftLocale")}</p>
            )}
          </div>
        )}
      </Link>

      {lab.secondary && (
        <Link
          to={lab.secondary.route}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t(`skills.hub.secondary.${lab.secondary.labelKey}`)}
          <Chevron className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/**
 * Progress, never performance — counts of modules, and nothing that could be
 * read as a score. The in-progress pips matter: without them a lab with five
 * modules underway looks exactly like one nobody has opened.
 *
 * `aria-hidden`, because the line underneath says the same thing in words.
 */
function Pips({ mastered, inProgress, total }: { mastered: number; inProgress: number; total: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < mastered ? "bg-primary" : i < mastered + inProgress ? "bg-primary/40" : "bg-muted-foreground/25"
          }`}
        />
      ))}
    </span>
  );
}

function DueRow({ href, label, lab, rtl }: { href: string; label: string; lab: string; rtl: boolean }) {
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  return (
    <Link to={href} className="flex items-center gap-3 p-3 text-sm hover:bg-muted/50">
      <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1">
        <span className="font-medium">{label}</span>
        <span className="ms-2 text-xs text-muted-foreground">{lab}</span>
      </span>
      <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
