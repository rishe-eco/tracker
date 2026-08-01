/**
 * Skill-tool content types.
 *
 * Spec: tracker-canon/06-specs/00-skills-engine.md §5, §5.1.
 *
 * Two rules shape everything here:
 *
 * 1. Content is authored and versioned in this repo, never generated at
 *    runtime. A generated item cannot support a pre/post comparison — the whole
 *    measurement design assumes fixed, matched, parallel forms.
 *
 * 2. Every item splits into a locale-invariant `spec` and a per-locale
 *    `surface`. The spec holds everything that makes the item an instrument
 *    (profile, difficulty, answer key, independence rules); the surface holds
 *    only the words. Authoring the spec once is what keeps the `en` and `fa`
 *    versions comparable, and it means a later fix to a key is made once.
 *
 * This lives in the API and not the client on purpose: answer keys, fault
 * targets and independence rules must never reach a browser bundle.
 */

export type SkillKey = "clarity" | "evidence";
export type Locale = "en" | "fa";

/** A/B/C are the parallel probe forms; `pool` is practice-only material. */
export type FormId = "A" | "B" | "C" | "pool";

export type Difficulty = 1 | 2 | 3;

// ─── Evidence Lab ───────────────────────────────────────────────────────────

export const EVIDENCE_MODULE_KEYS = [
  "e1-stop",
  "e2-source",
  "e3-sideways",
  "e4-trace",
  "e5-independence",
  "e6-reflex",
] as const;
export type EvidenceModuleKey = (typeof EVIDENCE_MODULE_KEYS)[number];

/**
 * The failure taxonomy. `true_cited` and `true_uncited` are **controls** and are
 * not a formality: a learner who becomes uniformly suspicious has not learned
 * this skill, they have acquired a different failure. Every scored form carries
 * at least a third controls, enforced by the validator.
 */
export const EVIDENCE_PROFILES = [
  "true_cited",
  "true_uncited",
  "fabricated_citation",
  "real_source_misquoted",
  "real_source_wrong_claim",
  "outdated",
  "contested_as_settled",
  "plausible_nonexistent",
  "subtle_numeric",
] as const;
export type EvidenceProfile = (typeof EVIDENCE_PROFILES)[number];

export const CONTROL_PROFILES: readonly EvidenceProfile[] = ["true_cited", "true_uncited"];

export function isControl(profile: EvidenceProfile): boolean {
  return CONTROL_PROFILES.includes(profile);
}

/**
 * Fixed verdict set, so accuracy is scorable. `cant_tell` is a legitimate
 * answer, not a cop-out — it is keyed correct where the check genuinely cannot
 * resolve in the time available.
 */
export const VERDICTS = [
  "supported",
  "unsupported",
  "misattributed",
  "outdated",
  "contested",
  "cant_tell",
] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * Which element of a claim failed. A single fixed set shared by every item —
 * per-item options would narrow the answer space and leak the key.
 */
export const FAULT_TAGS = [
  "citation",
  "quote",
  "claim_support",
  "recency",
  "framing",
  "existence",
  "figure",
  "none",
] as const;
export type FaultTag = (typeof FAULT_TAGS)[number];

/** One pre-fetched search, frozen into the pack so a probe needs no network. */
export type SnapshotQuery = {
  query: string;
  results: { title: string; url: string; snippet: string }[];
};

export type Snapshot = {
  /**
   * `pending` — authored, not yet fetched. The item may be used in practice
   * (live search, new tab) but is blocked from probe forms by the validator.
   * `verified` — results fetched and the answer key re-checked against them.
   */
  status: "pending" | "verified";
  fetchedAt: string | null;
  /** Who re-verified the key against these exact results. */
  verifiedBy: string | null;
  queries: SnapshotQuery[];
};

export type EvidenceItemSpec = {
  itemId: string;
  moduleKey: EvidenceModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  profile: EvidenceProfile;
  /** The correct verdict. Never leaves the server. */
  key: Verdict;
  /** Why this is the key — the reviewer's note, and what a re-verifier checks against. */
  keyNote: string;
  /**
   * When a human last confirmed the key is still correct. `null` blocks the item
   * from probe forms: an unverified key in a measurement instrument is worse
   * than no item at all, and this is the one failure mode that would otherwise
   * be silent.
   */
  keyVerifiedAt: string | null;
  /**
   * Which element of the claim fails, for trace-quality scoring. `null` on
   * controls — there is nothing to locate.
   */
  faultTarget: string | null;
  /**
   * Hosts that are *not* independent of the answer's own citation — mirrors,
   * syndications, and the cited source itself. Bringing one of these back is a
   * check that isn't a check.
   */
  nonIndependentHosts: string[];
  snapshot: Snapshot;
};

export type EvidenceItemSurface = {
  itemId: string;
  /** The user question that produced the answer. */
  prompt: string;
  /**
   * The AI answer, written exactly as a real one would read — confident, well
   * formatted, no tell. Any styling difference between control and faulty items
   * destroys the instrument.
   */
  answer: string;
  /** Shown only after the verdict is committed: what a fast correct check looks like. */
  reveal: string;
};

export type EvidenceModuleSurface = {
  moduleKey: EvidenceModuleKey;
  title: string;
  /** Step 1. One idea, ≤250 words. */
  concept: string;
  /** Step 2. The contrast that makes the idea concrete. */
  model: string;
};

// ─── Pack assembly ──────────────────────────────────────────────────────────

export type EvidencePack = {
  skillKey: "evidence";
  contentVersion: string;
  locale: Locale;
  /**
   * `draft` means machine-drafted and not yet post-edited by a native speaker.
   * Surfaced in the UI rather than hidden — a draft locale is a known state, not
   * a silent one.
   */
  reviewStatus: "draft" | "reviewed";
  modules: EvidenceModuleSurface[];
  items: (EvidenceItemSpec & { surface: EvidenceItemSurface })[];
};

/** What the client is allowed to see. Note the absence of key/faultTarget/hosts. */
export type PublicEvidenceItem = {
  itemId: string;
  moduleKey: EvidenceModuleKey;
  difficulty: Difficulty;
  prompt: string;
  answer: string;
  /** Present only in assessment/probe mode, where checks run on frozen results. */
  snapshotQueries: SnapshotQuery[] | null;
};

export function toPublicItem(
  item: EvidenceItemSpec & { surface: EvidenceItemSurface },
  opts: { includeSnapshot: boolean }
): PublicEvidenceItem {
  return {
    itemId: item.itemId,
    moduleKey: item.moduleKey,
    difficulty: item.difficulty,
    prompt: item.surface.prompt,
    answer: item.surface.answer,
    snapshotQueries: opts.includeSnapshot ? item.snapshot.queries : null,
  };
}
