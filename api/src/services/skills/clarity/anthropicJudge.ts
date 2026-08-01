/**
 * Anthropic-backed judge provider.
 *
 * Prompt shape is the whole cost story. The rubric, scoring rules and anchors
 * are byte-identical for every criterion, every learner and every attempt, so
 * they sit in `system` behind a cache breakpoint; only the criterion
 * instruction and the learner's text vary, and those go in the user turn after
 * it. Cache reads bill at roughly a tenth of input, which is what puts a
 * fully-judged six-criterion artifact in the single-digit cents.
 *
 * The 1-hour TTL is deliberate: this is bursty, low-traffic usage — a learner
 * does one session then nothing for days — so a 5-minute cache would be cold on
 * essentially every session. The doubled write cost is worth paying once per
 * sitting.
 *
 * Sampling parameters are **not** set. `temperature`, `top_p` and `top_k` are
 * rejected on Claude Opus 5 and Sonnet 5 and return a 400.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { RubricLevel } from "../../../content/skills/clarity/types";
import {
  buildSystemPrompt,
  buildUserPrompt,
  JUDGE_MODEL_PRACTICE,
  JUDGE_MODEL_PROBE,
  JUDGE_OUTPUT_SCHEMA,
  type JudgeMode,
  type JudgeProvider,
  type JudgeRequest,
} from "./judge";

/** Headroom for adaptive thinking plus a short structured answer. */
const MAX_TOKENS = 3000;

type JudgePayload = { level: RubricLevel; evidenceQuote: string; rationale: string };

function parsePayload(raw: string): JudgePayload {
  const parsed = JSON.parse(raw);
  if (![0, 1, 2].includes(parsed.level)) throw new Error(`Judge returned level ${parsed.level}.`);
  return {
    level: parsed.level as RubricLevel,
    evidenceQuote: String(parsed.evidenceQuote ?? ""),
    rationale: String(parsed.rationale ?? ""),
  };
}

export type AnthropicJudgeOptions = {
  mode: JudgeMode;
  /** Overrides the pinned default. Recorded per attempt, so changing it is visible. */
  model?: string;
  onUsage?: (usage: { cacheRead: number; cacheWrite: number; input: number; output: number }) => void;
};

/**
 * Returns `null` when no credential is configured, which is a supported state
 * rather than an error: the detectors still score R1/R4/R6, and the tool says
 * plainly that three criteria need a reader.
 */
export function createAnthropicJudge(opts: AnthropicJudgeOptions): JudgeProvider | null {
  const hasCredential = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!hasCredential) return null;

  const client = new Anthropic();
  const model = opts.model ?? (opts.mode === "probe" ? JUDGE_MODEL_PROBE : JUDGE_MODEL_PRACTICE);
  // Probe scoring is worth more deliberation than a practice hint.
  const effort = opts.mode === "probe" ? "medium" : "low";

  return {
    modelVersion: model,
    async score(request: JudgeRequest): Promise<JudgePayload> {
      const response = await client.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: buildSystemPrompt(),
            cache_control: { type: "ephemeral", ttl: "1h" },
          },
        ],
        output_config: { effort, format: { type: "json_schema", schema: JUDGE_OUTPUT_SCHEMA } },
        messages: [{ role: "user", content: buildUserPrompt(request) }],
      } as any);

      const usage: any = (response as any).usage ?? {};
      opts.onUsage?.({
        cacheRead: usage.cache_read_input_tokens ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0,
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
      });

      const text = ((response as any).content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();

      if (!text) throw new Error("Judge returned no text — check stop_reason and max_tokens headroom.");
      return parsePayload(text);
    },
  };
}
