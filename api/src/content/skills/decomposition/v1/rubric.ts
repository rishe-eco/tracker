/**
 * Decomposition rubric v1 — the keyed-structure decomposition rubric.
 *
 * Analytic, six criteria, 0–12, same shape as Clarity's rubric v1 for the same
 * reason: six is the top of the band where inter-rater agreement holds up
 * (engine §7). Every level is a decision rule about an observable feature of
 * the structure or of the order it was built in — most of them need no rater
 * at all, which is the property this tool is built to protect (§1 of the
 * spec: "nobody has published a validated decomposition rubric").
 *
 * ⚠️ Changing any level descriptor is a `rubricVersion` bump.
 */

import type {
  DecompositionCriterionId,
  DecompositionModuleKey,
  DecompositionRubricCriterion,
  RubricLevel,
} from "../types";

export const RUBRIC_VERSION = "decomposition-rubric/v1";

export const MAX_LEVEL: RubricLevel = 2;
export const RUBRIC_MAX_TOTAL = 12;

export const RUBRIC: DecompositionRubricCriterion[] = [
  {
    id: "D1",
    moduleKey: "d1-frame",
    scoredBy: "detector",
    labelKey: "skills.decomposition.rubric.D1",
    levels: {
      0: "No statement of the undivided problem, or pieces appear before any whole.",
      1: "Whole stated but with no done condition, or the statement is a restatement of the prompt.",
      2: "The whole is stated in the learner's own words with a done condition, before the first piece is created.",
    },
  },
  {
    id: "D2",
    moduleKey: "d2-breadth",
    scoredBy: "instrumentation",
    labelKey: "skills.decomposition.rubric.D2",
    levels: {
      0: "The first branch is developed to its leaves before a second top-level piece exists.",
      1: "Some top-level enumeration, then a dive; at least one top-level piece is added after a depth-2 piece.",
      2: "Every top-level piece exists before any second-level piece; siblings sit at one level of abstraction.",
    },
  },
  {
    id: "D3",
    moduleKey: "d3-seams",
    scoredBy: "key-or-judge",
    labelKey: "skills.decomposition.rubric.D3",
    levels: {
      0: "Two or more pieces overlap in responsibility, or the same work is restated in two or more pieces.",
      1: "Exactly one overlap or one duplication.",
      2: "No piece's work is contained in another's; shared work is factored into one named piece.",
    },
  },
  {
    id: "D4",
    moduleKey: "d4-size",
    scoredBy: "key",
    labelKey: "skills.decomposition.rubric.D4",
    levels: {
      0: "Two or more pieces have no statable yes/no done condition, or the structure shatters a piece the key marks as atomic.",
      1: "Exactly one such fault.",
      2: "Every leaf has a yes/no done condition a third party could apply; nothing atomic has been split.",
    },
  },
  {
    id: "D5",
    moduleKey: "d5-order",
    scoredBy: "key",
    labelKey: "skills.decomposition.rubric.D5",
    levels: {
      0: "Dependencies unmarked, or containment and sequence are used interchangeably with no distinction.",
      1: "Dependencies marked but at least one of the key's blocking relations is missing or inverted.",
      2: "Every blocking relation in the key is present and correctly directed; independent pieces are not falsely ordered.",
    },
  },
  {
    id: "D6",
    moduleKey: "d6-recompose",
    scoredBy: "key-or-judge",
    labelKey: "skills.decomposition.rubric.D6",
    levels: {
      0: "Two or more of the key's required elements are absent from the structure.",
      1: "Exactly one required element absent.",
      2: "Every required element the item's key marks required appears in exactly one piece, and no more than one piece is outside the item's scope.",
    },
  },
];

export const CRITERION_BY_ID = new Map(RUBRIC.map((c) => [c.id, c]));

/**
 * Module → the criterion it trains. 1:1, so a repair item filed under a module
 * must seed that module's own criterion (validator rule `fault-off-module`),
 * and mastery requires level 2 on a module's own criterion so a globally
 * strong decomposer can't coast to mastery on `d5` while leaving dependencies
 * unmarked (spec §7).
 */
export const RUBRIC_CRITERIA_BY_MODULE = Object.fromEntries(
  RUBRIC.map((c) => [c.moduleKey, c.id])
) as Record<DecompositionModuleKey, DecompositionCriterionId>;

/** Criteria that resolve with no model at all, on every item type. */
export const OFFLINE_CRITERIA: DecompositionCriterionId[] = RUBRIC.filter(
  (c) => c.scoredBy === "detector" || c.scoredBy === "instrumentation" || c.scoredBy === "key"
).map((c) => c.id);

/** Criteria that need a judge only on free-authored (breakdown) items. */
export const JUDGE_ASSISTED_CRITERIA: DecompositionCriterionId[] = RUBRIC.filter(
  (c) => c.scoredBy === "key-or-judge"
).map((c) => c.id);
