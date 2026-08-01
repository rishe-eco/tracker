import { describe, expect, it } from "vitest";
import type { CriterionId, RubricLevel } from "../content/skills/clarity/types";
import type { DetectorResult } from "../services/skills/clarity/detectors";
import {
  assembleClarityScore,
  atCriterion,
  diagnosisAccuracy,
  evaluateClarityMastery,
  isFullRubric,
  revisionDelta,
  type JudgeCriterionResult,
  type ScoredClarityAttempt,
} from "../services/skills/clarity/scoring";

const det = (criterion: CriterionId, level: RubricLevel, findings: string[] = []): DetectorResult => ({
  criterion,
  level,
  findings,
});

const judged = (
  criterion: CriterionId,
  level: RubricLevel,
  rationale = "because"
): JudgeCriterionResult => ({ criterion, level, evidenceQuote: "…", rationale });

/** A full-marks artifact: detectors on R1/R4/R6, judge on all six. */
const perfect = () =>
  assembleClarityScore(
    [det("R1", 2), det("R4", 2), det("R6", 2)],
    (["R1", "R2", "R3", "R4", "R5", "R6"] as CriterionId[]).map((c) => judged(c, 2))
  );

describe("assembleClarityScore", () => {
  it("scores the full rubric out of 12 when a judge is available", () => {
    const score = perfect();
    expect(score.total).toBe(12);
    expect(score.maxPossible).toBe(12);
    expect(score.isComplete).toBe(true);
    expect(isFullRubric(score)).toBe(true);
  });

  it("lets the judge lower a detector level but never raise it", () => {
    // The ceiling rule. A text can tick every surface feature and still fail to
    // communicate — the judge must be able to say so. The reverse is not true:
    // if the observable feature is absent, no amount of judge enthusiasm
    // restores the level.
    const lowered = assembleClarityScore([det("R1", 2)], [judged("R1", 1, "two competing asks")]);
    expect(lowered.criteria.find((c) => c.criterion === "R1")!.level).toBe(1);

    const cannotRaise = assembleClarityScore([det("R1", 0)], [judged("R1", 2)]);
    expect(cannotRaise.criteria.find((c) => c.criterion === "R1")!.level).toBe(0);
  });

  it("surfaces the judge's rationale only when it deducted", () => {
    const lowered = assembleClarityScore([det("R6", 2)], [judged("R6", 1, "padding survives")]);
    expect(lowered.criteria.find((c) => c.criterion === "R6")!.findings).toContain("padding survives");

    const agreed = assembleClarityScore([det("R6", 2)], [judged("R6", 2, "fine")]);
    expect(agreed.criteria.find((c) => c.criterion === "R6")!.findings).not.toContain("fine");
  });

  it("treats an unjudged criterion as unscored, not as zero", () => {
    // No-AI mode. Averaging in a zero would tell the learner they failed at
    // something nobody assessed.
    const score = assembleClarityScore([det("R1", 2), det("R4", 2), det("R6", 2)], []);
    expect(score.total).toBe(6);
    expect(score.maxPossible).toBe(6);
    expect(score.scoredCount).toBe(3);
    expect(score.unscored.sort()).toEqual(["R2", "R3", "R5"]);
    expect(score.isComplete).toBe(false);
    expect(isFullRubric(score)).toBe(false);
  });

  it("keeps a void response out of the total entirely", () => {
    const score = assembleClarityScore([det("R1", 0)], [], { isVoid: true });
    expect(score.isVoid).toBe(true);
    expect(score.total).toBe(0);
    expect(score.isComplete).toBe(false);
  });

  it("always reports all six criteria, scored or not", () => {
    expect(assembleClarityScore([], []).criteria).toHaveLength(6);
  });
});

describe("atCriterion", () => {
  it("accepts a strong artifact whose own criterion is at level 2", () => {
    expect(atCriterion(perfect(), "c1-ask")).toBe(true);
  });

  it("rejects a strong total when the module's own criterion is weak", () => {
    // A generally good writer must not coast through c4-referents while still
    // leaving referents dangling.
    const score = assembleClarityScore(
      [det("R1", 2), det("R4", 1), det("R6", 2)],
      [judged("R1", 2), judged("R2", 2), judged("R3", 2), judged("R4", 1), judged("R5", 2), judged("R6", 2)]
    );
    expect(score.total).toBe(11);
    expect(atCriterion(score, "c1-ask")).toBe(true);
    expect(atCriterion(score, "c4-referents")).toBe(false);
  });

  it("rejects any artifact with a criterion at zero", () => {
    const score = assembleClarityScore(
      [det("R1", 2), det("R4", 2), det("R6", 2)],
      [judged("R1", 2), judged("R2", 2), judged("R3", 0), judged("R4", 2), judged("R5", 2), judged("R6", 2)]
    );
    expect(atCriterion(score, "c1-ask")).toBe(false);
  });

  it("rejects a partially scored artifact however good it looks", () => {
    const noAi = assembleClarityScore([det("R1", 2), det("R4", 2), det("R6", 2)], []);
    expect(atCriterion(noAi, "c1-ask")).toBe(false);
  });
});

describe("evaluateClarityMastery", () => {
  const attempt = (over: Partial<ScoredClarityAttempt> = {}): ScoredClarityAttempt => ({
    score: perfect(),
    moduleKey: "c1-ask",
    dayKey: "2026-07-27",
    unscaffolded: true,
    ...over,
  });

  it("grants mastery on two clean unscaffolded attempts across two days", () => {
    const verdict = evaluateClarityMastery([
      attempt({ dayKey: "2026-07-27" }),
      attempt({ dayKey: "2026-07-28" }),
    ]);
    expect(verdict.mastered).toBe(true);
  });

  it("refuses mastery earned in a single sitting", () => {
    const verdict = evaluateClarityMastery([attempt(), attempt()]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.join(" ")).toMatch(/required days/);
  });

  it("ignores scaffolded work", () => {
    const verdict = evaluateClarityMastery([
      attempt({ unscaffolded: false }),
      attempt({ unscaffolded: false }),
    ]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.join(" ")).toMatch(/unscaffolded attempts/);
  });

  it("keeps mastery out of reach without the full rubric rather than lowering the bar", () => {
    // Half the rubric — including context and success criteria — is unscored in
    // no-AI mode. Redefining mastery down to what happens to be measurable would
    // hand out mastery of a skill nobody assessed.
    const partial = assembleClarityScore([det("R1", 2), det("R4", 2), det("R6", 2)], []);
    const verdict = evaluateClarityMastery([
      attempt({ score: partial, dayKey: "2026-07-27" }),
      attempt({ score: partial, dayKey: "2026-07-28" }),
    ]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.join(" ")).toMatch(/need a reader/);
  });
});

describe("revisionDelta", () => {
  it("measures improvement from draft to revision", () => {
    const draft = assembleClarityScore(
      [det("R1", 1), det("R4", 1), det("R6", 1)],
      [judged("R1", 1), judged("R2", 1), judged("R3", 1), judged("R4", 1), judged("R5", 1), judged("R6", 1)]
    );
    expect(revisionDelta(draft, perfect())).toBe(6);
  });

  it("refuses to compare scores measured against different rubric coverage", () => {
    const partial = assembleClarityScore([det("R1", 2)], []);
    expect(revisionDelta(partial, perfect())).toBeNull();
  });

  it("returns null when either side is void", () => {
    const voided = assembleClarityScore([], [], { isVoid: true });
    expect(revisionDelta(voided, perfect())).toBeNull();
  });
});

describe("diagnosisAccuracy", () => {
  it("separates correct diagnoses from misses and false alarms", () => {
    const score = assembleClarityScore(
      [det("R1", 1), det("R4", 2), det("R6", 0)],
      [judged("R1", 1), judged("R2", 2), judged("R3", 2), judged("R4", 2), judged("R5", 2), judged("R6", 0)]
    );
    const result = diagnosisAccuracy(["R1", "R3"], score);
    expect(result.correct).toEqual(["R1"]);
    expect(result.missed).toEqual(["R6"]);
    expect(result.spurious).toEqual(["R3"]);
  });
});
