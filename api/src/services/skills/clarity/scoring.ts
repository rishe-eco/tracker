/**
 * Clarity rubric assembly.
 *
 * Takes detector levels and (optionally) judge levels and produces one scored
 * artifact. Three rules do the work:
 *
 * **1. The detector is a ceiling; the judge may only lower it.** For the three
 * criteria both can see, the final level is `min(detector, judge)`. A detector
 * can prove the observable feature is *absent* but never that a text which ticks
 * every box actually communicates — so it caps, and the judge deducts. This is
 * also what stops "checkbox clarity": writing to the detector gets you the
 * ceiling and no further.
 *
 * **2. An unscored criterion is not a zero.** With no judge configured, R2/R3/R5
 * have no honest level. They are reported as unscored and removed from both the
 * numerator and the denominator, because averaging in a zero would tell a
 * learner they failed at something nobody assessed.
 *
 * **3. Void is separate from bad.** An empty or off-task response is an absence
 * of data, not a low score, and never enters a total or a trend.
 */

import type { CriterionId, RubricLevel } from "../../../content/skills/clarity/types";
import { CRITERION_BY_ID, RUBRIC, RUBRIC_MAX_TOTAL } from "../../../content/skills/clarity/v1/rubric";
import type { DetectorResult } from "./detectors";

export type ScoreSource = "detector" | "judge" | "detector+judge" | "unscored";

export type CriterionScore = {
  criterion: CriterionId;
  level: RubricLevel | null;
  source: ScoreSource;
  findings: string[];
  /**
   * The judge must quote the learner's own words to justify a level. Shown in
   * feedback, so its evidence is visible rather than asserted.
   */
  evidenceQuote?: string | null;
};

export type JudgeCriterionResult = {
  criterion: CriterionId;
  level: RubricLevel;
  evidenceQuote: string | null;
  rationale?: string;
};

export type ClarityScore = {
  criteria: CriterionScore[];
  /** Sum over scored criteria only. */
  total: number;
  /** 12 with a judge; 6 in no-AI mode. Always reported beside the total. */
  maxPossible: number;
  scoredCount: number;
  unscored: CriterionId[];
  isVoid: boolean;
  /** True only when all six criteria carry a level — the bar mastery needs. */
  isComplete: boolean;
};

export const CLARITY_MASTERY_MIN_TOTAL = 10;

export function assembleClarityScore(
  detectorResults: DetectorResult[],
  judgeResults: JudgeCriterionResult[],
  opts: { isVoid?: boolean } = {}
): ClarityScore {
  const detectorBy = new Map(detectorResults.map((d) => [d.criterion, d]));
  const judgeBy = new Map(judgeResults.map((j) => [j.criterion, j]));

  const criteria: CriterionScore[] = RUBRIC.map((definition) => {
    const detector = detectorBy.get(definition.id);
    const judge = judgeBy.get(definition.id);

    if (detector && judge) {
      // The ceiling rule. `min` and not an average: a judge that sees a real
      // problem the detector missed must be able to say so, and a judge that
      // likes the text cannot hand back a level the surface features don't
      // support.
      const level = Math.min(detector.level, judge.level) as RubricLevel;
      const findings = [...detector.findings];
      if (judge.level < detector.level && judge.rationale) findings.push(judge.rationale);
      return {
        criterion: definition.id,
        level,
        source: "detector+judge",
        findings,
        evidenceQuote: judge.evidenceQuote,
      };
    }

    if (detector) {
      return {
        criterion: definition.id,
        level: detector.level,
        source: "detector",
        findings: detector.findings,
        evidenceQuote: null,
      };
    }

    if (judge) {
      return {
        criterion: definition.id,
        level: judge.level,
        source: "judge",
        findings: judge.rationale ? [judge.rationale] : [],
        evidenceQuote: judge.evidenceQuote,
      };
    }

    return { criterion: definition.id, level: null, source: "unscored", findings: [], evidenceQuote: null };
  });

  const scored = criteria.filter((c) => c.level !== null);
  const unscored = criteria.filter((c) => c.level === null).map((c) => c.criterion);
  const isVoid = opts.isVoid === true;

  return {
    criteria,
    total: isVoid ? 0 : scored.reduce((sum, c) => sum + (c.level as number), 0),
    maxPossible: scored.length * 2,
    scoredCount: scored.length,
    unscored,
    isVoid,
    isComplete: !isVoid && scored.length === RUBRIC.length,
  };
}

/** Sanity guard: the full rubric tops out at 12. */
export function isFullRubric(score: ClarityScore): boolean {
  return score.maxPossible === RUBRIC_MAX_TOTAL;
}

/**
 * Did this attempt clear the bar for its module?
 *
 * Requires the module's *own* criterion at level 2, not just a strong total — a
 * generally good writer could otherwise coast through `c4-referents` while still
 * leaving referents dangling.
 */
export function atCriterion(score: ClarityScore, moduleKey: string): boolean {
  if (!score.isComplete) return false;
  if (score.total < CLARITY_MASTERY_MIN_TOTAL) return false;
  if (score.criteria.some((c) => c.level === 0)) return false;

  const own = RUBRIC.find((c) => c.moduleKey === moduleKey);
  if (!own) return false;
  return score.criteria.find((c) => c.criterion === own.id)?.level === 2;
}

export type ScoredClarityAttempt = {
  score: ClarityScore;
  moduleKey: string;
  /** "YYYY-MM-DD" in the learner's timezone. */
  dayKey: string;
  /** Step-6 attempts only; scaffolded work never earns mastery. */
  unscaffolded: boolean;
};

export type ClarityMasteryVerdict = {
  mastered: boolean;
  unmetCriteria: string[];
};

export const CLARITY_MASTERY_CONSECUTIVE = 2;

export function evaluateClarityMastery(attempts: ScoredClarityAttempt[]): ClarityMasteryVerdict {
  const unscaffolded = attempts.filter((a) => a.unscaffolded && !a.score.isVoid);
  const window = unscaffolded.slice(-CLARITY_MASTERY_CONSECUTIVE);
  const unmet: string[] = [];

  if (window.length < CLARITY_MASTERY_CONSECUTIVE) {
    unmet.push(`needs ${CLARITY_MASTERY_CONSECUTIVE} unscaffolded attempts`);
  }

  // Without a judge, R2/R3/R5 are unscored — half the rubric, and the half that
  // covers context and success criteria. Mastery deliberately stays out of
  // reach rather than being redefined downwards to whatever can be measured.
  if (window.some((a) => !a.score.isComplete)) {
    unmet.push("the full rubric has not been scored (three criteria need a reader)");
  }

  const atBar = window.filter((a) => atCriterion(a.score, a.moduleKey));
  if (atBar.length < CLARITY_MASTERY_CONSECUTIVE) {
    unmet.push(
      `${atBar.length}/${CLARITY_MASTERY_CONSECUTIVE} attempts at ${CLARITY_MASTERY_MIN_TOTAL}+/12 with this module's own criterion at level 2`
    );
  }

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= CLARITY_MASTERY_CONSECUTIVE && distinctDays < 2) {
    unmet.push("practice spread over 1 of 2 required days");
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

/**
 * Draft → revision improvement.
 *
 * The delta is the learning signal early on, but the win condition is the delta
 * *shrinking* as the skill migrates into the first draft. A tool that only ever
 * charts a rising total is measuring the wrong thing.
 */
export function revisionDelta(draft: ClarityScore, revision: ClarityScore): number | null {
  if (draft.isVoid || revision.isVoid) return null;
  if (draft.maxPossible !== revision.maxPossible) return null; // not comparable
  return revision.total - draft.total;
}

/** Which criteria the learner named as failing, versus which actually did. */
export function diagnosisAccuracy(
  tagged: CriterionId[],
  score: ClarityScore
): { correct: CriterionId[]; missed: CriterionId[]; spurious: CriterionId[] } {
  const actuallyFailed = new Set(
    score.criteria.filter((c) => c.level !== null && c.level < 2).map((c) => c.criterion)
  );
  const taggedSet = new Set(tagged);
  return {
    correct: [...taggedSet].filter((c) => actuallyFailed.has(c)),
    missed: [...actuallyFailed].filter((c) => !taggedSet.has(c)),
    spurious: [...taggedSet].filter((c) => !actuallyFailed.has(c) && CRITERION_BY_ID.has(c)),
  };
}
