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
  //
  // Three offline-capable items per module, per the build plan (01a §3). The
  // split by type is not arbitrary: revision and repair items ship everything
  // they need, so they run with no model configured at all. Elicitation cannot —
  // the reader has to respond to the learner's own text — so an elicitation item
  // in the pool is a bonus for credentialled installs, never part of a module's
  // offline floor.
  //
  // c1/c2/c3/c5 get revision items and c4/c6 get repair drills, following §5:
  // repair is the one place Clarity allows a fast item and it only fits the two
  // criteria a detector can see. Four modules of revision items is on-message
  // rather than a compromise — revision is the tool's declared centre of gravity.
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

  // ── c1-ask · revision ────────────────────────────────────────────────────
  {
    itemId: "cl-p3",
    moduleKey: "c1-ask",
    formId: "pool",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R1", "R6"],
    keyNote:
      "The ask is 'thoughts?' — last, and unbounded even once you find it. The misread is a reader thinking out loud, which is exactly what was requested. The deposit deadline never appears at all.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p4",
    moduleKey: "c1-ask",
    formId: "pool",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R1"],
    keyNote:
      "Two co-equal asks plus an explicit 'either is fine', which reads as 'neither is urgent'. The reader answers the cheaper one. The fix is not two messages — it is naming which matters and by when.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p5",
    moduleKey: "c1-ask",
    formId: "pool",
    difficulty: 3,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R1", "R2", "R5"],
    keyNote:
      "There is no request here at all — it is a wish, phrased as an observation. R1 = 0. The reader agrees with it, which is the correct response to what was actually written.",
    keyVerifiedAt: null,
  },

  // ── c2-deliverable · revision ────────────────────────────────────────────
  {
    itemId: "cl-p6",
    moduleKey: "c2-deliverable",
    formId: "pool",
    difficulty: 1,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R2", "R3"],
    keyNote:
      "Kind named, nothing bounded, and no purpose given — so the reader produces a defensible summary of the wrong size, aimed at nobody, that answers everything except the question actually being asked.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p7",
    moduleKey: "c2-deliverable",
    formId: "pool",
    difficulty: 3,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R2"],
    keyNote:
      "Deliberately a *good* request — kind, format, length and audience all present. R2 is level 1, not 0. What is missing is one out-of-scope clause, and its absence produces the one outcome that cannot be undone.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p8",
    moduleKey: "c2-deliverable",
    formId: "pool",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R2"],
    keyNote:
      "'Something' is the tell. Kind unstated, format unstated, and the only specific in the sentence describes the audience rather than the artifact — so two wildly different deliverables both satisfy it.",
    keyVerifiedAt: null,
  },

  // ── c3-context · revision ────────────────────────────────────────────────
  {
    itemId: "cl-p9",
    moduleKey: "c3-context",
    formId: "pool",
    difficulty: 1,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R3"],
    keyNote:
      "One missing fact invalidates the entire visit. The curse of knowledge at its purest: the fact most obviously absent is the one that felt too obvious to say.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p10",
    moduleKey: "c3-context",
    formId: "pool",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R3", "R6"],
    keyNote:
      "The mirror of cl-p9 — plenty of context, almost none of it load-bearing, and the one real constraint arrives last in a subordinate clause. R3 = 1 and R6 = 0: supplied is not the same as received.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p11",
    moduleKey: "c3-context",
    formId: "pool",
    difficulty: 3,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R3"],
    keyNote:
      "A quality-maxim failure dressed as context: an inference supplied as though it were an observation. From outside the message the reader cannot tell which it is, and acts on it.",
    keyVerifiedAt: null,
  },

  // ── c4-referents · repair ────────────────────────────────────────────────
  {
    itemId: "cl-p12",
    moduleKey: "c4-referents",
    formId: "pool",
    difficulty: 1,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R4"],
    repairCheck: { criterion: "R4", requiredLevel: 2 },
    keyNote: "Two pointers, no anchors, and no way to tell whether they point at the same thing.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p13",
    moduleKey: "c4-referents",
    formId: "pool",
    difficulty: 2,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R4"],
    repairCheck: { criterion: "R4", requiredLevel: 2 },
    keyNote: "Unbounded quantities rather than dangling pronouns — the same criterion, its other half.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p14",
    moduleKey: "c4-referents",
    formId: "pool",
    difficulty: 3,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R4"],
    repairCheck: { criterion: "R4", requiredLevel: 2 },
    keyNote:
      "Bare comparatives: they name a direction and hide the target, which is why they read as specifications and function as none.",
    keyVerifiedAt: null,
  },

  // ── c5-done · revision ───────────────────────────────────────────────────
  {
    itemId: "cl-p15",
    moduleKey: "c5-done",
    formId: "pool",
    difficulty: 1,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R5"],
    keyNote:
      "The bar existed and was never stated, so the reader applied their own and met it. Deliberately domestic — R5 is not a workplace skill and an item set that implies it is would teach it as one.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p16",
    moduleKey: "c5-done",
    formId: "pool",
    difficulty: 2,
    type: "revision",
    requiredSlots: [],
    seededFaults: ["R5", "R2"],
    keyNote:
      "Criteria stated and neither checkable — not even by the person who wrote them, which is why the misread ends in rounds that cannot converge. R5 = 1: gestured at, not stated.",
    keyVerifiedAt: null,
  },

  // ── c6-economy · repair ──────────────────────────────────────────────────
  {
    itemId: "cl-p17",
    moduleKey: "c6-economy",
    formId: "pool",
    difficulty: 1,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R6"],
    repairCheck: { criterion: "R6", requiredLevel: 2 },
    keyNote:
      "Four scaffolding sentences around one fact. Cutting them also exposes that no request was ever made — 'let me know your thoughts' was standing in for one.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p18",
    moduleKey: "c6-economy",
    formId: "pool",
    difficulty: 3,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R6"],
    repairCheck: { criterion: "R6", requiredLevel: 2 },
    keyNote:
      "Every action hides in a noun and there is no actor anywhere in the sentence. Williams's test recovers both: find the characters, make the actions the verbs.",
    keyVerifiedAt: null,
  },
  {
    itemId: "cl-p19",
    moduleKey: "c6-economy",
    formId: "pool",
    difficulty: 2,
    type: "repair",
    requiredSlots: [],
    seededFaults: ["R6"],
    repairCheck: { criterion: "R6", requiredLevel: 2 },
    keyNote:
      "The deadline determines whether any of the three tasks succeeds, and it arrives in the final clause behind all of them. Order is the fault, not length.",
    keyVerifiedAt: null,
  },
];

export const ITEM_SPEC_BY_ID = new Map(ITEM_SPECS.map((s) => [s.itemId, s]));
