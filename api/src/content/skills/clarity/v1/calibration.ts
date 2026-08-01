/**
 * Judge calibration for clarity rubric v1.
 *
 * A rubric does not fix reliability on its own — even with one, rater agreement
 * can be poor, and autoraters are additionally prompt-sensitive and carry a
 * documented positivity bias. So a criterion is not trusted for *measurement*
 * until the judge has been checked against human scoring on anchored samples.
 *
 * The gate is deliberately per `(criterion, rubricVersion, judgeModelVersion)`:
 * changing any of the three invalidates the evidence. That includes a model
 * upgrade, which is the awkward one — the judge is itself a perishable technique
 * sitting inside a tool about durable skills, so it gets pinned and re-checked
 * rather than trusted.
 *
 * Until a criterion passes, it runs **feedback-only**: the learner still sees a
 * level and a rationale, but it does not enter a probe total.
 *
 * ── How to calibrate ────────────────────────────────────────────────────────
 * 1. Collect ~20 real submissions per criterion spanning all three levels.
 * 2. Two humans score them independently against the level descriptors, then
 *    reconcile every disagreement before any judge output is looked at.
 * 3. Run the judge over the held-out half and record agreement below.
 * 4. Anchors are the reconciled samples; they are also the few-shot examples the
 *    judge sees, which is why they live here and not in the prompt file.
 */

import type { CriterionId } from "../types";

export type CalibrationAnchor = {
  criterion: CriterionId;
  level: 0 | 1 | 2;
  text: string;
  why: string;
};

export type CalibrationRecord = {
  criterion: CriterionId;
  rubricVersion: string;
  judgeModelVersion: string;
  /** Exact agreement with the reconciled human score, 0–1. */
  agreement: number;
  sampleSize: number;
  passedAt: string;
};

/** Below this, the criterion stays feedback-only. */
export const AGREEMENT_THRESHOLD = 0.8;
export const MIN_CALIBRATION_SAMPLE = 20;

/**
 * Empty on purpose. Nothing has been calibrated yet, so every judge-scored
 * criterion is currently feedback-only and clarity probes cannot produce a
 * measurement-grade total. That is the honest state, and the API reports it
 * rather than quietly scoring anyway.
 */
export const CALIBRATION_RECORDS: CalibrationRecord[] = [];

/**
 * Few-shot anchors. These are the seed set written alongside the rubric; the
 * calibration pass replaces them with reconciled real submissions.
 */
export const ANCHORS: CalibrationAnchor[] = [
  {
    criterion: "R1",
    level: 2,
    text: "Find why CSV export is slow and tell me the cause. Since the migration, exports over 10k rows time out; other formats are fine.",
    why: "One request, first sentence, phrased as a request.",
  },
  {
    criterion: "R1",
    level: 0,
    text: "The export has been slow since the migration and support has had a few complaints about it.",
    why: "States a situation. Never asks for anything.",
  },
  {
    criterion: "R2",
    level: 2,
    text: "Write an incident summary — under 400 words, as timeline / cause / fix — for engineers who weren't on call. Don't include remediation planning.",
    why: "Kind, plus length and structure, plus an explicit out-of-scope.",
  },
  {
    criterion: "R2",
    level: 1,
    text: "Write me a summary of the incident for the team.",
    why: "Kind named; no format, length, or scope bound.",
  },
  {
    criterion: "R3",
    level: 2,
    text: "Why does auth.integration.test.ts fail only in CI? Passes locally on Node 22; CI is Node 20. Started after the token-expiry test. Clock skew already ruled out.",
    why: "Every required slot present, nothing that does not constrain the answer.",
  },
  {
    criterion: "R3",
    level: 0,
    text: "Why is the test failing?",
    why: "No inputs, no constraints, no prior attempts.",
  },
  {
    criterion: "R5",
    level: 2,
    text: "Rewrite the onboarding docs so a new engineer runs the app locally without asking anyone. Success: someone who has never seen the repo hits no undocumented step.",
    why: "A third party could apply the test and get a yes or no.",
  },
  {
    criterion: "R5",
    level: 1,
    text: "Make the onboarding docs clearer and more useful for new people.",
    why: "A criterion is gestured at but cannot be checked by anyone else.",
  },
];

export function anchorsFor(criterion: CriterionId): CalibrationAnchor[] {
  return ANCHORS.filter((a) => a.criterion === criterion);
}

export function isCalibrated(
  criterion: CriterionId,
  rubricVersion: string,
  judgeModelVersion: string
): boolean {
  return CALIBRATION_RECORDS.some(
    (r) =>
      r.criterion === criterion &&
      r.rubricVersion === rubricVersion &&
      r.judgeModelVersion === judgeModelVersion &&
      r.agreement >= AGREEMENT_THRESHOLD &&
      r.sampleSize >= MIN_CALIBRATION_SAMPLE
  );
}
