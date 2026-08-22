/**
 * Verification Lab content types.
 *
 * Same spec/surface split as the other three tools (00-skills-engine.md §5.1).
 * The instrument is an **oracle bench**: an artifact plus a fixed set of
 * candidate checks, each with an authored cost, an authored outcome, and key
 * tags describing what the check actually is (`independent`, `discriminating`,
 * `bearsOnClaim`). All six rubric criteria (V1-V6) resolve against this key or
 * against instrumented event order — no criterion needs a model
 * (04-verification-lab.md §4, §9). Only the optional recall-recognition
 * agreement metric (build plan Phase 6) wants a judge, and it stays outside
 * every total without one.
 *
 * One item shape covers every module, including `v3-falsify`: the wireframe
 * draws that module's practice screen as a lighter three-check drill, but
 * scoring and content stay on the single six-entry bench shape below so there
 * is one instrument, one validator, and one scoring path rather than two — a
 * deliberate simplification over the wireframe's presentation, recorded in the
 * decision log for Phase 2.
 */

import type { Difficulty, FormId, Locale } from "../types";

// Re-exported so the verification pack has one import surface.
export type { Difficulty, FormId, Locale };

export const VERIFICATION_MODULE_KEYS = [
  "v1-oracle",
  "v2-independent",
  "v3-falsify",
  "v4-cheapest",
  "v5-locate",
  "v6-unverifiable",
] as const;
export type VerificationModuleKey = (typeof VERIFICATION_MODULE_KEYS)[number];

/** The six rubric criteria, one per module. */
export const VERIFICATION_CRITERIA = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;
export type VerificationCriterionId = (typeof VERIFICATION_CRITERIA)[number];

export type RubricLevel = 0 | 1 | 2;

/**
 * How a criterion gets its level. Every criterion here resolves against the
 * authored key or an instrumented event — "judge" never appears, because the
 * one thing a judge could help with (recall-recognition agreement) is a
 * descriptive metric, not a rubric criterion (spec §4, §6).
 */
export type VerificationScoringSource = "detector" | "instrumentation" | "key" | "key+instrumentation";

export type VerificationRubricCriterion = {
  id: VerificationCriterionId;
  moduleKey: VerificationModuleKey;
  scoredBy: VerificationScoringSource;
  /** Short label, localised at render time via i18n, not here. */
  labelKey: string;
  /** Decision rules per level, transcribed from the spec's rubric table (§4). */
  levels: Record<RubricLevel, string>;
};

/** Spec §5's fault taxonomy, plus the two controls. `oracleClass` is derived per profile, never authored twice. */
export const FAULT_PROFILES = [
  "CORRECT",
  "NO_ORACLE",
  "WRONG_UNITS",
  "MAGNITUDE_ERROR",
  "BOUNDARY_OFF_BY_ONE",
  "LOGIC_INVERSION",
  "STALE_ASSUMPTION",
  "SUBTLE_SUBSTITUTION",
  "PLAUSIBLE_FABRICATION",
  "SUM_MISMATCH",
] as const;
export type FaultProfile = (typeof FAULT_PROFILES)[number];

export const CONTROL_PROFILES: readonly FaultProfile[] = ["CORRECT", "NO_ORACLE"];
export function isControlProfile(profile: FaultProfile): boolean {
  return CONTROL_PROFILES.includes(profile);
}

export type OracleClass = "partial" | "metamorphic" | "full" | "none";

/** Spec §5's profile → revealing-oracle-class table. Authored once, never per item. */
export const ORACLE_CLASS_BY_PROFILE: Record<FaultProfile, OracleClass> = {
  CORRECT: "partial",
  NO_ORACLE: "none",
  WRONG_UNITS: "partial",
  MAGNITUDE_ERROR: "partial",
  SUM_MISMATCH: "partial",
  PLAUSIBLE_FABRICATION: "partial",
  BOUNDARY_OFF_BY_ONE: "metamorphic",
  LOGIC_INVERSION: "metamorphic",
  STALE_ASSUMPTION: "full",
  SUBTLE_SUBSTITUTION: "full",
};

export type Verdict = "supported" | "unsupported" | "outdated" | "cannot_verify";

/**
 * Profile → the verdict it implies. Pinned here, in one place, rather than
 * left free per item — `CORRECT` is always `supported`, `NO_ORACLE` is always
 * `cannot_verify`, `STALE_ASSUMPTION` is always `outdated` (it is, definitionally,
 * a claim that was once true), and every other faulty profile is `unsupported`.
 */
export const VERDICT_BY_PROFILE: Record<FaultProfile, Verdict> = {
  CORRECT: "supported",
  NO_ORACLE: "cannot_verify",
  STALE_ASSUMPTION: "outdated",
  WRONG_UNITS: "unsupported",
  MAGNITUDE_ERROR: "unsupported",
  BOUNDARY_OFF_BY_ONE: "unsupported",
  LOGIC_INVERSION: "unsupported",
  SUBTLE_SUBSTITUTION: "unsupported",
  PLAUSIBLE_FABRICATION: "unsupported",
  SUM_MISMATCH: "unsupported",
};

/**
 * One candidate check on the bench. Never reaches the client until the
 * learner spends it — see `toPublicVerificationItem` and the session
 * service's one-outcome-per-round-trip rule (build plan §3, §5).
 */
export type BenchEntry = {
  checkId: string;
  costSeconds: number;
  /** false for self-critique, stated confidence, or re-asking the same model. */
  independent: boolean;
  /** Would this check have returned differently had the artifact been wrong? */
  discriminating: boolean;
  /**
   * May be true while `discriminating` is false: a correct, independent check
   * of a part of the artifact that was never in doubt (the "respectable"
   * pass-either-way check, spec §5's near-miss). Always false on `NO_ORACLE`
   * items — nothing on the bench bears on a claim that cannot be settled.
   */
  bearsOnClaim: boolean;
};

export type VerificationElement = { elementId: string; decoy: boolean };

export type VerificationItemSpec = {
  itemId: string;
  moduleKey: VerificationModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  profile: FaultProfile;
  /** Derived from `profile` via `ORACLE_CLASS_BY_PROFILE` at authoring time, asserted by the validator — not re-authored per item. */
  oracleClass: OracleClass;
  /** Exactly 6, every item, every module (see this file's header note on `v3-falsify`). */
  bench: BenchEntry[];
  /** ≥4, of which ≥2 are decoys. */
  elements: VerificationElement[];
  /** Null on `CORRECT` and `NO_ORACLE` — nothing fails. */
  failingElementId: string | null;
  keyVerdict: Verdict;
  /** A control the key says needs no check run at all — never true off a control profile. */
  notWorthChecking: boolean;
  /** The reviewer's note — why this is the key, and what a re-verifier checks against. */
  keyNote: string;
  /** `null` blocks probe use (build plan §8); practice is unaffected. */
  keyVerifiedAt: string | null;
};

/**
 * `cheapestSufficientCost` is derived, never authored: `min(costSeconds)`
 * over discriminating entries. An authored copy has somewhere to drift to and
 * a wrong value would silently mis-score V4 on every attempt of that item
 * (build plan §3 Phase 2, §8 risk table).
 */
export function cheapestSufficientCost(bench: BenchEntry[]): number | null {
  const discriminating = bench.filter((b) => b.discriminating);
  if (discriminating.length === 0) return null;
  return Math.min(...discriminating.map((b) => b.costSeconds));
}

export type VerificationItemSurface = {
  itemId: string;
  /** What was asked of the AI. */
  ask: string;
  /** The AI's answer, exactly as a real one would read. */
  answer: string;
  /** checkId → display label. */
  checkLabels: Record<string, string>;
  /** checkId → the authored outcome text, revealed only once that check is selected. */
  checkOutcomes: Record<string, string>;
  /** elementId → display label for the localisation list. */
  elementLabels: Record<string, string>;
};

export type VerificationModuleSurface = {
  moduleKey: VerificationModuleKey;
  title: string;
  /** Step 1. One idea, ≤2 min, ≤250 words. */
  concept: string;
  /** Step 2. A worked contrast — a ritual check beside a discriminating one, with the difference named. */
  model: string;
};

export type VerificationPack = {
  skillKey: "verification";
  contentVersion: string;
  rubricVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  modules: VerificationModuleSurface[];
  items: (VerificationItemSpec & { surface: VerificationItemSurface })[];
};

/**
 * What the client may see before submission: cost and label only, per bench
 * entry — no `independent`, no `discriminating`, no outcome, no element
 * decoy flags, no `failingElementId`, no `keyVerdict`. Outcomes are served
 * one at a time, on selection, by the session service, never in this
 * projection (build plan §3, §5, §11).
 */
export type PublicVerificationItem = {
  itemId: string;
  moduleKey: VerificationModuleKey;
  difficulty: Difficulty;
  ask: string;
  answer: string;
  bench: { checkId: string; label: string; costSeconds: number }[];
};

export function toPublicVerificationItem(
  item: VerificationItemSpec & { surface: VerificationItemSurface }
): PublicVerificationItem {
  return {
    itemId: item.itemId,
    moduleKey: item.moduleKey,
    difficulty: item.difficulty,
    ask: item.surface.ask,
    answer: item.surface.answer,
    bench: item.bench.map((b) => ({
      checkId: b.checkId,
      label: item.surface.checkLabels[b.checkId] ?? b.checkId,
      costSeconds: b.costSeconds,
    })),
  };
}
