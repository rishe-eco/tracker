import { describe, expect, it, vi } from "vitest";
import type { CriterionId, RubricLevel } from "../content/skills/clarity/types";
import {
  buildSystemPrompt,
  buildUserPrompt,
  calibrationStatus,
  quoteIsGrounded,
  scoreCriteria,
  type JudgeProvider,
} from "../services/skills/clarity/judge";
import { RUBRIC_VERSION } from "../content/skills/clarity/v1/rubric";
import { createAnthropicJudge } from "../services/skills/clarity/anthropicJudge";

const SUBMISSION =
  "Find why CSV export is slow and tell me the cause. Since the migration, exports over 10k rows time out.";

const base = { submission: SUBMISSION, scenario: "Ask for help with a slow export." };

function mockProvider(
  impl: (criterion: CriterionId) => { level: RubricLevel; evidenceQuote: string; rationale: string },
  modelVersion = "mock-model/1"
): JudgeProvider {
  return { modelVersion, score: async (req) => impl(req.criterion) };
}

describe("prompt construction", () => {
  it("keeps the rubric and anchors in the stable half", () => {
    // Identical for every criterion and learner — that is what makes the cached
    // prefix worth having.
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b);
    expect(a).toContain("RUBRIC");
    expect(a).toContain("ANCHORED EXAMPLES");
    expect(a).not.toContain(SUBMISSION);
  });

  it("puts the criterion and the submission in the varying half", () => {
    const prompt = buildUserPrompt({ criterion: "R3", ...base, requiredSlots: ["audience", "input"] });
    expect(prompt).toContain("R3");
    expect(prompt).toContain(SUBMISSION);
    expect(prompt).toContain("audience, input");
  });

  it("only mentions required context slots for R3", () => {
    const prompt = buildUserPrompt({ criterion: "R1", ...base, requiredSlots: ["audience"] });
    expect(prompt).not.toContain("Context this task requires");
  });
});

describe("quoteIsGrounded", () => {
  it("accepts a verbatim span and rejects an invented one", () => {
    expect(quoteIsGrounded("exports over 10k rows time out", SUBMISSION)).toBe(true);
    expect(quoteIsGrounded("the user requested a detailed analysis", SUBMISSION)).toBe(false);
  });

  it("tolerates whitespace and quote-mark differences", () => {
    expect(quoteIsGrounded('  "Find why CSV export is slow"  ', SUBMISSION)).toBe(true);
  });

  it("rejects an empty quote", () => {
    expect(quoteIsGrounded("", SUBMISSION)).toBe(false);
  });
});

describe("scoreCriteria", () => {
  it("scores criteria whose evidence is grounded", async () => {
    const provider = mockProvider(() => ({
      level: 2,
      evidenceQuote: "Find why CSV export is slow",
      rationale: "One request, first sentence.",
    }));

    const outcome = await scoreCriteria(provider, ["R2", "R3"], base, {
      mode: "practice",
      rubricVersion: RUBRIC_VERSION,
    });
    expect(outcome.scored.map((s) => s.criterion)).toEqual(["R2", "R3"]);
    expect(outcome.failed).toEqual([]);
  });

  it("retries once, then drops a level it cannot evidence", async () => {
    // An unevidenced number is worse than no number: it looks like a
    // measurement and isn't one.
    const score = vi.fn(async () => ({
      level: 2 as RubricLevel,
      evidenceQuote: "a sentence the learner never wrote",
      rationale: "trust me",
    }));
    const outcome = await scoreCriteria({ modelVersion: "mock", score }, ["R2"], base, {
      mode: "practice",
      rubricVersion: RUBRIC_VERSION,
    });

    expect(score).toHaveBeenCalledTimes(2);
    expect(outcome.scored).toEqual([]);
    expect(outcome.failed[0].reason).toMatch(/no grounded evidence quote/);
  });

  it("recovers when the retry produces a grounded quote", async () => {
    let call = 0;
    const provider: JudgeProvider = {
      modelVersion: "mock",
      score: async () => {
        call++;
        return call === 1
          ? { level: 2 as RubricLevel, evidenceQuote: "invented", rationale: "x" }
          : { level: 1 as RubricLevel, evidenceQuote: "10k rows time out", rationale: "y" };
      },
    };
    const outcome = await scoreCriteria(provider, ["R5"], base, {
      mode: "practice",
      rubricVersion: RUBRIC_VERSION,
    });
    expect(outcome.scored).toHaveLength(1);
    expect(outcome.scored[0].level).toBe(1);
  });

  it("keeps uncalibrated criteria out of probe totals but still shows them", async () => {
    // Nothing is calibrated yet, so every judge criterion is feedback-only in a
    // probe. The learner still gets a level and a rationale; the number just
    // doesn't enter a measurement.
    const provider = mockProvider(() => ({
      level: 2,
      evidenceQuote: "Find why CSV export is slow",
      rationale: "ok",
    }));

    const probe = await scoreCriteria(provider, ["R2", "R3", "R5"], base, {
      mode: "probe",
      rubricVersion: RUBRIC_VERSION,
    });
    expect(probe.scored).toEqual([]);
    expect(probe.feedbackOnly).toHaveLength(3);
    expect(probe.feedbackOnly[0].reason).toMatch(/not yet calibrated/);

    // Practice is not measurement, so the same levels count there.
    const practice = await scoreCriteria(provider, ["R2", "R3", "R5"], base, {
      mode: "practice",
      rubricVersion: RUBRIC_VERSION,
    });
    expect(practice.scored).toHaveLength(3);
    expect(practice.feedbackOnly).toEqual([]);
  });

  it("records a provider error rather than inventing a level", async () => {
    const provider: JudgeProvider = {
      modelVersion: "mock",
      score: async () => {
        throw new Error("rate limited");
      },
    };
    const outcome = await scoreCriteria(provider, ["R2"], base, {
      mode: "practice",
      rubricVersion: RUBRIC_VERSION,
    });
    expect(outcome.scored).toEqual([]);
    expect(outcome.failed[0].reason).toBe("rate limited");
  });

  it("reports which model produced the levels", async () => {
    const provider = mockProvider(
      () => ({ level: 1, evidenceQuote: "10k rows", rationale: "r" }),
      "claude-opus-5"
    );
    const outcome = await scoreCriteria(provider, ["R2"], base, {
      mode: "practice",
      rubricVersion: RUBRIC_VERSION,
    });
    expect(outcome.modelVersion).toBe("claude-opus-5");
  });
});

describe("calibrationStatus", () => {
  it("reports everything uncalibrated until a calibration pass is run", () => {
    const status = calibrationStatus(RUBRIC_VERSION, "claude-opus-5");
    expect(status.anyCalibrated).toBe(false);
    expect(status.uncalibrated).toHaveLength(6);
  });
});

describe("createAnthropicJudge", () => {
  it("returns null with no credential, which is a supported state", () => {
    const key = process.env.ANTHROPIC_API_KEY;
    const token = process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    try {
      expect(createAnthropicJudge({ mode: "practice" })).toBeNull();
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });
});
