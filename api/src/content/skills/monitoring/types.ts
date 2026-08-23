/**
 * Monitoring Lab content types.
 *
 * Same spec/surface split as the other five tools (00-skills-engine.md §5.1),
 * with one inversion the others don't have: every item here collects a claim
 * the learner makes about *themselves* — a prediction, a rating, a marked
 * influence — and only then measures it against a key. Where every other
 * tool's key is a fact about the world or the artifact, this tool's key is
 * still authored, but what it's checked against is the learner's own state
 * (06-monitoring-lab.md §1, §2).
 *
 * Five item kinds, one dominant per module (spec §5):
 *   - "recall"     s3-resolution. Predict, then answer, then match. The
 *                  baseline/post/delayed instrument (needs many keyed items,
 *                  no free text).
 *   - "pair"       s1-access. Two DISTINCT difficulty-matched trivia items,
 *                  not one item shown twice — the assisted half carries an
 *                  authored explanation and is never itself scored for
 *                  correctness, only self-rated; the unassisted half is a
 *                  full recall item (predicted vs actual) AND self-rated.
 *                  The self-rating pair produces the inflation measure
 *                  (build plan §4.3); the unassisted half's predict/answer
 *                  pair contributes to S1's own resolution-style clause.
 *   - "explain"    s2-explain. Rate, explain freely, select from the key's
 *                  causal steps, re-rate. The deflation is taught, not
 *                  scored — only the step selection scores (spec §2 trap 2).
 *   - "transcript" s4-agreement, s5-anchor. An authored conversation with
 *                  planted, typed, WEIGHTED influences (or none, on a clean
 *                  control). The learner marks what moved them.
 *   - "longset"    s6-complacency. A bundle of many quick claim-review
 *                  checkpoints, authored as one spec entry, followed by a
 *                  countermeasure choice. Check-rate is instrumented across
 *                  the run and reported descriptively, never scored
 *                  (build plan §4.5) — only the countermeasure choice scores.
 *
 * Two fields are deliberately never on the same item: `answerVariants` (a
 * key) and `planted`/`checkpoints` (also keys) never leave the server before
 * their own commit gate — see `toPublicMonitoringItem` below, which is this
 * file's version of that rule.
 */

import type { Difficulty, FormId, Locale } from "../types";

// Re-exported so the monitoring pack has one import surface.
export type { Difficulty, FormId, Locale };

export const MONITORING_MODULE_KEYS = [
  "s1-access",
  "s2-explain",
  "s3-resolution",
  "s4-agreement",
  "s5-anchor",
  "s6-complacency",
] as const;
export type MonitoringModuleKey = (typeof MONITORING_MODULE_KEYS)[number];

/** The six rubric criteria, one per module. */
export const MONITORING_CRITERIA = ["S1", "S2", "S3", "S4", "S5", "S6"] as const;
export type MonitoringCriterionId = (typeof MONITORING_CRITERIA)[number];

export type RubricLevel = 0 | 1 | 2;

/** "No model anywhere in the scored path, for the fourth [now sixth] tool running" (spec §4). */
export type MonitoringScoringSource = "computed" | "key" | "key+computed";

export type MonitoringRubricCriterion = {
  id: MonitoringCriterionId;
  moduleKey: MonitoringModuleKey;
  scoredBy: MonitoringScoringSource;
  labelKey: string;
  levels: Record<RubricLevel, string>;
};

/** Settled 2026-08-12 (build plan §2.2): three causal steps per s2 item, behind this constant. */
export const S2_STEPS = 3;
/** A narrower key silently inverts the resolution measure (build plan §4.2) — the floor is load-bearing, not decorative. */
export const MIN_ANSWER_VARIANTS = 3;
/** Rozenblit & Keil's own instrument is a ten-point scale; reused here so s1's and s2's ratings are the same primitive. 0-10 inclusive. */
export const RATING_SCALE_MAX = 10;
/** Divisible by 3 so first-third/last-third check-rate decay (build plan §4.5) is a clean split. */
export const LONGSET_SIZE = 9;

export type MonitoringItemKind = "recall" | "pair" | "explain" | "transcript" | "longset";

/** Ordinal, matching gamma.ts's concordant/discordant pair test (build plan §4.1). */
export const PREDICTION_LEVELS = ["no_idea", "probably_not", "probably", "confident"] as const;
export type PredictionLevel = (typeof PREDICTION_LEVELS)[number];
export const PREDICTION_ORDINAL: Record<PredictionLevel, number> = {
  no_idea: 0,
  probably_not: 1,
  probably: 2,
  confident: 3,
};

export type PairHalf = "assisted" | "unassisted";

export type CausalStep = { stepId: string; loadBearing: boolean };

export type PlantedInfluenceType = "flattery" | "anchor" | "smuggled_premise" | "agreement_reversal";

/** "Weighted, not just typed" (build plan §2 Phase 2 note): flattery is easiest to spot and moves least; a smuggled premise or an agreement reversal is what actually moves a decision. */
export type PlantedInfluence = { turnId: string; type: PlantedInfluenceType; weight: 1 | 2 };

/**
 * Structure only — no text. Turn TEXT lives in the surface because s4's fa
 * turns are re-authored rather than translated (spec §4), which means the
 * words genuinely differ per locale, not just their rendering; only the
 * shape (who's speaking, which turns are planted) is locale-invariant.
 */
export type TranscriptTurnSpec = { turnId: string; role: "user" | "assistant" };

export type Countermeasure = { optionId: string; attentionDependent: boolean };

/**
 * `claimCorrect` supports an honest key note and a future review pass; it is
 * never scored (build plan §4.5 — check-rate decay is descriptive only). What
 * scores in this module is the countermeasure choice alone.
 */
export type LongsetCheckpointSpec = { checkpointId: string; claimCorrect: boolean };

export type MonitoringItemSpec = {
  itemId: string;
  moduleKey: MonitoringModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  kind: MonitoringItemKind;

  /** "pair" only. Both halves share a pairId; the assisted half alone carries a surface-level authoredExplanation. */
  pairId?: string;
  pairHalf?: PairHalf;

  /** "explain" only. Exactly S2_STEPS entries, at least one load-bearing. */
  causalSteps?: CausalStep[];

  /** "transcript" only. */
  turns?: TranscriptTurnSpec[];
  planted?: PlantedInfluence[];
  isCleanControl?: boolean;

  /** "longset" only. Exactly LONGSET_SIZE checkpoints. */
  checkpoints?: LongsetCheckpointSpec[];
  countermeasures?: Countermeasure[];

  /** The reviewer's note — why this is the key, and what a re-verifier checks against. */
  keyNote: string;
  /** `null` blocks probe use (build plan §5); practice is unaffected. */
  keyVerifiedAt: string | null;
};

export type MonitoringItemSurface = {
  itemId: string;
  /** "recall", and both halves of a "pair". */
  question?: string;
  /**
   * "recall", and the unassisted half of a "pair" — never the assisted
   * half. Per-locale, not per-spec: the acceptable strings a learner would
   * actually type differ by language, unlike the causal-step/planted-turn
   * structure elsewhere in this file, which is genuinely locale-invariant.
   */
  answerVariants?: string[];
  requiredTokens?: string[][];
  /** Assisted half of a "pair" only — the AI-style explanation shown before any rating. Per-locale: it's prose, like the question itself. */
  authoredExplanation?: string;
  /** "explain" only: what to explain. */
  explainPrompt?: string;
  /** "explain" only: stepId -> display label. */
  stepLabels?: Record<string, string>;
  /** "transcript" only: turnId -> text. */
  turnText?: Record<string, string>;
  /**
   * "transcript", s4 only, fa locale only: true once a native reviewer has
   * confirmed the planted turn still carries its influence in Persian rather
   * than reading as ordinary تعارف (spec §4, §10). Checked by
   * `fa-s4-reauthored`.
   */
  reauthored?: boolean;
  /** "longset" only: checkpointId -> claim text. */
  checkpointText?: Record<string, string>;
  /** "longset" only: optionId -> display label. */
  countermeasureLabels?: Record<string, string>;
};

export type MonitoringModuleSurface = {
  moduleKey: MonitoringModuleKey;
  title: string;
  /** Step 1. One idea, <=2 min, <=250 words. */
  concept: string;
  /** Step 2. A worked contrast. */
  model: string;
};

export type MonitoringPack = {
  skillKey: "monitoring";
  contentVersion: string;
  rubricVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  modules: MonitoringModuleSurface[];
  items: (MonitoringItemSpec & { surface: MonitoringItemSurface })[];
};

/**
 * What the client may see before its item's own commit gate: never
 * `answerVariants`/`requiredTokens`, never `causalSteps`, never `planted`,
 * never a checkpoint's `claimCorrect`, never a countermeasure's
 * `attentionDependent` flag. Build plan §3's ordering rule — "the prediction
 * is server-stamped before the item is answerable, and the answer is absent
 * from the payload until it is" — is this type's entire reason to exist.
 */
export type PublicMonitoringItem = {
  itemId: string;
  moduleKey: MonitoringModuleKey;
  difficulty: Difficulty;
  kind: MonitoringItemKind;
  question: string | null;
  explainPrompt: string | null;
  /** Assisted pair half only. Shown before any rating, per §10's ordering rule. */
  authoredExplanation: string | null;
  pairId: string | null;
  pairHalf: PairHalf | null;
  turns: { turnId: string; role: "user" | "assistant"; text: string }[] | null;
  checkpoints: { checkpointId: string; text: string }[] | null;
  countermeasureOptions: { optionId: string; label: string }[] | null;
};

export function toPublicMonitoringItem(item: MonitoringItemSpec & { surface: MonitoringItemSurface }): PublicMonitoringItem {
  return {
    itemId: item.itemId,
    moduleKey: item.moduleKey,
    difficulty: item.difficulty,
    kind: item.kind,
    question: item.surface.question ?? null,
    explainPrompt: item.surface.explainPrompt ?? null,
    authoredExplanation: item.pairHalf === "assisted" ? (item.surface.authoredExplanation ?? null) : null,
    pairId: item.pairId ?? null,
    pairHalf: item.pairHalf ?? null,
    turns: item.turns?.map((t) => ({ turnId: t.turnId, role: t.role, text: item.surface.turnText?.[t.turnId] ?? "" })) ?? null,
    checkpoints: item.checkpoints?.map((c) => ({ checkpointId: c.checkpointId, text: item.surface.checkpointText?.[c.checkpointId] ?? "" })) ?? null,
    countermeasureOptions:
      item.countermeasures?.map((c) => ({ optionId: c.optionId, label: item.surface.countermeasureLabels?.[c.optionId] ?? c.optionId })) ?? null,
  };
}
