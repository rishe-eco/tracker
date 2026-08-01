/**
 * Clarity Lab content types.
 *
 * Same spec/surface split as Evidence Lab (00-skills-engine.md §5.1): everything
 * that makes an item an instrument is authored once and shared across locales;
 * only the words are realised per language.
 *
 * The asymmetry with Evidence Lab is deliberate and runs through this file.
 * Evidence scores *behaviour* — did you check, in what order, how fast — which
 * is observable and needs no model. Clarity scores a *product*, so the whole
 * problem becomes scoring reliability, and three of the six criteria genuinely
 * need a judge. The design keeps the other three deterministic so the tool is
 * not useless without one.
 */

import type { Difficulty, FormId, Locale } from "../types";

// Re-exported so the clarity pack has one import surface.
export type { Difficulty, FormId, Locale };

export const CLARITY_MODULE_KEYS = [
  "c1-ask",
  "c2-deliverable",
  "c3-context",
  "c4-referents",
  "c5-done",
  "c6-economy",
] as const;
export type ClarityModuleKey = (typeof CLARITY_MODULE_KEYS)[number];

/** The six rubric criteria, one per module. */
export const RUBRIC_CRITERIA = ["R1", "R2", "R3", "R4", "R5", "R6"] as const;
export type CriterionId = (typeof RUBRIC_CRITERIA)[number];

export type RubricLevel = 0 | 1 | 2;

/**
 * How a criterion gets its level.
 *
 * `detector` — surface features, fully deterministic, no model.
 * `judge` — requires reading for meaning; no honest heuristic exists.
 * `both` — the detector sets a **ceiling** and the judge may only lower it.
 *
 * That last rule is what stops "checkbox clarity". A learner can satisfy the
 * observable feature (an imperative in sentence one) while communicating badly;
 * the detector cannot see that, but it can refuse to award the level when the
 * surface feature is *absent*. Necessary, not sufficient — so the detector
 * caps and the judge deducts, never the reverse.
 */
export type ScoringSource = "detector" | "judge" | "both";

export type RubricCriterion = {
  id: CriterionId;
  moduleKey: ClarityModuleKey;
  scoredBy: ScoringSource;
  /** Short label, localised at render time via i18n, not here. */
  labelKey: string;
  /**
   * Decision rules per level. Written as *observable features* rather than
   * impressions: "was this clear?" is unscoreable, "does the primary ask appear
   * in the first two sentences?" is not. Scoring gets measurably more consistent
   * when criteria describe what a rater can point at.
   */
  levels: Record<RubricLevel, string>;
};

export type ClarityItemType = "elicitation" | "revision" | "repair";

/**
 * Context slots an elicitation item's scenario makes available. The item's key
 * marks which are *required*; supplying the rest is padding and costs R6.
 */
export const CONTEXT_SLOTS = [
  "audience",
  "purpose",
  "input",
  "constraint",
  "format",
  "prior_attempt",
  "out_of_scope",
] as const;
export type ContextSlot = (typeof CONTEXT_SLOTS)[number];

export type ClarityItemSpec = {
  itemId: string;
  moduleKey: ClarityModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  type: ClarityItemType;
  /**
   * Elicitation only: which context slots a competent request must supply.
   * Drives R3, and is locale-invariant — the facts required don't change with
   * the language they're written in.
   */
  requiredSlots: ContextSlot[];
  /** Revision/repair only: the criteria the seeded text actually fails. */
  seededFaults: CriterionId[];
  /**
   * Repair only: the fix is checked by re-running that criterion's own detector
   * on the rewritten sentence and requiring the stated level. Reusing the
   * detector rather than a bespoke regex per item means a drill can never
   * disagree with the rubric it is teaching.
   */
  repairCheck?: { criterion: CriterionId; requiredLevel: RubricLevel };
  keyNote: string;
  keyVerifiedAt: string | null;
};

export type ClarityItemSurface = {
  itemId: string;
  /** The task as the learner meets it. */
  scenario: string;
  /**
   * Facts only the learner "knows". The gap between what's here and what they
   * choose to pass on is most of what R3 measures.
   */
  contextSheet?: string;
  /** Revision/repair only: the text to fix. */
  weakText?: string;
  /**
   * Revision only: what the reader actually produced from `weakText`.
   *
   * Authored rather than generated, which is what lets revision items — and so
   * the core revise-and-diagnose loop — run with no model configured at all.
   */
  authoredMisread?: string;
  /**
   * Repair only: a competent fix, authored alongside the drill.
   *
   * Never reaches the client — `toPublicClarityItem` cannot return it. It exists
   * so the validator can prove the drill is *satisfiable*: the weak text must
   * fail its own criterion under the detector, and this must clear it. Without
   * that check a drill can quietly teach something the rubric then marks wrong,
   * and nothing anywhere would notice.
   */
  exemplarFix?: string;
  /** Shown after the learner has committed their own diagnosis. */
  reveal: string;
};

export type ClarityModuleSurface = {
  moduleKey: ClarityModuleKey;
  title: string;
  concept: string;
  model: string;
};

export type ClarityPack = {
  skillKey: "clarity";
  contentVersion: string;
  rubricVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  modules: ClarityModuleSurface[];
  items: (ClarityItemSpec & { surface: ClarityItemSurface })[];
};

/** What the client may see. No required slots, no seeded faults, no reveal. */
export type PublicClarityItem = {
  itemId: string;
  moduleKey: ClarityModuleKey;
  type: ClarityItemType;
  difficulty: Difficulty;
  scenario: string;
  contextSheet: string | null;
  weakText: string | null;
  /** Revision items ship their misread up front — that *is* the stimulus. */
  authoredMisread: string | null;
};

export function toPublicClarityItem(
  item: ClarityItemSpec & { surface: ClarityItemSurface }
): PublicClarityItem {
  return {
    itemId: item.itemId,
    moduleKey: item.moduleKey,
    type: item.type,
    difficulty: item.difficulty,
    scenario: item.surface.scenario,
    contextSheet: item.surface.contextSheet ?? null,
    weakText: item.surface.weakText ?? null,
    authoredMisread: item.surface.authoredMisread ?? null,
  };
}
