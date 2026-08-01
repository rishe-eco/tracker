/**
 * Deterministic clarity detectors — R1, R4, R6.
 *
 * These are heuristics over surface features, and they are honest about being
 * heuristics. They exist for two reasons:
 *
 * 1. **They make no-AI mode real.** Half the rubric scores with no model, no key
 *    and no network, which is the difference between a degraded tool and a
 *    broken one.
 * 2. **They are the ceiling, not the score.** A detector can tell that the
 *    observable feature is *absent* — no imperative in the first two sentences,
 *    a dangling demonstrative, four sentences that constrain nothing. It cannot
 *    tell that a text which passes every surface check still fails to
 *    communicate. So the detector caps the level and the judge may only lower
 *    it. Necessary, never sufficient — which is also what stops learners
 *    scoring well by writing to the detector.
 *
 * English only. The Persian equivalents are not ports: pro-drop, ezāfe chains
 * and اسم‌مصدر nominalisation make R4 and R6 different questions, so `fa` routes
 * those two to the judge instead (rubric.ts → DETECTOR_CRITERIA_BY_LOCALE).
 */

import type { CriterionId, RubricLevel } from "../../../content/skills/clarity/types";

export type DetectorResult = {
  criterion: CriterionId;
  level: RubricLevel;
  /** Quotable specifics, so feedback can point rather than assert. */
  findings: string[];
};

// ─── Lexicons ───────────────────────────────────────────────────────────────

/** Verbs that carry a primary request. */
const PRIMARY_REQUEST_VERBS = new Set([
  "write", "create", "draft", "build", "make", "generate", "produce",
  "review", "check", "audit", "assess", "evaluate", "compare", "analyse", "analyze",
  "explain", "summarise", "summarize", "describe", "outline", "list",
  "fix", "debug", "repair", "resolve", "refactor", "optimise", "optimize", "rewrite",
  "find", "identify", "investigate", "diagnose", "figure", "work",
  "add", "remove", "update", "change", "implement", "design", "plan",
  "translate", "convert", "migrate", "extract", "tell", "give", "show", "help",
]);

/**
 * Verbs that *support* a request rather than being one. Without this split the
 * detector reads "Write X. Include Y." as two co-equal asks and marks down a
 * request that is actually well formed.
 */
const SUPPORTING_VERBS = new Set([
  "include", "exclude", "use", "avoid", "keep", "ensure", "focus", "prioritise",
  "prioritize", "ignore", "skip", "note", "assume", "prefer", "aim", "start",
  "stick", "leave", "treat", "consider", "don't", "dont", "do",
]);

const LEADING_FILLERS = new Set(["please", "also", "then", "and", "so", "but", "just", "maybe", "perhaps"]);

/** Quantities that feel precise from the inside and carry almost nothing out. */
const VAGUE_QUANTIFIERS = [
  "a few", "a bit", "a couple", "a lot", "some of", "several", "various", "multiple",
  "soon", "shortly", "asap", "at some point", "when you get a chance", "as needed",
  "reasonable", "reasonably", "appropriate", "appropriately", "generally", "roughly right",
];

/** Comparatives that name a direction and hide the target. */
const BARE_COMPARATIVES = ["better", "faster", "cleaner", "nicer", "simpler", "shorter", "quicker", "smaller"];

/** Words whose presence means a sentence constrains something. */
const CONSTRAINT_MARKERS = [
  "must", "should", "need", "needs", "required", "at most", "at least", "no more than",
  "under", "over", "within", "only", "don't", "do not", "avoid", "exclude", "ignore",
  "instead of", "rather than", "so that", "success", "done when", "fails if", "wrong if",
];

const FORMAT_TOKENS = [
  "json", "csv", "yaml", "markdown", "md", "table", "bullet", "bullets", "list",
  "words", "lines", "pages", "slide", "slides", "paragraph", "paragraphs", "sentence",
  "sentences", "diagram", "prose", "summary", "column", "columns",
];

/** Pure scaffolding — polite, and constraining nothing. */
const PADDING_MARKERS = [
  "hope", "thanks", "thank you", "let me know", "no rush", "just wondering",
  "sorry", "quick question", "when you get a chance", "makes sense", "your thoughts",
  "been thinking", "wanted to", "reach out", "if that's ok", "if possible",
];

/** Empty verbs that pair with a nominalised action. */
const WEAK_VERBS = ["perform", "performance", "provide", "provision", "conduct", "undertake", "carry out", "make", "do", "give"];
const NOMINALISATION = /\b\w{4,}(tion|sion|ment|ance|ence|ity)\b/gi;

// ─── Text utilities ─────────────────────────────────────────────────────────

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|(?<=\n)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstWord(sentence: string): string {
  const tokens = sentence.toLowerCase().replace(/[^a-z'\s]/g, " ").trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length && LEADING_FILLERS.has(tokens[i])) i++;
  return tokens[i] ?? "";
}

const contains = (haystack: string, needles: string[]) =>
  needles.filter((n) => haystack.includes(n));

// ─── R1 · Ask placement and singularity ─────────────────────────────────────

export function detectR1(text: string): DetectorResult {
  const sentences = splitSentences(text);
  const findings: string[] = [];
  const askIndices: number[] = [];

  sentences.forEach((sentence, i) => {
    const lower = sentence.toLowerCase();
    const head = firstWord(sentence);

    const isInterrogative = sentence.trim().endsWith("?");
    const isImperative = PRIMARY_REQUEST_VERBS.has(head);
    const isModalRequest =
      /\b(can|could|would|will)\s+you\b/.test(lower) ||
      /\bi(?:'d| would)?\s+(?:need|want|like)\s+you\s+to\b/.test(lower) ||
      /\bi\s+need\s+(?:a|an|the)\b/.test(lower);

    // A supporting verb heading a sentence is a constraint on the ask, not a
    // second ask.
    if (SUPPORTING_VERBS.has(head) && !isInterrogative && !isModalRequest) return;

    if (isInterrogative || isImperative || isModalRequest) askIndices.push(i);
  });

  if (askIndices.length === 0) {
    return {
      criterion: "R1",
      level: 0,
      findings: ["No identifiable request — the reader has to infer what is being asked for."],
    };
  }

  const first = askIndices[0];
  if (first > 1) {
    findings.push(
      `The request arrives in sentence ${first + 1}; a reader frames everything before it as the point.`
    );
  }
  if (askIndices.length > 1) {
    findings.push(`${askIndices.length} separate requests, with no stated priority between them.`);
  }

  const level: RubricLevel = findings.length === 0 ? 2 : 1;
  return { criterion: "R1", level, findings };
}

// ─── R4 · Referent resolution ───────────────────────────────────────────────

export function detectR4(text: string): DetectorResult {
  const sentences = splitSentences(text);
  const findings: string[] = [];
  const lower = text.toLowerCase();

  // A demonstrative with no noun attached. Approximated by what *follows* it:
  // punctuation, or a verb/function word, means nothing was named.
  const bareDemonstrative = /\b(this|that|these|those)\b(?=\s*[.,;:!?]|\s+(is|are|was|were|so|and|to|for|in|when|because|but|should|would|will|can|could|might|may)\b|$)/gi;
  for (const match of text.matchAll(bareDemonstrative)) {
    findings.push(`"${match[0]}" points at nothing named — attach the noun.`);
  }

  // A pronoun with nothing behind it to refer to. Only the opening sentence,
  // and only when nothing nameable precedes it — "Update the CSV exporter so it
  // accepts…" is perfectly bound, and flagging it would punish good writing.
  if (sentences.length > 0) {
    const openingPronoun = /\b(it|they|them)\b/gi;
    for (const match of sentences[0].matchAll(openingPronoun)) {
      const preceding = sentences[0].slice(0, match.index);
      const namesSomething =
        /\b(the|a|an|our|your|my|its|their)\s+\w+/i.test(preceding) ||
        /`[^`]+`/.test(preceding) ||
        /\s[A-Z][a-zA-Z]+/.test(preceding);
      if (!namesSomething) {
        findings.push(`"${match[0]}" has no antecedent — nothing before it has been named.`);
      }
    }
  }

  for (const q of contains(lower, VAGUE_QUANTIFIERS)) {
    findings.push(`"${q}" is unbounded — give a number or a range.`);
  }

  // A comparative is only vague when no target is anywhere near it.
  const hasNumber = /\d/.test(text);
  if (!hasNumber) {
    for (const c of BARE_COMPARATIVES) {
      if (new RegExp(`\\b${c}\\b`).test(lower)) {
        findings.push(`"${c}" names a direction and hides the target.`);
      }
    }
  }

  const level: RubricLevel = findings.length === 0 ? 2 : findings.length === 1 ? 1 : 0;
  return { criterion: "R4", level, findings };
}

// ─── R6 · Economy and order ─────────────────────────────────────────────────

export function detectR6(text: string): DetectorResult {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return { criterion: "R6", level: 0, findings: ["Empty."] };

  const findings: string[] = [];
  const askIndices = new Set<number>();
  const r1 = detectR1(text);
  if (r1.level > 0) {
    sentences.forEach((s, i) => {
      const head = firstWord(s);
      if (PRIMARY_REQUEST_VERBS.has(head) || s.trim().endsWith("?")) askIndices.add(i);
    });
  }

  const constrains = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    return (
      /\d/.test(sentence) ||
      /`[^`]+`/.test(sentence) ||
      contains(lower, CONSTRAINT_MARKERS).length > 0 ||
      FORMAT_TOKENS.some((f) => new RegExp(`\\b${f}\\b`).test(lower))
    );
  });

  const emptySentences: string[] = [];
  sentences.forEach((sentence, i) => {
    if (constrains[i] || askIndices.has(i)) return;
    emptySentences.push(sentence);
  });

  if (emptySentences.length >= 2) {
    findings.push(
      `${emptySentences.length} sentences add no constraint, input, or criterion — e.g. "${emptySentences[0]}"`
    );
  } else if (emptySentences.length === 1) {
    const lower = emptySentences[0].toLowerCase();
    // A single sentence is only worth flagging when it's plainly scaffolding.
    if (contains(lower, PADDING_MARKERS).length > 0) {
      findings.push(`"${emptySentences[0]}" is scaffolding — it constrains nothing.`);
    }
  }

  const firstConstraint = constrains.findIndex(Boolean);
  const firstThird = Math.max(1, Math.ceil(sentences.length / 3));
  if (firstConstraint === -1) {
    findings.push("Nothing in the request constrains the answer.");
  } else if (firstConstraint >= firstThird) {
    findings.push(
      `The first real constraint appears in sentence ${firstConstraint + 1} of ${sentences.length} — front-load it.`
    );
  }

  // Williams's test, approximated: actions packed into nouns beside empty verbs.
  const nominalisations = [...text.matchAll(NOMINALISATION)].map((m) => m[0].toLowerCase());
  const weakVerbHits = contains(text.toLowerCase(), WEAK_VERBS);
  if (nominalisations.length >= 2 && weakVerbHits.length >= 1) {
    findings.push(
      `The actions are hiding in nouns (${nominalisations.slice(0, 3).join(", ")}) while the verbs do no work.`
    );
  }

  const level: RubricLevel = findings.length === 0 ? 2 : findings.length === 1 ? 1 : 0;
  return { criterion: "R6", level, findings };
}

// ─── Assembly ───────────────────────────────────────────────────────────────

const DETECTORS: Partial<Record<CriterionId, (text: string) => DetectorResult>> = {
  R1: detectR1,
  R4: detectR4,
  R6: detectR6,
};

/**
 * Off-task, empty, or a restatement of the prompt. Scored separately and never
 * averaged in as a zero — a void response is an absence of data, not a bad one.
 */
export function isVoid(text: string, scenario?: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return true;
  if (!scenario) return false;
  const normalise = (s: string) => s.toLowerCase().replace(/\W+/g, " ").trim();
  return normalise(trimmed).length > 0 && normalise(scenario).includes(normalise(trimmed));
}

export function runDetectors(text: string, criteria: CriterionId[]): DetectorResult[] {
  return criteria
    .map((id) => DETECTORS[id]?.(text))
    .filter((r): r is DetectorResult => r !== undefined);
}
