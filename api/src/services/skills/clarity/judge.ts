/**
 * The clarity judge.
 *
 * Scores the three rubric criteria that have no honest heuristic (R2, R3, R5),
 * and re-checks the three the detectors cap (R1, R4, R6). Everything here is
 * shaped by the finding that autoraters are prompt-sensitive and biased
 * positive, so the design fights the rater rather than trusting it:
 *
 * - **One call per criterion.** There is no holistic "how clear was this?"
 *   anywhere in the system; a single overall score is exactly the thing analytic
 *   rubrics exist to replace.
 * - **A level requires a quote.** The judge must cite the learner's own words.
 *   A level whose quote isn't actually in the submission is rejected and retried,
 *   then dropped — an unevidenced number is worse than no number.
 * - **The judge is blind to the learner.** No history, no prior scores, no
 *   self-report. Nothing to anchor on but the text in front of it.
 * - **Uncalibrated criteria are feedback-only.** They produce a level the
 *   learner can read and no number that enters a probe total.
 *
 * ⚠️ Note for anyone porting the older spec: it called for `temperature: 0`.
 * That is not available — sampling parameters are rejected outright on Claude
 * Opus 5 and Sonnet 5 and return a 400. Reproducibility comes from
 * per-attempt immutability instead (see `scoreCriteria`), not from sampling.
 */

import type { CriterionId, RubricLevel } from "../../../content/skills/clarity/types";
import { CRITERION_BY_ID, RUBRIC } from "../../../content/skills/clarity/v1/rubric";
import { anchorsFor, isCalibrated } from "../../../content/skills/clarity/v1/calibration";
import type { JudgeCriterionResult } from "./scoring";

/** Probe-grade scoring; practice can run cheaper. */
export const JUDGE_MODEL_PROBE = "claude-opus-5";
export const JUDGE_MODEL_PRACTICE = "claude-sonnet-5";

export type JudgeMode = "probe" | "practice";

export type JudgeRequest = {
  criterion: CriterionId;
  submission: string;
  /** The task the learner was answering — needed to judge R3 at all. */
  scenario: string;
  /** Context slots the item marks required. Only meaningful for R3. */
  requiredSlots?: string[];
};

export interface JudgeProvider {
  readonly modelVersion: string;
  score(request: JudgeRequest): Promise<{
    level: RubricLevel;
    evidenceQuote: string;
    rationale: string;
  }>;
}

export type JudgeOutcome = {
  /** Levels that may enter a total. */
  scored: JudgeCriterionResult[];
  /** Levels shown to the learner but withheld from measurement. */
  feedbackOnly: (JudgeCriterionResult & { reason: string })[];
  /** Criteria the judge could not evidence, or that errored. */
  failed: { criterion: CriterionId; reason: string }[];
  modelVersion: string;
};

/**
 * The stable half of the prompt: rubric, scoring rules, anchors. Identical for
 * every criterion, every learner and every attempt, which is exactly the shape
 * prompt caching wants — it goes in `system` behind a cache breakpoint, and the
 * varying half (criterion instruction + submission) goes in the user turn.
 */
export function buildSystemPrompt(): string {
  const criteria = RUBRIC.map(
    (c) =>
      `${c.id} — ${c.levels[2]}\n  Level 1: ${c.levels[1]}\n  Level 0: ${c.levels[0]}`
  ).join("\n\n");

  const anchors = RUBRIC.flatMap((c) =>
    anchorsFor(c.id).map((a) => `${a.criterion} · level ${a.level}\n  "${a.text}"\n  → ${a.why}`)
  ).join("\n\n");

  return [
    "You are scoring one criterion of an analytic writing rubric. The text you are given is a request a person wrote for an AI assistant.",
    "",
    "Score only the criterion you are asked about. Ignore every other dimension of quality — a text can be excellent and still score 0 on the criterion in front of you.",
    "",
    "Apply the level descriptors literally. They describe observable features, not impressions. Do not reward effort, politeness, or apparent good intent.",
    "",
    "You must quote the learner's own words as evidence. The quote must appear verbatim in their text. If you cannot find evidence for the level you want to give, give the lower level.",
    "",
    "RUBRIC",
    criteria,
    "",
    "ANCHORED EXAMPLES",
    anchors,
  ].join("\n");
}

export function buildUserPrompt(request: JudgeRequest): string {
  const definition = CRITERION_BY_ID.get(request.criterion);
  const slots =
    request.criterion === "R3" && request.requiredSlots?.length
      ? `\n\nContext this task requires: ${request.requiredSlots.join(", ")}.`
      : "";

  return [
    `Criterion to score: ${request.criterion}.`,
    definition ? `Level 2 means: ${definition.levels[2]}` : "",
    `\nThe task the learner was given:\n${request.scenario}${slots}`,
    `\nThe learner's text:\n"""\n${request.submission}\n"""`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const JUDGE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    level: { type: "integer", enum: [0, 1, 2] },
    evidenceQuote: {
      type: "string",
      description: "A verbatim span from the learner's text justifying the level. Empty only if the text is empty.",
    },
    rationale: { type: "string", description: "One sentence, referring to the level descriptor." },
  },
  required: ["level", "evidenceQuote", "rationale"],
  additionalProperties: false,
} as const;

/** A quote the learner did not write is not evidence. */
export function quoteIsGrounded(quote: string, submission: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/[\s"'`]+/g, " ").trim();
  const q = normalise(quote);
  if (q.length < 3) return false;
  return normalise(submission).includes(q);
}

/**
 * Score a set of criteria.
 *
 * Reproducibility note: a learner cannot resubmit an attempt (the mutation
 * rejects it), so a scored artifact is written once and never rescored. That —
 * not sampling configuration — is what guarantees they never see two different
 * numbers for the same text.
 */
export async function scoreCriteria(
  provider: JudgeProvider,
  criteria: CriterionId[],
  base: Omit<JudgeRequest, "criterion">,
  opts: { mode: JudgeMode; rubricVersion: string }
): Promise<JudgeOutcome> {
  const scored: JudgeCriterionResult[] = [];
  const feedbackOnly: (JudgeCriterionResult & { reason: string })[] = [];
  const failed: { criterion: CriterionId; reason: string }[] = [];

  for (const criterion of criteria) {
    const request: JudgeRequest = { ...base, criterion };
    let result: Awaited<ReturnType<JudgeProvider["score"]>> | null = null;

    for (let attempt = 0; attempt < 2 && result === null; attempt++) {
      try {
        const candidate = await provider.score(request);
        if (quoteIsGrounded(candidate.evidenceQuote, base.submission)) {
          result = candidate;
        }
      } catch (e: any) {
        if (attempt === 1) failed.push({ criterion, reason: e?.message ?? "judge error" });
      }
    }

    if (!result) {
      if (!failed.some((f) => f.criterion === criterion)) {
        failed.push({ criterion, reason: "no grounded evidence quote after retry" });
      }
      continue;
    }

    const entry: JudgeCriterionResult = {
      criterion,
      level: result.level,
      evidenceQuote: result.evidenceQuote,
      rationale: result.rationale,
    };

    // Practice is not measurement, so an uncalibrated criterion is still useful
    // there. A probe total is measurement, and an uncalibrated number in it
    // would be a wrong number wearing a decimal point.
    if (opts.mode === "probe" && !isCalibrated(criterion, opts.rubricVersion, provider.modelVersion)) {
      feedbackOnly.push({
        ...entry,
        reason: `${criterion} is not yet calibrated for ${provider.modelVersion} on ${opts.rubricVersion}.`,
      });
      continue;
    }

    scored.push(entry);
  }

  return { scored, feedbackOnly, failed, modelVersion: provider.modelVersion };
}

/** Which judge-scored criteria would count right now, for honest UI messaging. */
export function calibrationStatus(rubricVersion: string, modelVersion: string) {
  const all = RUBRIC.map((c) => c.id);
  const calibrated = all.filter((id) => isCalibrated(id, rubricVersion, modelVersion));
  return {
    calibrated,
    uncalibrated: all.filter((id) => !calibrated.includes(id)),
    anyCalibrated: calibrated.length > 0,
  };
}
