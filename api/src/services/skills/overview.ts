/**
 * The AI Training Lab hub's data — every skill's progress in one payload.
 *
 * One query rather than twelve. `useApi` issues one POST per `call()` and does
 * not batch, so driving the hub from the per-lab queries would mean six
 * `<skill>Modules` plus six `<skill>Progress` plus `dueSkillProbes` — and it
 * would not work anyway, because `skillModules`/`skillProgress` are gated by
 * `assertEvidence` and reject the other five keys.
 *
 * **Progress only, never performance.** No metric service is called from here.
 * The six labs report different headline numbers on different scales — a strict
 * composite, a ritual rate, an over/under-reliance pair, a gamma that may not be
 * shown without task performance beside it — and there is no arithmetic that
 * makes them comparable. So the hub counts mastered modules, which is a count,
 * and shows nothing that would imply a ranking (07-training-lab-hub.md §5a).
 *
 * Spec: 06-specs/07-training-lab-hub.md §6.
 */

import type { PrismaClient } from "@prisma/client";
import type { Locale, SkillKey } from "../../content/skills/types";
import { getEvidencePack } from "../../content/skills";
import { CURRENT_VERSION } from "../../content/skills/versions";
import { buildClarityPack } from "../../content/skills/clarity/v1";
import { buildDecompositionPack } from "../../content/skills/decomposition/v1";
import { buildVerificationPack } from "../../content/skills/verification/v1";
import { buildDelegationPack } from "../../content/skills/delegation/v1";
import { buildMonitoringPack } from "../../content/skills/monitoring/v1";
import { MODULE_KEYS_BY_SKILL, probeReadinessFor, type ProbeTimepoint } from "./probes";
import { isDueReview } from "./scheduler";

/** Canonical order. Every response carries all six, in this order, always. */
export const SKILL_ORDER: SkillKey[] = [
  "evidence",
  "clarity",
  "decomposition",
  "verification",
  "delegation",
  "monitoring",
];

export type SkillOverviewModule = { moduleKey: string; title: string };

export type SkillOverview = {
  skillKey: SkillKey;
  moduleCount: number;
  masteredCount: number;
  inProgressCount: number;
  totalAttempts: number;
  lastAttemptAt: Date | null;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  probeReady: boolean;
  reviewStatus: string;
  dueModules: SkillOverviewModule[];
  dueProbe: ProbeTimepoint | null;
};

type PackSummary = { modules: SkillOverviewModule[]; reviewStatus: string };

/**
 * Module titles and review status for one skill.
 *
 * `contentVersion` matters only for Evidence, which is the one skill with more
 * than one shipped version. Everything else has exactly one, so its builder
 * takes a locale and nothing else.
 */
function packSummary(skillKey: SkillKey, locale: Locale, contentVersion: string | undefined): PackSummary {
  const pack =
    skillKey === "evidence"
      ? getEvidencePack(contentVersion ?? CURRENT_VERSION.evidence, locale)
      : skillKey === "clarity"
        ? buildClarityPack(locale)
        : skillKey === "decomposition"
          ? buildDecompositionPack(locale)
          : skillKey === "verification"
            ? buildVerificationPack(locale)
            : skillKey === "delegation"
              ? buildDelegationPack(locale)
              : buildMonitoringPack(locale);

  return {
    modules: pack.modules.map((m) => ({ moduleKey: m.moduleKey, title: m.title })),
    reviewStatus: pack.reviewStatus,
  };
}

/**
 * Every skill's state for this learner.
 *
 * Four reads for the whole page, none of them per-skill, plus the six content
 * packs — static modules held in memory, which `skillDueReviews` already loads
 * on every call today.
 *
 * **Profiles are read, never created.** Every `get<Skill>Modules` goes through
 * `ensureProfile`, which inserts a row on first contact; doing that here would
 * mean visiting the hub enrolled a learner in all six labs before they had
 * opened any of them. A missing profile is simply a learner who has not started
 * — no baseline, nothing skipped, and Evidence on the current content version.
 */
export async function getSkillsOverview(
  prisma: PrismaClient,
  userId: string,
  locale: Locale,
  now: Date = new Date()
): Promise<SkillOverview[]> {
  const [progressRows, attemptGroups, probeRows, profiles] = await Promise.all([
    prisma.skillModuleProgress.findMany({ where: { userId } }),
    prisma.skillAttempt.groupBy({
      by: ["skillKey"],
      where: { userId },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.skillProbe.findMany({ where: { userId } }),
    prisma.skillProfile.findMany({ where: { userId } }),
  ]);

  return SKILL_ORDER.map((skillKey) => {
    const profile = profiles.find((p) => p.skillKey === skillKey);
    const { modules, reviewStatus } = packSummary(skillKey, locale, profile?.contentVersion);

    const rows = progressRows.filter((p) => p.skillKey === skillKey);
    const byKey = new Map(rows.map((p) => [p.moduleKey, p]));

    // `due_review` outranks the stored state, exactly as the lab pages read it:
    // the row still says `mastered` while the review is outstanding.
    const dueModules = modules.filter((m) => isDueReview(byKey.get(m.moduleKey), now));
    const dueKeys = new Set(dueModules.map((m) => m.moduleKey));

    const masteredCount = modules.filter((m) => {
      const state = byKey.get(m.moduleKey)?.state;
      return !dueKeys.has(m.moduleKey) && (state === "mastered" || state === "tested_out");
    }).length;
    const inProgressCount = modules.filter((m) => {
      const state = byKey.get(m.moduleKey)?.state;
      return dueKeys.has(m.moduleKey) || state === "in_progress";
    }).length;

    const attempts = attemptGroups.find((g) => g.skillKey === skillKey);

    return {
      skillKey,
      moduleCount: modules.length,
      masteredCount,
      inProgressCount,
      totalAttempts: attempts?._count._all ?? 0,
      lastAttemptAt: attempts?._max.createdAt ?? null,
      hasBaseline: profile?.assessmentCompletedAt != null,
      assessmentSkipped: profile?.assessmentSkipped ?? false,
      probeReady: probeReadinessFor(skillKey).ready,
      reviewStatus,
      dueModules,
      dueProbe: dueProbeFor(skillKey, probeRows, rows, now),
    };
  });
}

/**
 * The probe this skill is waiting on, if any — the same rule `getDueSkillProbes`
 * applies, read off rows already in hand rather than re-queried per skill.
 *
 * Baseline is deliberately not a "due probe". It is offered by
 * `SkillProbeBanner` on the lab page and recommended by the hub's rule 3 for a
 * learner with nothing started; treating it as due for all six at once would
 * put six identical offers in front of someone on their first visit.
 */
function dueProbeFor(
  skillKey: SkillKey,
  probeRows: { skillKey: string; timepoint: string; completedAt: Date | null; scheduledFor: Date | null }[],
  progressRows: { moduleKey: string; state: string }[],
  now: Date
): ProbeTimepoint | null {
  const mine = probeRows.filter((p) => p.skillKey === skillKey);

  const delayed = mine.find((p) => p.timepoint === "delayed");
  if (delayed && !delayed.completedAt && delayed.scheduledFor && delayed.scheduledFor.getTime() <= now.getTime()) {
    return "delayed";
  }

  const post = mine.find((p) => p.timepoint === "post");
  if (!post?.completedAt) {
    const keys = MODULE_KEYS_BY_SKILL[skillKey];
    const allDone =
      progressRows.length > 0 &&
      keys.every((mk) => {
        const state = progressRows.find((p) => p.moduleKey === mk)?.state;
        return state === "mastered" || state === "tested_out";
      });
    if (allDone) return "post";
  }

  return null;
}
