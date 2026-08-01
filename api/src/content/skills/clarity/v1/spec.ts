/**
 * Clarity Lab — locale-invariant item specs, content version `clarity/v1`.
 *
 * Seed set. As with Evidence Lab, every key is an authoring assertion until a
 * human re-checks it (`keyVerifiedAt: null` blocks probe use).
 *
 * Item mix follows the form spec in `02-...`/`01-clarity-lab.md` §9: elicitation
 * tasks are the scored core, one revision task carries the diagnose-and-revise
 * loop, and repair drills are the one place Clarity allows a fast item.
 */

import type { ClarityItemSpec } from "../types";

export const CONTENT_VERSION = "clarity/v1";

export const MODULE_ORDER = [
  "c1-ask",
  "c2-deliverable",
  "c3-context",
  "c4-referents",
  "c5-done",
  "c6-economy",
] as const;

export const ITEM_SPECS: ClarityItemSpec[] = [
  // ── Probe form A ─────────────────────────────────────────────────────────
  {
    itemId: "cl-a1",
    moduleKey: "c3-context",
    formId: "A",
    difficulty: 2,
    type: "elicitation",
    requiredSlots: ["audience", "input", "constraint", "format"],
    seededFaults: [],
    keyNote:
      "The context sheet holds seven facts; four are load-bearing and three are noise. R3 level 2 needs all four required slots and at most one unrequired one — so the item measures selection, not transcription. Copying the whole sheet scores 1, not 2.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-a2",
    moduleKey: "c5-done",
    formId: "A",
    difficulty: 3,
    type: "elicitation",
    requiredSlots: ["purpose", "constraint", "format", "out_of_scope"],
    seededFaults: [],
    keyNote:
      "Chosen because the obvious success criterion here (\"make it clearer\") is not checkable, so R5 separates learners who state a bar a third party could apply from those who gesture at one.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-a3",
    moduleKey: "c1-ask",
    formId: "A",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R1", "R6"],
    keyNote:
      "The request is real but arrives in the last sentence behind three of setup. The authored misread is what a reader plausibly produces from that ordering — it answers the setup instead of the ask.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-a4",
    moduleKey: "c4-referents",
    formId: "A",
    difficulty: 1,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R4"],
    repairCheck: { criterion: "R4", requiredLevel: 2 },
    keyNote: "Two unbound referents in one short sentence: a bare demonstrative and an undefined noun phrase.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-a5",
    moduleKey: "c4-referents",
    formId: "A",
    difficulty: 2,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R4"],
    repairCheck: { criterion: "R4", requiredLevel: 2 },
    keyNote: "Unbounded quantifiers rather than dangling pronouns — the same criterion, a different surface.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-a6",
    moduleKey: "c6-economy",
    formId: "A",
    difficulty: 2,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R6"],
    repairCheck: { criterion: "R6", requiredLevel: 2 },
    keyNote: "Two sentences that add no constraint, input, or criterion. Deleting them loses nothing.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-a7",
    moduleKey: "c6-economy",
    formId: "A",
    difficulty: 3,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R6"],
    repairCheck: { criterion: "R6", requiredLevel: 2 },
    keyNote:
      "Nominalisation: the actions are buried in nouns and the verbs are empty ('perform a review of'). Williams's test — subjects should be the characters, verbs should be the actions.",
    keyVerifiedAt: null,
  },

  // ── Practice pool ────────────────────────────────────────────────────────
  {
    itemId: "cl-p1",
    moduleKey: "c2-deliverable",
    formId: "pool",
    difficulty: 2,
    type: "elicitation",
    requiredSlots: ["format", "constraint", "out_of_scope"],
    seededFaults: [],
    keyNote: "The deliverable has an obvious kind and a non-obvious shape; R2 level 2 needs the shape.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p2",
    moduleKey: "c5-done",
    formId: "pool",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R5", "R2"],
    keyNote:
      "The request is well-ordered and specific about everything except what 'done' means, so the misread is competent work aimed at the wrong bar.",
    keyVerifiedAt: null,
  },
];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((s) => [s.itemId, s]));
