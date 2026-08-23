/**
 * Monitoring rubric v1 — the self-monitoring rubric.
 *
 * Analytic, six criteria, 0-2 each, 0-12 total — same shape as the other
 * five tools' rubrics (engine §7). Transcribed from `06-monitoring-lab.md`
 * §4's table. No criterion needs a rater: five are keyed or instrumented,
 * S1 and S3 are computed from predictions against outcomes (06's §4, §12 —
 * no model anywhere in the scored path).
 *
 * ⚠️ Changing any level descriptor, or any threshold constant in
 * `services/skills/monitoring/{gamma,metrics}.ts`, is a `rubricVersion` bump.
 */

import type { MonitoringCriterionId, MonitoringModuleKey, MonitoringRubricCriterion, RubricLevel } from "../types";

export const RUBRIC_VERSION = "monitoring-rubric/v1";

export const MAX_LEVEL: RubricLevel = 2;
export const RUBRIC_MAX_TOTAL = 12;

export const RUBRIC: MonitoringRubricCriterion[] = [
  {
    id: "S1",
    moduleKey: "s1-access",
    scoredBy: "computed",
    labelKey: "skills.monitoring.rubric.S1",
    levels: {
      0: "Predicted unassisted performance exceeds actual by more than the module threshold.",
      1: "Overestimates within threshold.",
      2: "Predicted unassisted performance tracks actual, and the learner's post-AI self-rating does not exceed their unassisted-item self-rating on the matched pair.",
    },
  },
  {
    id: "S2",
    moduleKey: "s2-explain",
    scoredBy: "key",
    labelKey: "skills.monitoring.rubric.S2",
    levels: {
      0: "Explanation omits the causal step the key marks as load-bearing, and the re-rating does not move.",
      1: "Explanation is partial; re-rating moves.",
      2: "The explanation reaches the key's causal steps, or the learner correctly identifies which step they cannot supply.",
    },
  },
  {
    id: "S3",
    moduleKey: "s3-resolution",
    scoredBy: "computed",
    labelKey: "skills.monitoring.rubric.S3",
    levels: {
      0: "Per-item predictions are uncorrelated or inversely correlated with correctness.",
      1: "Weak positive relationship.",
      2: "Predictions discriminate own correct from own incorrect answers above the module threshold, at any level of task performance.",
    },
  },
  {
    id: "S4",
    moduleKey: "s4-agreement",
    scoredBy: "key",
    labelKey: "skills.monitoring.rubric.S4",
    levels: {
      0: "Treats the assistant's agreement as support for the position.",
      1: "Notices the agreement but still weights it.",
      2: "Identifies the agreement as carrying no information, and names what would carry some.",
    },
  },
  {
    id: "S5",
    moduleKey: "s5-anchor",
    scoredBy: "key",
    labelKey: "skills.monitoring.rubric.S5",
    levels: {
      0: "Misses every planted influence, or reports influences in a clean transcript.",
      1: "Finds some; one false alarm.",
      2: "Finds the planted influences the key lists, with no false alarm on a clean transcript, and names what they moved.",
    },
  },
  {
    id: "S6",
    moduleKey: "s6-complacency",
    scoredBy: "key",
    labelKey: "skills.monitoring.rubric.S6",
    levels: {
      0: 'Proposes effort ("read more carefully") or nothing.',
      1: "Proposes a check that still depends on noticing in the moment.",
      2: "Proposes a check that fires independent of attention — a fixed point in the workflow, not a resolution.",
    },
  },
];

export const CRITERION_BY_ID = new Map(RUBRIC.map((c) => [c.id, c]));

/** Module -> the criterion it trains. Used only for the module's own concept/model framing. */
export const RUBRIC_CRITERIA_BY_MODULE = Object.fromEntries(RUBRIC.map((c) => [c.moduleKey, c.id])) as Record<
  MonitoringModuleKey,
  MonitoringCriterionId
>;
