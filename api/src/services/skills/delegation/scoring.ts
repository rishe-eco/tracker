/**
 * Assembles a `DelegationScore` from an item's key and a learner's response.
 * Spec: `05-delegation-lab.md` §4, §6, §7; build plan §4.
 *
 * Unlike Verification Lab, a single delegation attempt does not score all six
 * criteria at once — only the one criterion its own module trains, because
 * the other five genuinely don't apply to that item (a split item has no
 * WOA; a plain estimate item has no split key). The five inapplicable slots
 * carry `scoredBy: "unscored"`, same convention as a `null` criterion
 * elsewhere in this engine — "not scored," never a zero.
 *
 * G1 (self-knowledge) and G6 (stable updating) are the two criteria this
 * file does not assign a level to per attempt: G1's rubric describes a
 * multi-item pattern ("confidence tracks own accuracy... across the
 * window"), and a single item's confidence/accuracy pair is one data point
 * in that pattern, not the pattern itself — so a g1-own attempt records its
 * (confidence, wasAccurate) pair for the window-level Brier in
 * `getDelegationProgress`/mastery, but its own `criteria` array carries no
 * G1 level. G6 is assigned once the sequence's third round lands (below).
 */

import type { CueDirection, CueOption, DelegationCriterionId, DelegationModuleKey } from "../../../content/skills/delegation/types";
import { adviceQualityFor, dropRatioFor, netGainFor, scoreStableUpdating, scoreStakesPair, type StakesPairInput } from "./metrics";
import { benchmarkFor, computeWoa, relianceDirection, scoreProportionateWeight, type CueDirectionLike, type RelianceDirection } from "./woa";

export type DelegationCriterionScore = {
  id: DelegationCriterionId;
  level: 0 | 1 | 2 | null;
  scoredBy: "computed" | "key" | "key+computed" | "unscored";
  evidence: string;
};

const ALL_CRITERIA: DelegationCriterionId[] = ["G1", "G2", "G3", "G4", "G5", "G6"];
const CRITERION_BY_MODULE: Record<DelegationModuleKey, DelegationCriterionId> = {
  "g1-own": "G1",
  "g2-instance": "G2",
  "g3-weigh": "G3",
  "g4-split": "G4",
  "g5-stakes": "G5",
  "g6-drift": "G6",
};

function emptyCriteria(populated?: DelegationCriterionScore): DelegationCriterionScore[] {
  return ALL_CRITERIA.map((id) =>
    populated && populated.id === id ? populated : { id, level: null, scoredBy: "unscored", evidence: "Not this item's module." }
  );
}

export type DelegationScore = {
  moduleKey: DelegationModuleKey;
  criteria: DelegationCriterionScore[];
  total: number;
  scoredCount: number;
  /** Raw WOA, retained for export even when clamped for scoring (build plan §4.1). Null on split items and on a tie (advice === initial). */
  woaRaw: number | null;
  woaClamped: number | null;
  benchmark: number | null;
  direction: RelianceDirection;
  netGain: number | null;
  adviceQuality: "good" | "bad" | "tie" | null;
  /** The initial estimate fell outside plausibleRange — void, not wrong, and never averaged in as a zero (build plan §4.1). */
  isVoid: boolean;
  /** g5-stakes only: true until the sibling half of the pair has also committed. */
  pendingPair: boolean;
  /** g1-own only: this attempt's raw (confidence, wasAccurate) pair, for the window-level Brier. */
  g1Sample: { confidence: number; wasAccurate: boolean } | null;
  /**
   * The authored truth — never present on the served item, only here, on an
   * already-scored attempt (build plan §3's ordering rule applies to this
   * value exactly as it does to advice). Null on split items, which have no
   * single numeric truth to reveal (types.ts's header note).
   */
  truth: number | null;
};

export type AssembleEstimateInput = {
  moduleKey: DelegationModuleKey;
  initial: number;
  confidence: number;
  advice: number;
  final: number;
  truth: number;
  plausibleRange: [number, number];
  cueDirection: CueDirectionLike;
  /** "cue" items only. */
  cueSelection?: { selectedCueId: string; correct: boolean; level: 0 | 1 | 2 };
  /** "stakes" items only. */
  stakes?: { role: "low" | "high"; recoverabilityMove: boolean; siblingWoaClamped: number | null; siblingRecoverabilityMove: boolean };
};

/** Covers `estimate`, `cue`, and `stakes` kinds — every JAS-shaped item. */
export function assembleEstimateScore(input: AssembleEstimateInput): DelegationScore {
  const isVoid = input.initial < input.plausibleRange[0] || input.initial > input.plausibleRange[1];
  const { raw, clamped } = computeWoa(input.initial, input.advice, input.final);
  const benchmark = benchmarkFor(input.cueDirection);
  const direction = relianceDirection(clamped, input.initial, input.advice, input.truth);
  const netGain = isVoid ? null : netGainFor(input.initial, input.final, input.truth);
  const adviceQuality = isVoid ? null : adviceQualityFor(input.initial, input.advice, input.truth);
  const wasAccurate = !isVoid && Math.abs(input.initial - input.truth) < Math.abs((input.plausibleRange[0] + input.plausibleRange[1]) / 2 - input.truth);

  let populated: DelegationCriterionScore | undefined;
  let pendingPair = false;

  if (input.moduleKey === "g3-weigh") {
    const level = isVoid ? null : scoreProportionateWeight(clamped, benchmark);
    populated = {
      id: "G3",
      level,
      scoredBy: "computed",
      evidence: isVoid
        ? "Estimate fell outside the plausible range — void, not scored."
        : clamped === null
          ? "Advice equalled your initial estimate — weight of advice is undefined for this item."
          : `WOA ${clamped.toFixed(2)} against a benchmark of ${benchmark.toFixed(2)}.`,
    };
  } else if (input.moduleKey === "g2-instance" && input.cueSelection) {
    populated = {
      id: "G2",
      level: input.cueSelection.level,
      scoredBy: "key",
      evidence: input.cueSelection.correct
        ? "The cue you picked bears on relative competence, or correctly reported none exists."
        : "The cue you picked was a category claim, or missed an instance cue that existed.",
    };
  } else if (input.moduleKey === "g5-stakes" && input.stakes) {
    if (input.stakes.siblingWoaClamped === null) {
      pendingPair = true;
      populated = { id: "G5", level: null, scoredBy: "unscored", evidence: "Waiting on the other half of this pair." };
    } else {
      const pairInput: StakesPairInput =
        input.stakes.role === "high"
          ? { woaLow: input.stakes.siblingWoaClamped, woaHigh: clamped, recoverabilityMoveHigh: input.stakes.recoverabilityMove }
          : { woaLow: clamped, woaHigh: input.stakes.siblingWoaClamped, recoverabilityMoveHigh: input.stakes.siblingRecoverabilityMove };
      const level = scoreStakesPair(pairInput);
      populated = {
        id: "G5",
        level,
        scoredBy: "key+computed",
        evidence:
          level === 2
            ? "Reliance was either reduced under high stakes, or kept and made recoverable."
            : level === 0
              ? "Reliance was unchanged under high stakes, with no recoverability move recorded."
              : "Some change, but below the pair's threshold, and no recoverability move recorded.",
      };
    }
  }
  // g1-own: no per-attempt criterion — see this file's header note.

  return {
    moduleKey: input.moduleKey,
    criteria: emptyCriteria(populated),
    total: populated?.level ?? 0,
    scoredCount: populated?.level !== null && populated?.level !== undefined ? 1 : 0,
    woaRaw: raw,
    woaClamped: clamped,
    benchmark,
    direction,
    netGain,
    adviceQuality,
    isVoid,
    pendingPair,
    g1Sample: input.moduleKey === "g1-own" && !isVoid ? { confidence: input.confidence, wasAccurate } : null,
    truth: input.truth,
  };
}

export type AssembleSplitInput = {
  moduleKey: "g4-split";
  level: 0 | 1 | 2;
  evidence: string;
};

export function assembleSplitScore(input: AssembleSplitInput): DelegationScore {
  const populated: DelegationCriterionScore = { id: "G4", level: input.level, scoredBy: "key", evidence: input.evidence };
  return {
    moduleKey: input.moduleKey,
    criteria: emptyCriteria(populated),
    total: input.level,
    scoredCount: 1,
    woaRaw: null,
    woaClamped: null,
    benchmark: null,
    direction: "ok",
    netGain: null,
    adviceQuality: null,
    isVoid: false,
    pendingPair: false,
    g1Sample: null,
    truth: null,
  };
}

export type AssembleSequenceInput = {
  moduleKey: "g6-drift";
  round1Woa: number | null;
  round3Woa: number | null;
};

export function assembleSequenceScore(input: AssembleSequenceInput): DelegationScore {
  const dropRatio = dropRatioFor(input.round1Woa, input.round3Woa);
  const level = scoreStableUpdating(dropRatio);
  const populated: DelegationCriterionScore = {
    id: "G6",
    level,
    scoredBy: "computed",
    evidence:
      dropRatio === null
        ? "Round 1's weighting was too close to zero for a drop ratio to mean anything."
        : `Drop ratio ${dropRatio.toFixed(2)} (round 3 weighting / round 1 weighting).`,
  };
  return {
    moduleKey: input.moduleKey,
    criteria: emptyCriteria(populated),
    total: level ?? 0,
    scoredCount: level !== null ? 1 : 0,
    woaRaw: input.round3Woa,
    woaClamped: input.round3Woa,
    benchmark: null,
    direction: "ok",
    netGain: null,
    adviceQuality: null,
    isVoid: false,
    pendingPair: false,
    g1Sample: null,
    /** No single reveal-worthy truth for a sequence — the reveal (wireframe plate 6) shows the round bars, not a truth pin. */
    truth: null,
  };
}

/**
 * G2 (build plan §3, rubric): an instance-level cue that bears on relative
 * competence (or, on an uncued item, correctly picking "none") scores 2; an
 * instance-level cue that doesn't bear on relative competence scores 1; a
 * category claim, or missing an instance cue that existed, scores 0.
 */
export function scoreCueSelection(
  selectedCueId: string,
  cueOptions: CueOption[],
  cueDirection: CueDirection
): { level: 0 | 1 | 2; correct: boolean } {
  const opt = cueOptions.find((c) => c.cueId === selectedCueId);
  if (!opt) return { level: 0, correct: false };
  if (cueDirection === "none") {
    if (opt.kind === "none") return { level: 2, correct: true };
    if (opt.kind === "instance") return { level: 1, correct: false };
    return { level: 0, correct: false };
  }
  if (opt.kind === "instance" && opt.bearsOnRelative) return { level: 2, correct: true };
  if (opt.kind === "instance") return { level: 1, correct: false };
  return { level: 0, correct: false };
}

/**
 * G4 (build plan §3, rubric): the whole-task disposition (every piece given,
 * or every piece kept) is 0 regardless of what the key says; a full match on
 * every piece the key actually marks "give"/"keep" (ignoring "either") is 2;
 * anything else — including the fully-inverted case the rubric calls out by
 * name — is 1.
 */
export function scoreSplitDisposition(
  pieces: { pieceId: string; keyDisposition: "give" | "keep" | "either" }[],
  dispositions: Record<string, "give" | "keep">
): { level: 0 | 1 | 2 } {
  const keyed = pieces.filter((p) => p.keyDisposition !== "either");
  const chosen = keyed.map((p) => dispositions[p.pieceId]);
  const allSame = chosen.every((d) => d === chosen[0]);
  if (keyed.length > 0 && allSame) return { level: 0 };
  const matchCount = keyed.filter((p) => dispositions[p.pieceId] === p.keyDisposition).length;
  if (matchCount === keyed.length) return { level: 2 };
  return { level: 1 };
}

export { CRITERION_BY_MODULE };
