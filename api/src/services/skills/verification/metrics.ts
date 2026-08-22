/**
 * Behavioural metrics derived from a verification attempt's bench selections
 * and commit. Spec: `04-verification-lab.md` §6; build plan §4.1, §4.3, §4.4.
 */

import type { BenchEntry } from "../../../content/skills/verification/types";
import { cheapestSufficientCost } from "../../../content/skills/verification/types";

export type RitualState = "none-run" | "none-could-fail" | "some-could-fail" | "all-could-fail";

/**
 * Build plan §4.1. `none-run` is abstention, a different failure from
 * `none-could-fail` (ran checks, none of which could have failed) — pooling
 * the two would make the ritual-rate metric uninterpretable, so only
 * `none-could-fail` ever counts toward it.
 */
export function ritualStateFor(selected: BenchEntry[]): RitualState {
  if (selected.length === 0) return "none-run";
  const anyCouldFail = selected.some((c) => c.discriminating);
  const allCouldFail = selected.every((c) => c.discriminating);
  if (allCouldFail) return "all-could-fail";
  if (anyCouldFail) return "some-could-fail";
  return "none-could-fail";
}

export type CostResult = { costSpent: number; costRatio: number | null };

/** Sum of the checks actually run, and its ratio to the key's cheapest sufficient oracle. */
export function costFor(bench: BenchEntry[], selectedCheckIds: string[]): CostResult {
  const selected = bench.filter((b) => selectedCheckIds.includes(b.checkId));
  const costSpent = selected.reduce((sum, b) => sum + b.costSeconds, 0);
  const cheapest = cheapestSufficientCost(bench);
  return { costSpent, costRatio: cheapest == null || cheapest === 0 ? null : costSpent / cheapest };
}

/** Named per build plan §4.3 — tune here, not inline, since the value is explicitly provisional. */
export const V4_NEAR_RATIO = 1.5;
export const V4_OVERSPEND_RATIO = 3;

/**
 * V4 — proportionate cost (§4.3). `null` on the assisted rung: a ceiling
 * makes overspending impossible, so scoring it there would be scoring a
 * different criterion than the one the rubric describes.
 */
export function scoreCostLevel(
  ratio: number | null,
  rung: "assisted" | "unassisted",
  notWorthChecking: boolean,
  anyChecksRun: boolean
): 0 | 1 | 2 | null {
  if (rung === "assisted") return null;
  if (notWorthChecking) return anyChecksRun ? 0 : 2;
  if (ratio === null) return anyChecksRun ? 0 : null;
  if (ratio > V4_OVERSPEND_RATIO) return 0;
  if (ratio <= V4_NEAR_RATIO) return 2;
  return 1;
}

/** Multiple of the cheapest sufficient check the assisted rung's hard ceiling allows — not authored, spec §4a leaves the exact number to the build. */
export const ASSISTED_CEILING_MULTIPLE = 2;
/** Ceiling for a `notWorthChecking` item on the assisted rung, where there is no discriminating entry to multiply. */
export const ASSISTED_CEILING_NO_ORACLE = 15;

/** The assisted rung's hard cost ceiling for this item, in seconds. */
export function assistedCeilingFor(bench: BenchEntry[]): number {
  const cheapest = cheapestSufficientCost(bench);
  return cheapest == null ? ASSISTED_CEILING_NO_ORACLE : cheapest * ASSISTED_CEILING_MULTIPLE;
}

/** Discrimination = hit rate on faulty artifacts minus false-alarm rate on CORRECT controls (§6). */
export function discrimination(hits: number, faultyItems: number, falseAlarms: number, controlItems: number): number | null {
  if (faultyItems === 0 && controlItems === 0) return null;
  const hitRate = faultyItems > 0 ? hits / faultyItems : 0;
  const falseAlarmRate = controlItems > 0 ? falseAlarms / controlItems : 0;
  return hitRate - falseAlarmRate;
}

/**
 * Recall-recognition agreement (§4a, §6) — whether the learner's free-text
 * localisation matched the element they went on to pick. Fuzzy text matching
 * against the key's own labels is a judge's job (build plan Phase 6);
 * without one this is always `null`, a supported state exactly like
 * Clarity's judge-dependent criteria without a credential.
 */
export function recallRecognitionAgreement(_elementFreeText: string, _chosenElementId: string, _judgeAvailable: false): null {
  return null;
}

/** Cost-prediction accuracy (§4a, §4.4) — descriptive, never scored. */
export function predictionError(predictedCostSeconds: number | null, cheapest: number | null): number | null {
  if (predictedCostSeconds == null || cheapest == null || cheapest === 0) return null;
  return Math.abs(predictedCostSeconds - cheapest) / cheapest;
}
