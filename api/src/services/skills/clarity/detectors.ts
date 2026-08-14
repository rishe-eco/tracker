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

/**
 * Verbs that carry a primary request.
 *
 * A list like this can only ever be wrong in one direction, and it is worth
 * being clear about which. A verb that is here and shouldn't be costs a false
 * *pass* on one sentence; a verb that is missing tells someone their perfectly
 * ordinary request contains no request — the tool contradicting the thing it is
 * teaching, on the screen where they are most likely to believe it. So it is
 * generous by design, and `looksImperative` below catches what it still misses.
 *
 * The list is only consulted for sentence-initial verbs, which is what keeps it
 * from mistaking "I read the contract" for an ask.
 */
const PRIMARY_REQUEST_VERBS = new Set([
  "write", "create", "draft", "build", "make", "generate", "produce",
  "review", "check", "audit", "assess", "evaluate", "compare", "analyse", "analyze",
  "explain", "summarise", "summarize", "describe", "outline", "list",
  "fix", "debug", "repair", "resolve", "refactor", "optimise", "optimize", "rewrite",
  "find", "identify", "investigate", "diagnose", "figure", "work",
  "add", "remove", "update", "change", "implement", "design", "plan",
  "translate", "convert", "migrate", "extract", "tell", "give", "show", "help",
  // Everyday asks, which the first version of this list quietly refused:
  "read", "answer", "reply", "respond", "confirm", "send", "share", "forward",
  "sort", "tidy", "clear", "clean", "cancel", "book", "schedule", "arrange",
  "order", "buy", "pay", "call", "email", "ask", "let", "put", "move", "pick",
  "choose", "decide", "approve", "sign", "file", "log", "record", "collect",
  "gather", "prepare", "set", "turn", "walk", "take", "bring", "get", "run",
  "look", "watch", "listen", "count", "measure", "print", "copy", "paste",
  "upload", "download", "install", "deploy", "test", "verify", "double-check",
  "rank", "prioritise", "shortlist", "recommend", "suggest", "propose",
]);

/**
 * Sentence-initial verb that isn't in any list — treated as an ask.
 *
 * English imperatives have no morphology to key off, so this is a shape test:
 * a sentence that opens with a bare word (no subject, no auxiliary, not a
 * question) and continues is almost always an instruction. It exists so that a
 * request phrased with a verb nobody thought of still counts as a request.
 * Deliberately permissive — see the note on the list above for why the errors
 * are worth making in this direction.
 */
const NON_IMPERATIVE_OPENERS = new Set([
  "i", "we", "you", "he", "she", "it", "they", "there", "this", "that", "these",
  "those", "my", "our", "your", "his", "her", "its", "their", "the", "a", "an",
  "is", "are", "was", "were", "am", "be", "been", "being", "has", "have", "had",
  "will", "would", "can", "could", "should", "shall", "may", "might", "must",
  "do", "does", "did", "if", "when", "while", "because", "since", "although",
  "though", "after", "before", "as", "at", "in", "on", "for", "from", "with",
  "by", "about", "into", "over", "under", "here", "no", "not", "yes", "last",
  "next", "first", "one", "two", "three", "everyone", "someone", "nobody",
  "attached", "attaching", "following", "regarding", "re",
  // Greetings and interjections, which open a sentence exactly where a command
  // would: "Hey — hope the sprint's going okay."
  "hey", "hi", "hello", "morning", "afternoon", "evening", "thanks", "thank",
  "sorry", "apologies", "ok", "okay", "well", "yeah", "cheers", "anyway",
  "hope", "hoping", "wondering", "quick", "context", "background", "fyi",
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

function contentWords(sentence: string): string[] {
  const tokens = sentence.toLowerCase().replace(/[^a-z'\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length && LEADING_FILLERS.has(tokens[i])) i++;
  return tokens.slice(i);
}

function firstWord(sentence: string): string {
  return contentWords(sentence)[0] ?? "";
}

/** Words that make the sentence-opening token a subject rather than a command. */
const COPULA_OR_AUX = new Set([
  "is", "are", "was", "were", "be", "been", "has", "have", "had", "will", "would",
  "can", "could", "should", "shall", "may", "might", "must", "does", "did",
  "seems", "looks", "feels", "needs", "means", "matters", "arrived", "went",
]);

/**
 * Does this sentence open like an instruction?
 *
 * English imperatives carry no morphology, so this is a shape test rather than a
 * lookup: a sentence that starts with a bare word — no subject, no auxiliary,
 * not a question — and keeps going is almost always a command. It is the
 * backstop for `PRIMARY_REQUEST_VERBS`, so that a request phrased with a verb
 * nobody happened to list still registers as a request.
 */
function looksImperative(sentence: string): boolean {
  const tokens = contentWords(sentence);
  const [head, next] = tokens;
  // A single bare word is an interjection or a fragment, not an ask.
  if (!head || !next) return false;
  if (PRIMARY_REQUEST_VERBS.has(head)) return true;
  if (NON_IMPERATIVE_OPENERS.has(head) || SUPPORTING_VERBS.has(head)) return false;
  // "Deadline is Friday" — the opener is the subject of a statement.
  if (COPULA_OR_AUX.has(next)) return false;
  // Participles open descriptions ("Attached is…", "Hoping you can…").
  if (/(ing|ed)$/.test(head)) return false;
  // An imperative is the bare stem, so a trailing -s marks a plural subject or a
  // third-person verb: "Exports over 10k rows time out." The doubled and Latin
  // endings are stems in their own right — address, process, discuss, focus.
  if (/s$/.test(head) && !/(ss|us|is|as|os)$/.test(head)) return false;
  return true;
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
    const isImperative = looksImperative(sentence);
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
      if (looksImperative(s) || s.trim().endsWith("?")) askIndices.add(i);
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
