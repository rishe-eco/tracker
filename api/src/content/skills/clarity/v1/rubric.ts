/**
 * Clarity rubric v1 — the observable-feature analytic rubric.
 *
 * Analytic rather than holistic: rating separate dimensions and summing places
 * performance on a more clearly defined scale and tracks achievement more
 * reliably than a single overall impression. Six criteria is the top of the 4–6
 * band where marking stays consistent — fewer and the feedback stops being
 * targeted, more and rater agreement degrades.
 *
 * Every level below is a **decision rule about something a rater can point at**.
 * That is the whole design constraint: scoring gets measurably more consistent
 * when criteria describe observable features ("does the primary ask appear in
 * the first two sentences?") instead of impressions ("was this clear?").
 *
 * ⚠️ Changing any level descriptor is a `rubricVersion` bump, and invalidates
 * the judge calibration for that criterion. Totals from different rubric
 * versions are never charted on one line.
 */

import type { ClarityModuleKey, CriterionId, RubricCriterion, RubricLevel } from "../types";

export const RUBRIC_VERSION = "clarity-rubric/v1";

export const MAX_LEVEL: RubricLevel = 2;
export const RUBRIC_MAX_TOTAL = 12;

export const RUBRIC: RubricCriterion[] = [
  {
    id: "R1",
    moduleKey: "c1-ask",
    // The position of a request is countable; which of two competing asks is
    // primary sometimes isn't.
    scoredBy: "both",
    labelKey: "skills.rubric.R1",
    levels: {
      0: "No identifiable request, or the reader must infer what is being asked for.",
      1: "A request is present but appears after the second sentence, or two or more co-equal requests are made with no stated priority.",
      2: "Exactly one primary request, identifiable within the first two sentences, phrased as a request.",
    },
  },
  {
    id: "R2",
    moduleKey: "c2-deliverable",
    scoredBy: "judge",
    labelKey: "skills.rubric.R2",
    levels: {
      0: "The form of the output is not stated.",
      1: "A kind of output is named (\"a summary\") but no format, length, or scope bound is given.",
      2: "A kind of output plus at least two of {format, length, scope, structure}, and at least one statement of what is out of scope.",
    },
  },
  {
    id: "R3",
    moduleKey: "c3-context",
    scoredBy: "judge",
    labelKey: "skills.rubric.R3",
    levels: {
      0: "None of the context the task requires is supplied.",
      1: "Some required context is supplied; at least one slot the task demonstrably needs is missing.",
      2: "Every context slot the item marks as required is supplied, with no more than one slot of unrequired material.",
    },
  },
  {
    id: "R4",
    moduleKey: "c4-referents",
    scoredBy: "both",
    labelKey: "skills.rubric.R4",
    levels: {
      0: "Two or more unbound referents, or undefined terms the reader cannot resolve.",
      1: "Exactly one unbound referent or unbounded quantifier.",
      2: "No unbound pronouns or demonstratives; domain terms defined or unambiguous in context; quantifiers numeric or bounded.",
    },
  },
  {
    id: "R5",
    moduleKey: "c5-done",
    scoredBy: "judge",
    labelKey: "skills.rubric.R5",
    levels: {
      0: "No statement of how the result will be judged.",
      1: "Criteria are stated but are not checkable (\"make it good\", \"clear and useful\").",
      2: "At least one criterion a third party could apply to the output and get a yes or no, or an explicit statement of what would make the answer wrong.",
    },
  },
  {
    id: "R6",
    moduleKey: "c6-economy",
    scoredBy: "both",
    labelKey: "skills.rubric.R6",
    levels: {
      0: "The load-bearing constraint appears last or is buried in a subordinate clause, and two or more sentences add no constraint, input, or criterion.",
      1: "One of those two faults.",
      2: "The load-bearing constraint appears in the first third; every sentence adds a constraint, an input, or a criterion; grammatical subjects are the actors and verbs are the actions.",
    },
  },
];

export const CRITERION_BY_ID = new Map(RUBRIC.map((c) => [c.id, c]));

/**
 * Module → the criterion it trains. The 1:1 mapping is deliberate: feedback, the
 * module and the score share one vocabulary, and mastery requires level 2 on a
 * module's *own* criterion so a globally strong writer can't coast through `c4`
 * while still leaving referents dangling.
 */
export const RUBRIC_CRITERIA_BY_MODULE = Object.fromEntries(
  RUBRIC.map((c) => [c.moduleKey, c.id])
) as Record<ClarityModuleKey, CriterionId>;

/** Criteria a detector can score without any model. */
export const DETECTOR_CRITERIA: CriterionId[] = RUBRIC.filter(
  (c) => c.scoredBy === "detector" || c.scoredBy === "both"
).map((c) => c.id);

/** Criteria that have no honest heuristic and need a reader. */
export const JUDGE_ONLY_CRITERIA: CriterionId[] = RUBRIC.filter((c) => c.scoredBy === "judge").map(
  (c) => c.id
);

/**
 * Persian scoring routes R4 and R6 to the judge instead of the detector.
 *
 * The English detectors for those two do not port and should not be faked:
 * Persian is pro-drop, so "unbound pronoun" is a different question entirely;
 * ezāfe chains and اسم‌مصدر nominalisation need their own analysis; and R6's
 * front-loading test interacts with word order. Building a Persian
 * morphological analyser to serve two criteria is not a good trade — the judge
 * handles Persian well, and the score cache preserves reproducibility of
 * result even though the method differs.
 *
 * The cost is recorded per attempt in `scoredBy`, so an `en` detector-scored
 * criterion and a `fa` judge-scored one are never silently pooled.
 */
/**
 * Which criteria a locale can score without a reader.
 *
 * `fa` is empty, and that is a statement about the detectors rather than about
 * Persian. They tokenise through an `[a-z]` class, so Persian text reduces to
 * nothing and R1 returned a confident 0/2 — "No identifiable request", in
 * English, on a sentence opening with an explicit imperative. R1 was listed here
 * because the *criterion* ports; the implementation does not.
 *
 * Restoring it means authoring Persian detectors (see the note in
 * `services/skills/clarity/detectors.ts`), not re-adding the entry.
 */
export const DETECTOR_CRITERIA_BY_LOCALE: Record<string, CriterionId[]> = {
  en: ["R1", "R4", "R6"],
  fa: [],
};

export function detectorCriteriaFor(locale: string): CriterionId[] {
  return DETECTOR_CRITERIA_BY_LOCALE[locale] ?? DETECTOR_CRITERIA_BY_LOCALE.en;
}
