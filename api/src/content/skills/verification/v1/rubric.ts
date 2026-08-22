/**
 * Verification rubric v1 — the oracle-and-verdict probe rubric.
 *
 * Analytic, six criteria, 0-2 each, 0-12 total — same shape as the other
 * three tools' rubrics for the same reason (engine §7). Transcribed from
 * `04-verification-lab.md` §4's table. Every level is a decision rule
 * against the authored key or an instrumented event; none needs a rater.
 *
 * ⚠️ Changing any level descriptor is a `rubricVersion` bump.
 */

import type { VerificationCriterionId, VerificationModuleKey, VerificationRubricCriterion, RubricLevel } from "../types";

export const RUBRIC_VERSION = "verification-rubric/v1";

export const MAX_LEVEL: RubricLevel = 2;
export const RUBRIC_MAX_TOTAL = 12;

export const RUBRIC: VerificationRubricCriterion[] = [
  {
    id: "V1",
    moduleKey: "v1-oracle",
    scoredBy: "instrumentation",
    labelKey: "skills.verification.rubric.V1",
    levels: {
      0: "No oracle named, or the verdict is reached with no stated basis.",
      1: "An oracle named, but it does not bear on the claim actually made.",
      2: "An oracle named before the check is run, which bears on the specific claim, and whose kind (partial / metamorphic / full) is identifiable.",
    },
  },
  {
    id: "V2",
    moduleKey: "v2-independent",
    scoredBy: "key",
    labelKey: "skills.verification.rubric.V2",
    levels: {
      0: "The only check used derives from the artifact's own source — self-critique, stated confidence, or a re-ask of the same model.",
      1: "One independent check, but weighted equally with a non-independent one.",
      2: "Every check used is independent of the artifact's source; where independence is unobtainable the learner says so rather than substituting a dependent check.",
    },
  },
  {
    id: "V3",
    moduleKey: "v3-falsify",
    scoredBy: "key",
    labelKey: "skills.verification.rubric.V3",
    levels: {
      0: "The check would have returned the same result whether or not the artifact was correct.",
      1: "The check discriminates only for part of the claim.",
      2: "The check would have failed had the artifact been wrong — the item's key lists which candidate checks discriminate.",
    },
  },
  {
    id: "V4",
    moduleKey: "v4-cheapest",
    scoredBy: "key+instrumentation",
    labelKey: "skills.verification.rubric.V4",
    levels: {
      0: "Cost exceeds the key's cheapest sufficient oracle by more than 3x, or the learner runs a check on an item the key marks as not worth checking.",
      1: "Between 1x and 3x the cheapest sufficient oracle.",
      2: "At or near the cheapest sufficient oracle, with no unnecessary checks run.",
    },
  },
  {
    id: "V5",
    moduleKey: "v5-locate",
    scoredBy: "key",
    labelKey: "skills.verification.rubric.V5",
    levels: {
      0: "No location of the fault.",
      1: "Right general verdict, wrong element identified.",
      2: "The specific element that fails is named — figure, unit, step, assumption, or citation.",
    },
  },
  {
    id: "V6",
    moduleKey: "v6-unverifiable",
    scoredBy: "key+instrumentation",
    labelKey: "skills.verification.rubric.V6",
    levels: {
      0: "An unverifiable artifact is reported as verified, or a verifiable one is abandoned as unverifiable.",
      1: "Correct closure but with no statement of residual risk.",
      2: "Verdict matches the key, including 'unverified' where that is the key's answer, with what remains unchecked stated.",
    },
  },
];

export const CRITERION_BY_ID = new Map(RUBRIC.map((c) => [c.id, c]));

/** Module → the criterion it trains. Used only for the module's own concept/model framing, not for mastery — mastery (spec §7) is a whole-attempt rule, not a per-criterion one. */
export const RUBRIC_CRITERIA_BY_MODULE = Object.fromEntries(
  RUBRIC.map((c) => [c.moduleKey, c.id])
) as Record<VerificationModuleKey, VerificationCriterionId>;
