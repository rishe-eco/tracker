/**
 * Delegation rubric v1 — the reliance rubric.
 *
 * Analytic, six criteria, 0-2 each, 0-12 total — same shape as the other
 * four tools' rubrics (engine §7). Transcribed from `05-delegation-lab.md`
 * §4's table. Every level is a threshold on a continuous computed measure or
 * a decision rule against the authored key; none needs a rater — unusual for
 * this engine only in that most levels are thresholds rather than observable
 * features, because the underlying quantity (WOA) genuinely is continuous.
 *
 * ⚠️ Changing any level descriptor, or any threshold constant in `metrics.ts`,
 * is a `rubricVersion` bump.
 */

import type { DelegationCriterionId, DelegationModuleKey, DelegationRubricCriterion, RubricLevel } from "../types";

export const RUBRIC_VERSION = "delegation-rubric/v1";

export const MAX_LEVEL: RubricLevel = 2;
export const RUBRIC_MAX_TOTAL = 12;

export const RUBRIC: DelegationRubricCriterion[] = [
  {
    id: "G1",
    moduleKey: "g1-own",
    scoredBy: "computed",
    labelKey: "skills.delegation.rubric.G1",
    levels: {
      0: "Stated confidence is anti-correlated with own accuracy across the window.",
      1: "Weakly related.",
      2: "Confidence tracks own accuracy — item-level Brier below the module threshold.",
    },
  },
  {
    id: "G2",
    moduleKey: "g2-instance",
    scoredBy: "key",
    labelKey: "skills.delegation.rubric.G2",
    levels: {
      0: "The cue cited is a category claim about AI in general, or no cue where one exists.",
      1: "An instance-level cue that does not bear on relative competence.",
      2: "An instance-level cue that bears on relative competence — or, on an uncued item, correctly reporting that there is none.",
    },
  },
  {
    id: "G3",
    moduleKey: "g3-weigh",
    scoredBy: "computed",
    labelKey: "skills.delegation.rubric.G3",
    levels: {
      0: "|WOA − benchmark| > 0.4.",
      1: "0.2–0.4.",
      2: "≤ 0.2, where benchmark is 0.5 on uncued items and the cue-adjusted value otherwise.",
    },
  },
  {
    id: "G4",
    moduleKey: "g4-split",
    scoredBy: "key",
    labelKey: "skills.delegation.rubric.G4",
    levels: {
      0: "Delegates or keeps the whole task where the key marks it separable.",
      1: "Splits, but hands over the piece they could have judged and keeps the one they could not.",
      2: "Hands over the piece the key marks delegable and keeps the piece whose correctness only they can assess.",
    },
  },
  {
    id: "G5",
    moduleKey: "g5-stakes",
    scoredBy: "key+computed",
    labelKey: "skills.delegation.rubric.G5",
    levels: {
      0: "The two framings treated identically — no change across the pair.",
      1: "Changed, but in a direction the key marks indefensible (relying more under high stakes with nothing to make it recoverable), or below the pair's magnitude threshold.",
      2: "Either defensible response: reliance reduced by at least the pair's threshold, or reliance maintained with a recoverability move recorded.",
    },
  },
  {
    id: "G6",
    moduleKey: "g6-drift",
    scoredBy: "computed",
    labelKey: "skills.delegation.rubric.G6",
    levels: {
      0: "Round-3 weighting collapses to ~0 after the single advisor error, or rises to ~1 after a single success.",
      1: "Overshoots — adjusts further than one data point against several warrants.",
      2: "Round-3 weighting adjusts in the right direction by no more than the evidence warrants, and remains non-zero.",
    },
  },
];

export const CRITERION_BY_ID = new Map(RUBRIC.map((c) => [c.id, c]));

/** Module → the criterion it trains. Used only for the module's own concept/model framing — mastery (spec §7) is a whole-window rule across four clauses, not a per-criterion one. */
export const RUBRIC_CRITERIA_BY_MODULE = Object.fromEntries(
  RUBRIC.map((c) => [c.moduleKey, c.id])
) as Record<DelegationModuleKey, DelegationCriterionId>;
