/**
 * Delegation Lab `v1` — locale-invariant item specs.
 *
 * Five item kinds, one per dominant module (05-delegation-lab.md §5):
 * `estimate` (g1-own, g3-weigh), `cue` (g2-instance, an estimate plus the
 * cue-selection step), `split` (g4-split), `stakes` (g5-stakes, always
 * authored as a pair sharing `truth`/`advice`/`cueDirection` and differing
 * only in framing/stakes), `sequence` (g6-drift, one item holding
 * `G6_ROUNDS` rounds).
 *
 * Pool floor (spec §7): ≥6 pool items per module, except g5 (≥6 *pairs* —
 * 12 items) and g6 (≥6 *sequences* — 6 items, since a sequence is already
 * one item). `truth`/`advice`/`plausibleRange` are chosen so `isAdviceGood`
 * (types.ts) balances ~50/50 within every cue-scoped module's pool, and
 * `cueDirection` covers all three values in every cue-scoped pool.
 */

import {
  DELEGATION_MODULE_KEYS,
  type CueOption,
  type DelegationItemSpec,
  type DelegationModuleKey,
  type Difficulty,
  type FormId,
  type SequenceRound,
  type SplitPiece,
} from "../types";

export const CONTENT_VERSION = "delegation/v1";
export const MODULE_ORDER: DelegationModuleKey[] = [...DELEGATION_MODULE_KEYS];

type EstimateInput = {
  itemId: string;
  moduleKey: DelegationModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  truth: number;
  unit: string;
  plausibleRange: [number, number];
  advice: number;
  cueDirection: "trust" | "keep" | "none";
  cueOptions?: CueOption[];
  stakesPairId?: string;
  stakesRole?: "low" | "high";
  keyNote: string;
  keyVerifiedAt: string | null;
};

function estimateItem(input: EstimateInput): DelegationItemSpec {
  return {
    itemId: input.itemId,
    moduleKey: input.moduleKey,
    formId: input.formId,
    difficulty: input.difficulty,
    kind: input.cueOptions ? "cue" : input.stakesPairId ? "stakes" : "estimate",
    truth: input.truth,
    unit: input.unit,
    plausibleRange: input.plausibleRange,
    advice: input.advice,
    cueDirection: input.cueDirection,
    cueOptions: input.cueOptions,
    stakesPairId: input.stakesPairId,
    stakesRole: input.stakesRole,
    keyNote: input.keyNote,
    keyVerifiedAt: input.keyVerifiedAt,
  };
}

function splitItem(input: {
  itemId: string;
  moduleKey: DelegationModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  splitPieces: SplitPiece[];
  keyNote: string;
  keyVerifiedAt: string | null;
}): DelegationItemSpec {
  return {
    itemId: input.itemId,
    moduleKey: input.moduleKey,
    formId: input.formId,
    difficulty: input.difficulty,
    kind: "split",
    truth: null,
    unit: null,
    plausibleRange: null,
    advice: null,
    cueDirection: "none",
    splitPieces: input.splitPieces,
    keyNote: input.keyNote,
    keyVerifiedAt: input.keyVerifiedAt,
  };
}

function sequenceItem(input: {
  itemId: string;
  moduleKey: DelegationModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  unit: string;
  rounds: SequenceRound[];
  keyNote: string;
  keyVerifiedAt: string | null;
}): DelegationItemSpec {
  return {
    itemId: input.itemId,
    moduleKey: input.moduleKey,
    formId: input.formId,
    difficulty: input.difficulty,
    kind: "sequence",
    truth: null,
    unit: input.unit,
    plausibleRange: null,
    advice: null,
    cueDirection: "none",
    sequenceRounds: input.rounds,
    keyNote: input.keyNote,
    keyVerifiedAt: input.keyVerifiedAt,
  };
}

const CUE_NONE: CueOption = { cueId: "cNone", kind: "none", bearsOnRelative: false };

// ─── g1-own ─────────────────────────────────────────────────────────────────

const G1_POOL: DelegationItemSpec[] = [
  estimateItem({ itemId: "g1-p1", moduleKey: "g1-own", formId: "pool", difficulty: 1, truth: 1105, unit: "km", plausibleRange: [600, 1800], advice: 1150, cueDirection: "trust", keyNote: "Paris-Rome straight-line distance ~1105km; advice (1150) is closer to truth than the range midpoint (1200).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g1-p2", moduleKey: "g1-own", formId: "pool", difficulty: 2, truth: 10300000, unit: "people", plausibleRange: [5000000, 20000000], advice: 10800000, cueDirection: "trust", keyNote: "Portugal population ~10.3M; advice is closer to truth than the range midpoint (12.5M).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g1-p3", moduleKey: "g1-own", formId: "pool", difficulty: 3, truth: 330, unit: "m", plausibleRange: [200, 500], advice: 250, cueDirection: "keep", keyNote: "Eiffel Tower height with antenna ~330m; advice (250) is farther from truth than the range midpoint (350).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g1-p4", moduleKey: "g1-own", formId: "pool", difficulty: 1, truth: 121, unit: "minutes", plausibleRange: [100, 180], advice: 160, cueDirection: "keep", keyNote: "Marathon world record ~2:01 (121 min); advice (160) is farther from truth than the range midpoint (140).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g1-p5", moduleKey: "g1-own", formId: "pool", difficulty: 2, truth: 180, unit: "USD", plausibleRange: [50, 400], advice: 190, cueDirection: "none", keyNote: "Used bicycle price, no legitimate cue either way; advice (190) happens to be closer to truth than the midpoint (225).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g1-p6", moduleKey: "g1-own", formId: "pool", difficulty: 3, truth: 1200, unit: "kg", plausibleRange: [800, 2000], advice: 1750, cueDirection: "none", keyNote: "Small-car curb weight, no legitimate cue either way; advice (1750) happens to be farther from truth than the midpoint (1400).", keyVerifiedAt: null }),
];

const G1_PROBE: Record<"A" | "B" | "C", DelegationItemSpec> = {
  A: estimateItem({ itemId: "g1-fA", moduleKey: "g1-own", formId: "A", difficulty: 2, truth: 828, unit: "m", plausibleRange: [400, 1400], advice: 850, cueDirection: "trust", keyNote: "Burj Khalifa height 828m; advice close to truth vs. midpoint (900).", keyVerifiedAt: null }),
  B: estimateItem({ itemId: "g1-fB", moduleKey: "g1-own", formId: "B", difficulty: 2, truth: 452, unit: "m", plausibleRange: [200, 800], advice: 470, cueDirection: "trust", keyNote: "Petronas Towers height 452m; advice close to truth vs. midpoint (500).", keyVerifiedAt: null }),
  C: estimateItem({ itemId: "g1-fC", moduleKey: "g1-own", formId: "C", difficulty: 2, truth: 634, unit: "m", plausibleRange: [300, 1000], advice: 660, cueDirection: "trust", keyNote: "Tokyo Skytree height 634m; advice close to truth vs. midpoint (650).", keyVerifiedAt: null }),
};

// ─── g2-instance ────────────────────────────────────────────────────────────

/** cueId/kind/bearsOnRelative only — the labels themselves live in the per-locale surface. */
function g2Cues(instanceBears: boolean): CueOption[] {
  return [
    { cueId: "cCat", kind: "category", bearsOnRelative: false },
    { cueId: "cInst", kind: "instance", bearsOnRelative: instanceBears },
    CUE_NONE,
  ];
}

const G2_POOL: DelegationItemSpec[] = [
  estimateItem({ itemId: "g2-p1", moduleKey: "g2-instance", formId: "pool", difficulty: 1, truth: 252, unit: "km", plausibleRange: [150, 450], advice: 260, cueDirection: "trust", cueOptions: g2Cues(true), keyNote: "Vienna-Prague distance ~252km; a straight-line calc the model does well.", keyVerifiedAt: null }),
  estimateItem({ itemId: "g2-p2", moduleKey: "g2-instance", formId: "pool", difficulty: 2, truth: 380000, unit: "people", plausibleRange: [200000, 500000], advice: 330000, cueDirection: "keep", cueOptions: g2Cues(true), keyNote: "Iceland population ~380k as of this pack's authoring; advice is an older, now-stale figure.", keyVerifiedAt: null }),
  estimateItem({ itemId: "g2-p3", moduleKey: "g2-instance", formId: "pool", difficulty: 2, truth: 1665, unit: "steps", plausibleRange: [500, 3000], advice: 1700, cueDirection: "none", cueOptions: g2Cues(false), keyNote: "Steps to the top of the Eiffel Tower ~1665; nothing here actually discriminates competence.", keyVerifiedAt: null }),
  estimateItem({ itemId: "g2-p4", moduleKey: "g2-instance", formId: "pool", difficulty: 1, truth: 5633, unit: "m", plausibleRange: [4000, 7000], advice: 5600, cueDirection: "trust", cueOptions: g2Cues(true), keyNote: "3.5 miles in metres = 5633m; a checkable conversion, and the category claim about arithmetic is the dated one.", keyVerifiedAt: null }),
  estimateItem({ itemId: "g2-p5", moduleKey: "g2-instance", formId: "pool", difficulty: 3, truth: 55, unit: "liters", plausibleRange: [30, 90], advice: 40, cueDirection: "keep", cueOptions: g2Cues(true), keyNote: "Typical sedan fuel tank ~55L; advice reads like a gallons figure mislabeled as litres.", keyVerifiedAt: null }),
  estimateItem({ itemId: "g2-p6", moduleKey: "g2-instance", formId: "pool", difficulty: 2, truth: 840, unit: "languages", plausibleRange: [200, 1500], advice: 600, cueDirection: "none", cueOptions: g2Cues(false), keyNote: "Languages spoken in Papua New Guinea ~840; nothing here discriminates competence.", keyVerifiedAt: null }),
];

const G2_PROBE: Record<"A" | "B" | "C", DelegationItemSpec> = {
  A: estimateItem({ itemId: "g2-fA", moduleKey: "g2-instance", formId: "A", difficulty: 2, truth: 1370000, unit: "people", plausibleRange: [700000, 2200000], advice: 1200000, cueDirection: "keep", cueOptions: g2Cues(true), keyNote: "Estonia population ~1.37M; advice is an older, now-stale figure.", keyVerifiedAt: null }),
  B: estimateItem({ itemId: "g2-fB", moduleKey: "g2-instance", formId: "B", difficulty: 2, truth: 2120000, unit: "people", plausibleRange: [1200000, 3200000], advice: 1900000, cueDirection: "keep", cueOptions: g2Cues(true), keyNote: "Slovenia population ~2.12M; advice is stale, matched to form A's slot.", keyVerifiedAt: null }),
  C: estimateItem({ itemId: "g2-fC", moduleKey: "g2-instance", formId: "C", difficulty: 2, truth: 1830000, unit: "people", plausibleRange: [1000000, 2800000], advice: 1600000, cueDirection: "keep", cueOptions: g2Cues(true), keyNote: "Latvia population ~1.83M; advice is stale, matched to form A's slot.", keyVerifiedAt: null }),
};

// ─── g3-weigh ───────────────────────────────────────────────────────────────

const G3_POOL: DelegationItemSpec[] = [
  estimateItem({ itemId: "g3-p1", moduleKey: "g3-weigh", formId: "pool", difficulty: 1, truth: 1440, unit: "minutes", plausibleRange: [800, 2200], advice: 1460, cueDirection: "trust", keyNote: "Minutes in a day (1440) as a checkable-arithmetic frame; advice near truth.", keyVerifiedAt: null }),
  estimateItem({ itemId: "g3-p2", moduleKey: "g3-weigh", formId: "pool", difficulty: 2, truth: 8848, unit: "m", plausibleRange: [5000, 13000], advice: 8900, cueDirection: "trust", keyNote: "Everest height 8848m; advice close to truth vs. midpoint (9000).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g3-p3", moduleKey: "g3-weigh", formId: "pool", difficulty: 2, truth: 384400, unit: "km", plausibleRange: [200000, 600000], advice: 250000, cueDirection: "keep", keyNote: "Earth-Moon distance ~384,400km; advice far from truth vs. midpoint (400,000).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g3-p4", moduleKey: "g3-weigh", formId: "pool", difficulty: 3, truth: 60, unit: "years", plausibleRange: [20, 120], advice: 35, cueDirection: "keep", keyNote: "Average lifespan of a giant tortoise's breeding readiness framing ~60y; advice far from truth vs. midpoint (70).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g3-p5", moduleKey: "g3-weigh", formId: "pool", difficulty: 1, truth: 206, unit: "bones", plausibleRange: [120, 320], advice: 210, cueDirection: "none", keyNote: "Bones in an adult human body (206); advice happens near truth vs. midpoint (220).", keyVerifiedAt: null }),
  estimateItem({ itemId: "g3-p6", moduleKey: "g3-weigh", formId: "pool", difficulty: 2, truth: 7, unit: "hours", plausibleRange: [3, 14], advice: 4, cueDirection: "none", keyNote: "Recommended adult sleep (7h); advice happens far from truth vs. midpoint (8.5).", keyVerifiedAt: null }),
];

const G3_PROBE: Record<"A" | "B" | "C", DelegationItemSpec> = {
  A: estimateItem({ itemId: "g3-fA", moduleKey: "g3-weigh", formId: "A", difficulty: 2, truth: 6371, unit: "km", plausibleRange: [3000, 10000], advice: 6400, cueDirection: "trust", keyNote: "Earth radius 6371km; advice close to truth.", keyVerifiedAt: null }),
  B: estimateItem({ itemId: "g3-fB", moduleKey: "g3-weigh", formId: "B", difficulty: 2, truth: 3474, unit: "km", plausibleRange: [1600, 5500], advice: 3500, cueDirection: "trust", keyNote: "Moon diameter 3474km; advice close to truth, matched to form A's slot.", keyVerifiedAt: null }),
  C: estimateItem({ itemId: "g3-fC", moduleKey: "g3-weigh", formId: "C", difficulty: 2, truth: 12742, unit: "km", plausibleRange: [6000, 20000], advice: 12800, cueDirection: "trust", keyNote: "Earth diameter 12742km; advice close to truth, matched to form A's slot.", keyVerifiedAt: null }),
};

// ─── g4-split ───────────────────────────────────────────────────────────────

function pieces(spec: [string, "give" | "keep" | "either"][]): SplitPiece[] {
  return spec.map(([pieceId, keyDisposition]) => ({ pieceId, keyDisposition }));
}

const G4_POOL: DelegationItemSpec[] = [
  splitItem({ itemId: "g4-p1", moduleKey: "g4-split", formId: "pool", difficulty: 1, splitPieces: pieces([["p1", "give"], ["p2", "keep"], ["p3", "either"]]), keyNote: "Summarising 40 pages is delegable; picking which three priorities matter turns on team history the model never saw.", keyVerifiedAt: null }),
  splitItem({ itemId: "g4-p2", moduleKey: "g4-split", formId: "pool", difficulty: 2, splitPieces: pieces([["p1", "give"], ["p2", "keep"]]), keyNote: "Drafting the migration script is delegable; judging whether the down-migration is safe on live data is not.", keyVerifiedAt: null }),
  splitItem({ itemId: "g4-p3", moduleKey: "g4-split", formId: "pool", difficulty: 1, splitPieces: pieces([["p1", "give"], ["p2", "keep"], ["p3", "either"]]), keyNote: "Drafting reply text to a support ticket is delegable; deciding whether to offer a refund given the account's history is not.", keyVerifiedAt: null }),
  splitItem({ itemId: "g4-p4", moduleKey: "g4-split", formId: "pool", difficulty: 2, splitPieces: pieces([["p1", "give"], ["p2", "keep"]]), keyNote: "Cleaning a messy spreadsheet's formatting is delegable; deciding which rows are duplicates given internal context is not.", keyVerifiedAt: null }),
  splitItem({ itemId: "g4-p5", moduleKey: "g4-split", formId: "pool", difficulty: 3, splitPieces: pieces([["p1", "give"], ["p2", "keep"], ["p3", "either"]]), keyNote: "Generating candidate interview questions is delegable; judging a candidate's actual answers against team fit is not.", keyVerifiedAt: null }),
  splitItem({ itemId: "g4-p6", moduleKey: "g4-split", formId: "pool", difficulty: 2, splitPieces: pieces([["p1", "give"], ["p2", "keep"]]), keyNote: "Producing a first-pass project schedule is delegable; deciding which risk is acceptable given the client relationship is not.", keyVerifiedAt: null }),
];

const G4_PROBE: Record<"A" | "B" | "C", DelegationItemSpec> = {
  A: splitItem({ itemId: "g4-fA", moduleKey: "g4-split", formId: "A", difficulty: 2, splitPieces: pieces([["p1", "give"], ["p2", "keep"]]), keyNote: "Drafting release notes from the diff is delegable; deciding which changes are worth flagging to customers is not.", keyVerifiedAt: null }),
  B: splitItem({ itemId: "g4-fB", moduleKey: "g4-split", formId: "B", difficulty: 2, splitPieces: pieces([["p1", "give"], ["p2", "keep"]]), keyNote: "Drafting onboarding docs from the codebase is delegable; deciding what a new hire actually needs on day one is not.", keyVerifiedAt: null }),
  C: splitItem({ itemId: "g4-fC", moduleKey: "g4-split", formId: "C", difficulty: 2, splitPieces: pieces([["p1", "give"], ["p2", "keep"]]), keyNote: "Summarising customer feedback threads is delegable; deciding which complaint is the real signal is not.", keyVerifiedAt: null }),
};

// ─── g5-stakes ──────────────────────────────────────────────────────────────

function stakesPair(
  pairId: string,
  truth: number,
  unit: string,
  plausibleRange: [number, number],
  advice: number,
  cueDirection: "trust" | "keep" | "none",
  difficulty: Difficulty,
  formId: FormId,
  keyNote: string,
  keyVerifiedAt: string | null
): [DelegationItemSpec, DelegationItemSpec] {
  const base = { moduleKey: "g5-stakes" as const, formId, difficulty, truth, unit, plausibleRange, advice, cueDirection, stakesPairId: pairId, keyNote, keyVerifiedAt };
  return [
    estimateItem({ ...base, itemId: `${pairId}-low`, stakesRole: "low" }),
    estimateItem({ ...base, itemId: `${pairId}-high`, stakesRole: "high" }),
  ];
}

const G5_POOL: DelegationItemSpec[] = [
  ...stakesPair("g5-p1", 640, "km", [400, 1000], 660, "trust", 1, "pool", "Road-trip distance ~640km; advice close to truth.", null),
  ...stakesPair("g5-p2", 3200, "people", [1500, 6000], 2000, "keep", 2, "pool", "Event attendance ~3200; advice far from truth.", null),
  ...stakesPair("g5-p3", 908, "kg", [500, 1500], 950, "none", 2, "pool", "Load weight ~908kg; no legitimate cue, advice happens close to truth.", null),
  ...stakesPair("g5-p4", 310, "km", [150, 600], 330, "trust", 1, "pool", "Delivery-run distance ~310km; advice close to truth.", null),
  ...stakesPair("g5-p5", 140, "responses", [60, 260], 90, "keep", 2, "pool", "Survey sample size ~140; advice far from truth.", null),
  ...stakesPair("g5-p6", 72, "hours", [24, 144], 110, "none", 3, "pool", "Shelf-life estimate ~72h; no legitimate cue, advice happens far from truth.", null),
];

const G5_PROBE: Record<"A" | "B" | "C", [DelegationItemSpec, DelegationItemSpec]> = {
  A: stakesPair("g5-fA", 520, "km", [250, 900], 540, "none", 2, "A", "Charter-route distance ~520km; no legitimate cue, advice happens close to truth.", null),
  B: stakesPair("g5-fB", 480, "km", [250, 900], 500, "none", 2, "B", "Regional-route distance ~480km; no legitimate cue, matched to form A's slot.", null),
  C: stakesPair("g5-fC", 560, "km", [250, 900], 585, "none", 2, "C", "Coastal-route distance ~560km; no legitimate cue, matched to form A's slot.", null),
};

// ─── g6-drift ───────────────────────────────────────────────────────────────

function rounds(r: [number, number, boolean][]): SequenceRound[] {
  return r.map(([advice, truth, isSeededError]) => ({ advice, truth, isSeededError }));
}

const G6_POOL: DelegationItemSpec[] = [
  sequenceItem({ itemId: "g6-p1", moduleKey: "g6-drift", formId: "pool", difficulty: 1, unit: "tickets", rounds: rounds([[45, 42, false], [70, 39, true], [40, 37, false]]), keyNote: "Rolling open-ticket count; round 2's advisor double-counted a channel.", keyVerifiedAt: null }),
  sequenceItem({ itemId: "g6-p2", moduleKey: "g6-drift", formId: "pool", difficulty: 2, unit: "people", rounds: rounds([[220, 205, false], [340, 200, true], [210, 198, false]]), keyNote: "Rolling headcount at a venue door; round 2's advisor extrapolated from a spike.", keyVerifiedAt: null }),
  sequenceItem({ itemId: "g6-p3", moduleKey: "g6-drift", formId: "pool", difficulty: 2, unit: "°C", rounds: rounds([[22, 21, false], [31, 20, true], [21, 19, false]]), keyNote: "Rolling room-temperature reading; round 2's advisor read a faulty sensor.", keyVerifiedAt: null }),
  sequenceItem({ itemId: "g6-p4", moduleKey: "g6-drift", formId: "pool", difficulty: 1, unit: "units", rounds: rounds([[500, 480, false], [180, 470, true], [460, 450, false]]), keyNote: "Rolling stock-on-hand estimate; round 2's advisor missed an incoming shipment.", keyVerifiedAt: null }),
  sequenceItem({ itemId: "g6-p5", moduleKey: "g6-drift", formId: "pool", difficulty: 3, unit: "views", rounds: rounds([[12000, 11500, false], [30000, 11000, true], [11800, 10900, false]]), keyNote: "Rolling page-view count; round 2's advisor counted a bot spike as real traffic.", keyVerifiedAt: null }),
  sequenceItem({ itemId: "g6-p6", moduleKey: "g6-drift", formId: "pool", difficulty: 2, unit: "minutes", rounds: rounds([[15, 14, false], [40, 13, true], [14, 12, false]]), keyNote: "Rolling delivery-ETA estimate; round 2's advisor didn't account for a cleared jam.", keyVerifiedAt: null }),
];

const G6_PROBE: Record<"A" | "B" | "C", DelegationItemSpec> = {
  A: sequenceItem({ itemId: "g6-fA", moduleKey: "g6-drift", formId: "A", difficulty: 2, unit: "tickets", rounds: rounds([[50, 47, false], [80, 44, true], [45, 42, false]]), keyNote: "Rolling ticket-count sequence, matched to pool template.", keyVerifiedAt: null }),
  B: sequenceItem({ itemId: "g6-fB", moduleKey: "g6-drift", formId: "B", difficulty: 2, unit: "tickets", rounds: rounds([[48, 45, false], [78, 43, true], [44, 41, false]]), keyNote: "Rolling ticket-count sequence, matched to form A's slot.", keyVerifiedAt: null }),
  C: sequenceItem({ itemId: "g6-fC", moduleKey: "g6-drift", formId: "C", difficulty: 2, unit: "tickets", rounds: rounds([[52, 49, false], [82, 46, true], [47, 44, false]]), keyNote: "Rolling ticket-count sequence, matched to form A's slot.", keyVerifiedAt: null }),
};

// ─── Assembly ───────────────────────────────────────────────────────────────

export const ITEM_SPECS: DelegationItemSpec[] = [
  ...G1_POOL, G1_PROBE.A, G1_PROBE.B, G1_PROBE.C,
  ...G2_POOL, G2_PROBE.A, G2_PROBE.B, G2_PROBE.C,
  ...G3_POOL, G3_PROBE.A, G3_PROBE.B, G3_PROBE.C,
  ...G4_POOL, G4_PROBE.A, G4_PROBE.B, G4_PROBE.C,
  ...G5_POOL, ...G5_PROBE.A, ...G5_PROBE.B, ...G5_PROBE.C,
  ...G6_POOL, G6_PROBE.A, G6_PROBE.B, G6_PROBE.C,
];

export const ITEM_SPEC_BY_ID: Map<string, DelegationItemSpec> = new Map(ITEM_SPECS.map((i) => [i.itemId, i]));
