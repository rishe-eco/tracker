/**
 * The AI Training Lab hub's static table and its recommendation ladder.
 *
 * Kept out of the component so the ladder can be tested without rendering a
 * page, and out of the API because every string it produces is a locale key,
 * not copy — no lab title or one-liner crosses the wire (07-training-lab-hub.md
 * §6a).
 */

export type SkillKey = "evidence" | "clarity" | "decomposition" | "verification" | "delegation" | "monitoring";

export type SkillOverviewModule = { moduleKey: string; title: string };

export type SkillOverview = {
  skillKey: SkillKey;
  moduleCount: number;
  masteredCount: number;
  inProgressCount: number;
  totalAttempts: number;
  lastAttemptAt: string | null;
  hasBaseline: boolean;
  assessmentSkipped: boolean;
  probeReady: boolean;
  reviewStatus: string;
  dueModules: SkillOverviewModule[];
  dueProbe: "baseline" | "post" | "delayed" | null;
};

export type LabDescriptor = {
  skillKey: SkillKey;
  /** The lab page itself. Unchanged by the hub — it is a new parent, not a gate. */
  route: string;
  /** Where a module row or a review goes. Evidence's drill takes `mode` first. */
  sessionRoute: string;
  /**
   * The lab's other door, if it has one. Evidence has a free drill; the three
   * rubric labs have a real-work page; Monitoring has the self-audit; Clarity
   * has neither and shows nothing rather than an invented link.
   */
  secondary: { route: string; labelKey: string } | null;
};

/**
 * Canonical order, and the only place the hub knows about routes.
 *
 * Ties in the recommendation ladder break by this order, so the recommendation
 * cannot flicker between renders.
 */
export const LABS: LabDescriptor[] = [
  {
    skillKey: "evidence",
    route: "/tools/skills/evidence",
    sessionRoute: "/tools/skills/evidence/drill",
    secondary: { route: "/tools/skills/evidence/drill", labelKey: "drill" },
  },
  {
    skillKey: "clarity",
    route: "/tools/skills/clarity",
    sessionRoute: "/tools/skills/clarity/session",
    secondary: null,
  },
  {
    skillKey: "decomposition",
    route: "/tools/skills/decomposition",
    sessionRoute: "/tools/skills/decomposition/session",
    secondary: { route: "/tools/skills/decomposition/real-work", labelKey: "realWork" },
  },
  {
    skillKey: "verification",
    route: "/tools/skills/verification",
    sessionRoute: "/tools/skills/verification/session",
    secondary: { route: "/tools/skills/verification/real-work", labelKey: "realWork" },
  },
  {
    skillKey: "delegation",
    route: "/tools/skills/delegation",
    sessionRoute: "/tools/skills/delegation/session",
    secondary: { route: "/tools/skills/delegation/real-work", labelKey: "realWork" },
  },
  {
    skillKey: "monitoring",
    route: "/tools/skills/monitoring",
    sessionRoute: "/tools/skills/monitoring/session",
    secondary: { route: "/tools/skills/monitoring/self-audit", labelKey: "selfAudit" },
  },
];

export const LAB_BY_KEY: Record<SkillKey, LabDescriptor> = Object.fromEntries(
  LABS.map((l) => [l.skillKey, l])
) as Record<SkillKey, LabDescriptor>;

/** A module sitting's link, in the mode the module's own state calls for. */
export function moduleHref(skillKey: SkillKey, moduleKey: string, mode: "review" | "module"): string {
  const { sessionRoute } = LAB_BY_KEY[skillKey];
  return skillKey === "evidence"
    ? `${sessionRoute}?mode=${mode}&module=${moduleKey}`
    : `${sessionRoute}?module=${moduleKey}&mode=${mode}`;
}

export type Recommendation =
  | { kind: "probe"; skillKey: SkillKey; timepoint: "post" | "delayed"; href: string }
  | { kind: "review"; skillKey: SkillKey; moduleKey: string; moduleTitle: string; href: string }
  | { kind: "start"; skillKey: SkillKey; href: string }
  | { kind: "continue"; skillKey: SkillKey; href: string }
  | { kind: "allClear" };

/**
 * One card, one action, one reason. First match wins.
 *
 * The order is not arbitrary. A probe is the measurement, and `post`/`delayed`
 * are the only time-sensitive things in the engine — a delayed probe taken late
 * is a different measurement, not a late one. A review comes next because
 * spacing decays. Only then does anything about *new* work get a look in.
 *
 * Rule 1 requires `probeReady` as well as a due probe, because `dueSkillProbes`
 * does not check it: recommending a probe the lab page would then refuse to
 * start is worse than not recommending it (§5b).
 *
 * Rule 5 deliberately names **no lab**. The six report different headline
 * metrics on different scales, so "you are weakest at Verification" is not a
 * fact any arithmetic here could establish — the hub shows progress, which is a
 * count and is comparable, and never performance, which is not (§5a).
 */
export function recommendNext(overviews: SkillOverview[]): Recommendation {
  const ordered = LABS.map((l) => overviews.find((o) => o.skillKey === l.skillKey)).filter(
    (o): o is SkillOverview => o != null
  );

  const probe = ordered.find((o) => o.dueProbe != null && o.dueProbe !== "baseline" && o.probeReady);
  if (probe) {
    return {
      kind: "probe",
      skillKey: probe.skillKey,
      timepoint: probe.dueProbe as "post" | "delayed",
      href: LAB_BY_KEY[probe.skillKey].route,
    };
  }

  // Oldest first is not available here — the payload carries no review dates,
  // deliberately, since a date the hub could show is a date it would have to
  // localise. Canonical order stands in, and it is stable, which is the
  // property that matters for a recommendation.
  const review = ordered.find((o) => o.dueModules.length > 0);
  if (review) {
    const module = review.dueModules[0];
    return {
      kind: "review",
      skillKey: review.skillKey,
      moduleKey: module.moduleKey,
      moduleTitle: module.title,
      href: moduleHref(review.skillKey, module.moduleKey, "review"),
    };
  }

  const anyStarted = ordered.some((o) => o.totalAttempts > 0);
  if (!anyStarted) {
    return { kind: "start", skillKey: "evidence", href: LAB_BY_KEY.evidence.route };
  }

  const unfinished = ordered.filter((o) => o.masteredCount < o.moduleCount);
  if (unfinished.length > 0) {
    const touched = unfinished.filter((o) => o.lastAttemptAt != null);
    // Resuming beats choosing. Fall back to canonical order when the learner
    // has attempts somewhere but nothing outstanding has been touched yet.
    const next =
      touched.length > 0
        ? touched.reduce((best, o) => (o.lastAttemptAt! > best.lastAttemptAt! ? o : best))
        : unfinished[0];
    return { kind: "continue", skillKey: next.skillKey, href: LAB_BY_KEY[next.skillKey].route };
  }

  return { kind: "allClear" };
}

/** Everything due for review across all six, flattened for the "Due now" list. */
export function dueReviewRows(overviews: SkillOverview[]) {
  return LABS.flatMap((lab) => {
    const o = overviews.find((x) => x.skillKey === lab.skillKey);
    if (!o) return [];
    return o.dueModules.map((m) => ({
      skillKey: lab.skillKey,
      moduleKey: m.moduleKey,
      title: m.title,
      href: moduleHref(lab.skillKey, m.moduleKey, "review"),
    }));
  });
}

/** Due probes across all six, for the same list. Blocked packs are left out — see §5b. */
export function dueProbeRows(overviews: SkillOverview[]) {
  return LABS.flatMap((lab) => {
    const o = overviews.find((x) => x.skillKey === lab.skillKey);
    if (!o || o.dueProbe == null || o.dueProbe === "baseline" || !o.probeReady) return [];
    return [{ skillKey: lab.skillKey, timepoint: o.dueProbe, href: lab.route }];
  });
}
