/**
 * Decomposition Lab content types.
 *
 * Same spec/surface split as the other two tools (00-skills-engine.md §5.1),
 * but the artifact is a **tree, not prose** (03-decomposition-lab.md §9), which
 * changes what "the key" has to describe.
 *
 * Four of six criteria resolve with no model at all: D1 is a detector over
 * event order, D2 is pure instrumentation (breadth-first index from
 * `node_added` timestamps), D4 is a detector plus a key lookup, D5 is a graph
 * comparison against the key. Only D3 and D6 on **free-authored** items need a
 * judge, and even then it degrades to self-diagnosis against a revealed key.
 * This is what makes the tool measurement-capable offline (build plan §2) —
 * so nothing here should quietly require a reader to be servable.
 */

import type { Difficulty, FormId, Locale } from "../types";

// Re-exported so the decomposition pack has one import surface.
export type { Difficulty, FormId, Locale };

export const DECOMPOSITION_MODULE_KEYS = [
  "d1-frame",
  "d2-breadth",
  "d3-seams",
  "d4-size",
  "d5-order",
  "d6-recompose",
] as const;
export type DecompositionModuleKey = (typeof DECOMPOSITION_MODULE_KEYS)[number];

/** The six rubric criteria, one per module. */
export const DECOMPOSITION_CRITERIA = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;
export type DecompositionCriterionId = (typeof DECOMPOSITION_CRITERIA)[number];

export type RubricLevel = 0 | 1 | 2;

/**
 * How a criterion gets its level. Unlike Clarity, "judge" never appears alone
 * here — the two criteria a judge can help with (D3, D6) always have a
 * key-only path too (arrangement items), and the judge only extends that path
 * to free-authored text. See `03-decomposition-lab.md` §4's scoring-split
 * table for the exact source per criterion.
 */
export type DecompositionScoringSource = "detector" | "instrumentation" | "key" | "key-or-judge";

export type DecompositionRubricCriterion = {
  id: DecompositionCriterionId;
  moduleKey: DecompositionModuleKey;
  scoredBy: DecompositionScoringSource;
  /** Short label, localised at render time via i18n, not here. */
  labelKey: string;
  /** Decision rules per level, transcribed from the spec's rubric table (§4). */
  levels: Record<RubricLevel, string>;
};

export type DecompositionItemType = "arrangement" | "breakdown" | "repair" | "control";

/**
 * One conceptual piece of a decomposition, as the *key* describes it —
 * locale-invariant. `decoy` and the fields that give away the answer
 * (`intendedDepth`, `atomic`) never reach the client; see
 * `toPublicDecompositionItem`.
 */
export type DecompositionPiece = {
  id: string;
  intendedDepth: 1 | 2;
  /** A piece the key says should not be split further. D4's other failure mode. */
  atomic: boolean;
  /** Arrangement only: a palette entry that is not part of the correct structure. */
  decoy: boolean;
};

/**
 * The answer key for an arrangement, breakdown, or repair-target structure.
 * Control items carry an empty key (`pieces: []`) — the correct response is to
 * leave the problem whole, so there is nothing to require.
 *
 * On arrangement items every field is checked directly. On breakdown items
 * (free authoring) `requiredPieceIds` and `overlapPairs` route through a judge
 * or self-diagnosis (D3, D6); `pieces[].atomic` still drives D4 by matching
 * against what the learner actually split.
 */
export type DecompositionKey = {
  pieces: DecompositionPiece[];
  /** Non-decoy piece ids the structure must cover exactly once (D6). */
  requiredPieceIds: string[];
  /** Pairs whose responsibilities must not both appear as separate pieces (D3). */
  overlapPairs: [string, string][];
  /** [blockerId, blockedId] — must be present and correctly directed (D5). */
  blockingEdges: [string, string][];
  /** Pairs the key says are independent — falsely ordering them costs D5 too. */
  independentPairs: [string, string][];
};

export const FAULT_TAGS = ["monolith", "overlap", "missing_element", "inverted_dependency", "premature_split"] as const;
export type FaultTag = (typeof FAULT_TAGS)[number];

/** Which criterion a seeded fault trains — a repair item's fault must match its module's own criterion. */
export const CRITERION_BY_FAULT: Record<FaultTag, DecompositionCriterionId> = {
  monolith: "D4",
  premature_split: "D4",
  overlap: "D3",
  missing_element: "D6",
  inverted_dependency: "D5",
};

/** A node in a **supplied** (repair) tree — locale-invariant shape, text lives in the surface. */
export type SuppliedNodeSpec = {
  id: string;
  parentId: string | null;
  depth: 1 | 2;
  /** This node's (possibly faulty) dependency edges, as authored into the supplied tree. */
  dependsOn?: string[];
};

export type DecompositionItemSpec = {
  itemId: string;
  moduleKey: DecompositionModuleKey;
  formId: FormId;
  difficulty: Difficulty;
  type: DecompositionItemType;
  /** Criteria this item is designed to exercise; must include the item's own module's criterion. */
  focusCriteria: DecompositionCriterionId[];
  /**
   * The answer key. Never reaches the client before submission — there is
   * deliberately no GraphQL field through which it can be requested.
   */
  key: DecompositionKey;
  /** Repair items only: the faulty tree the learner reads, diagnoses, and fixes. */
  suppliedTree?: SuppliedNodeSpec[];
  /** Repair items only: which fault is seeded, from the fixed tag set. */
  seededFault?: FaultTag;
  /** The reviewer's note — why this is the key, and what a re-verifier checks against. */
  keyNote: string;
  /** `null` blocks probe use (build plan §8); practice is unaffected. */
  keyVerifiedAt: string | null;
};

export type DecompositionItemSurface = {
  itemId: string;
  /** The whole problem, as the learner meets it. */
  scenario: string;
  /**
   * Piece id → display text. For **arrangement** items this is the palette
   * (public, sent to the client as candidates). For **breakdown** items it is
   * the answer-key text used to build the revealed key and the judge prompt —
   * private, the same withholding rule as Clarity's `exemplarFix`.
   */
  pieceLabels: Record<string, string>;
  /** Repair only: node id → display text for the supplied faulty tree (public — the learner reads and fixes this). */
  suppliedNodeLabels?: Record<string, string>;
  /** Repair only: the supplied tree's own whole-statement + done condition. */
  suppliedWhole?: { statement: string; doneWhen: string };
};

export type DecompositionModuleSurface = {
  moduleKey: DecompositionModuleKey;
  title: string;
  /** Step 1. One idea, ≤2 min, ≤250 words. */
  concept: string;
  /**
   * Step 2. A subgoal-labelled contrast: the same fragment decomposed well and
   * badly, with the difference named. Labels are load-bearing (spec §2) — an
   * unlabelled pair is the weak intervention.
   */
  model: string;
};

/** The unscored, re-openable aside naming the perishable costume (spec §3, `d0-costume`). */
export type CostumeAside = { title: string; body: string };

export type DecompositionPack = {
  skillKey: "decomposition";
  contentVersion: string;
  rubricVersion: string;
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  modules: DecompositionModuleSurface[];
  items: (DecompositionItemSpec & { surface: DecompositionItemSurface })[];
  costumeAside: CostumeAside;
};

/**
 * What the client may see before submission. No `key`, no `decoy`/`atomic`/
 * `intendedDepth` flags, no `seededFault` — an arrangement item's palette is
 * reduced to `{id, label}` pairs stripped of everything that would give the
 * placement away.
 */
export type PublicDecompositionItem = {
  itemId: string;
  moduleKey: DecompositionModuleKey;
  type: DecompositionItemType;
  difficulty: Difficulty;
  scenario: string;
  /** Arrangement only: the candidate pieces, order-scrambled by the caller. */
  palette: { id: string; label: string }[] | null;
  /** Repair only: the faulty tree to diagnose and fix. */
  suppliedTree: { id: string; parentId: string | null; depth: 1 | 2; label: string; dependsOn: string[] }[] | null;
  suppliedWhole: { statement: string; doneWhen: string } | null;
};

export function toPublicDecompositionItem(
  item: DecompositionItemSpec & { surface: DecompositionItemSurface }
): PublicDecompositionItem {
  const isArrangement = item.type === "arrangement";
  const isRepair = item.type === "repair";
  return {
    itemId: item.itemId,
    moduleKey: item.moduleKey,
    type: item.type,
    difficulty: item.difficulty,
    scenario: item.surface.scenario,
    palette: isArrangement
      ? item.key.pieces.map((p) => ({ id: p.id, label: item.surface.pieceLabels[p.id] ?? p.id }))
      : null,
    suppliedTree:
      isRepair && item.suppliedTree
        ? item.suppliedTree.map((n) => ({
            id: n.id,
            parentId: n.parentId,
            depth: n.depth,
            label: item.surface.suppliedNodeLabels?.[n.id] ?? n.id,
            dependsOn: n.dependsOn ?? [],
          }))
        : null,
    suppliedWhole: isRepair ? (item.surface.suppliedWhole ?? null) : null,
  };
}
