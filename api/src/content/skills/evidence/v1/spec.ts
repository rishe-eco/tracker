/**
 * Evidence Lab — locale-invariant item specs, content version `evidence/v1`.
 *
 * Nothing in this file is language-specific. The words live in `surface.en.ts`
 * and `surface.fa.ts`; what is here is what makes each item an instrument, and
 * it is authored exactly once for every locale.
 *
 * Seed set. Claims were chosen to be stable and cheaply checkable — spec
 * numbers, standard-library surface, and defaults that don't drift week to
 * week — and to sit in the learner's own domain, because triage judgement
 * (`e1-stop`) only trains on material where they can feel the stakes.
 *
 * Every key below is an authoring assertion until a human re-checks it:
 * `keyVerifiedAt: null` blocks the item from probe use (see `validate.ts`).
 */

import type {
  EvidenceItemSpec,
  EvidenceModuleKey,
  EvidenceProfile,
  FaultTag,
  Verdict,
} from "../../types";

export const CONTENT_VERSION = "evidence/v1";

/**
 * The verdict a profile implies. Keeping this derivable means an authoring slip
 * — a `contested_as_settled` item keyed `unsupported`, say — is caught by the
 * validator instead of quietly mis-scoring every learner who meets it.
 */
export const EXPECTED_VERDICT: Record<EvidenceProfile, Verdict> = {
  true_cited: "supported",
  true_uncited: "supported",
  fabricated_citation: "unsupported",
  plausible_nonexistent: "unsupported",
  subtle_numeric: "unsupported",
  real_source_misquoted: "misattributed",
  real_source_wrong_claim: "misattributed",
  outdated: "outdated",
  contested_as_settled: "contested",
};

/**
 * Which element fails, per profile — derived for the same reason the verdict is:
 * so trace-quality scoring can't drift from the item's own definition of what
 * went wrong.
 */
export const FAULT_TAG: Record<EvidenceProfile, FaultTag> = {
  true_cited: "none",
  true_uncited: "none",
  fabricated_citation: "citation",
  real_source_misquoted: "quote",
  real_source_wrong_claim: "claim_support",
  outdated: "recency",
  contested_as_settled: "framing",
  plausible_nonexistent: "existence",
  subtle_numeric: "figure",
};

/** Module order is the default teaching sequence; the baseline profile may reorder it. */
export const MODULE_ORDER: EvidenceModuleKey[] = [
  "e1-stop",
  "e2-source",
  "e3-sideways",
  "e4-trace",
  "e5-independence",
  "e6-reflex",
];

const pendingSnapshot = (...queries: string[]) => ({
  status: "pending" as const,
  fetchedAt: null,
  verifiedBy: null,
  queries: queries.map((query) => ({ query, results: [] })),
});

export const ITEM_SPECS: EvidenceItemSpec[] = [
  // ── Probe form A ─────────────────────────────────────────────────────────
  {
    itemId: "ev-a1",
    moduleKey: "e4-trace",
    formId: "A",
    difficulty: 2,
    profile: "real_source_wrong_claim",
    key: EXPECTED_VERDICT.real_source_wrong_claim,
    keyNote:
      "HTTP 103 Early Hints is specified in RFC 8297. RFC 8927 exists but is JSON Type Definition — a real document that says nothing about 103. The claim is right, the citation points elsewhere: the exact failure that survives a fluency check and dies on a trace.",
    keyVerifiedAt: null,
    faultTarget: "the RFC number attached to the claim",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("RFC 8297", "RFC 8927", "HTTP 103 Early Hints specification"),
  },
  {
    itemId: "ev-a2",
    moduleKey: "e1-stop",
    formId: "A",
    difficulty: 2,
    profile: "outdated",
    key: EXPECTED_VERDICT.outdated,
    keyNote:
      "True until SQLite 3.39.0 (2022) added RIGHT and FULL OUTER JOIN. Picked because it is the shape of staleness that hurts most: confidently correct for years, and still repeated everywhere.",
    keyVerifiedAt: null,
    faultTarget: "the claim that the feature is unsupported today",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("SQLite RIGHT JOIN support", "SQLite 3.39.0 release notes"),
  },
  {
    itemId: "ev-a3",
    moduleKey: "e2-source",
    formId: "A",
    difficulty: 3,
    profile: "plausible_nonexistent",
    key: EXPECTED_VERDICT.plausible_nonexistent,
    keyNote:
      "There is no Array.prototype.last(). `at(-1)` is the real answer. Sits next to a family of methods that do exist, which is what makes it plausible — and it fails instantly against any reference.",
    keyVerifiedAt: null,
    faultTarget: "the existence of the method itself",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("Array.prototype.last JavaScript", "MDN Array.prototype.at"),
  },
  {
    itemId: "ev-a4",
    moduleKey: "e5-independence",
    formId: "A",
    difficulty: 3,
    profile: "contested_as_settled",
    key: EXPECTED_VERDICT.contested_as_settled,
    keyNote:
      "A live engineering trade-off — index locality and storage cost against distribution and non-guessability — presented as a resolved best practice. The learner should reach `contested`, not `unsupported`: the answer is not false, it is falsely settled.",
    keyVerifiedAt: null,
    faultTarget: "the framing of a trade-off as consensus",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("UUID vs auto increment primary key tradeoffs", "UUID primary key index locality"),
  },
  {
    itemId: "ev-a5",
    moduleKey: "e3-sideways",
    formId: "A",
    difficulty: 1,
    profile: "true_cited",
    key: EXPECTED_VERDICT.true_cited,
    keyNote:
      "CONTROL — accurate and correctly cited. structuredClone() is a global from Node 17. A learner who flags this has learned distrust rather than checking.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: ["developer.mozilla.org"],
    snapshot: pendingSnapshot("structuredClone Node.js availability", "MDN structuredClone"),
  },
  {
    itemId: "ev-a6",
    moduleKey: "e3-sideways",
    formId: "A",
    difficulty: 2,
    profile: "true_uncited",
    key: EXPECTED_VERDICT.true_uncited,
    keyNote:
      "CONTROL — accurate but unsourced. The correct verdict is `supported` *after checking*, not distrust-on-sight: absence of a citation is a reason to check, never a reason to disbelieve.",
    keyVerifiedAt: null,
    faultTarget: null,
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("SQLite boolean datatype", "SQLite datatypes documentation"),
  },

  // ── Practice pool ────────────────────────────────────────────────────────
  {
    itemId: "ev-p1",
    moduleKey: "e6-reflex",
    formId: "pool",
    difficulty: 2,
    profile: "subtle_numeric",
    key: EXPECTED_VERDICT.subtle_numeric,
    keyNote:
      "The bcrypt npm package defaults to a cost factor of 10, not 12. Everything around the number is correct, which is the point — the fluent frame carries the wrong digit.",
    keyVerifiedAt: null,
    faultTarget: "the specific cost factor",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("bcrypt npm default salt rounds", "node bcrypt genSaltSync default"),
  },
  {
    itemId: "ev-p2",
    moduleKey: "e4-trace",
    formId: "pool",
    difficulty: 3,
    profile: "fabricated_citation",
    key: EXPECTED_VERDICT.fabricated_citation,
    keyNote:
      "No such document. JWT is RFC 7519; there is no published 'RFC 7519bis'. The suffix reads like real standards-track shorthand, so it passes a glance and fails a lookup.",
    keyVerifiedAt: null,
    faultTarget: "the cited document, which does not exist",
    nonIndependentHosts: [],
    snapshot: pendingSnapshot("RFC 7519bis", "JWT RFC number"),
  },
];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((s) => [s.itemId, s]));
