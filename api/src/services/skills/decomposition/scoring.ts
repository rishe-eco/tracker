/**
 * Assembles a `DecompositionScore` from an item's key and a learner's
 * submitted structure, and the mastery verdict over a module's attempts.
 * Build plan §3 (score/mastery JSON shapes), §4.7 (mastery).
 *
 * **A documented extension of the spec's scoring-source table.** The spec
 * (§4) lists D3 and D6 as the only criteria needing a judge on free-authored
 * (breakdown) items. Working through the wire contract, D5 has the identical
 * problem: "compare placed `dependsOn` edges against the key's
 * `blockingEdges`" requires knowing *which* of the learner's own-invented node
 * ids corresponds to *which* key piece — the same identity-matching gap that
 * makes D3/D6 judge-dependent. So on breakdown items, without a judge, D5
 * degrades alongside D3/D6 rather than being silently guessed at. Repair
 * items don't have this problem: node identity survives the fix for every
 * fault except `monolith`/`premature_split` (see `v1/spec.ts`'s `repairItem`
 * docstring), so repair is fully key-scored regardless of a judge — matching
 * the build plan's "Repair | No [judge needed]" row exactly. Revisit this
 * note when Phase 6 adds real breakdown-item matching.
 */

import type {
  DecompositionCriterionId,
  DecompositionItemType,
  DecompositionKey,
  FaultTag,
  Locale,
} from "../../../content/skills/decomposition/types";
import { DECOMPOSITION_CRITERIA } from "../../../content/skills/decomposition/types";
import type { MasteryGap } from "../mastery";
import { scoreD4FreeAuthoring, scoreWholeStatement } from "./detectors";
import { breadthFirstIndex, granularityDiscrimination, isOverDecomposedControl, type NodeAddedPayload, type RubricLevel } from "./metrics";
import {
  bfiEvidence,
  scoreArrangement,
  scoreControl,
  scoreRepairFix,
  type KeyedCriterionResult,
  type KeyedScores,
} from "./keyScoring";
import { decompositionEvidence as ev } from "../../../content/skills/decomposition/v1/evidence";

export type SubmittedNode = {
  id: string;
  parentId: string | null;
  label: string;
  doneWhen: string;
  order: number;
  dependsOn: string[];
};

export type DecompositionStructure = {
  whole: { statement: string; doneWhen: string };
  nodes: SubmittedNode[];
};

export type DecompositionCriterionScore = {
  id: DecompositionCriterionId;
  level: RubricLevel | null;
  scoredBy: "detector" | "instrumentation" | "key" | "unscored";
  evidence: string;
};

export type DecompositionScore = {
  criteria: DecompositionCriterionScore[];
  total: number;
  scoredCount: number;
  coverage: { found: number; required: number } | null;
  bfi: number | null;
  overDecomposed: boolean;
  isVoid: boolean;
  /** True only when all six criteria carry a level — the bar mastery needs. */
  isComplete: boolean;
};

export const DECOMPOSITION_MASTERY_MIN_TOTAL = 10;

function nodesToEdges(nodes: SubmittedNode[]): [string, string][] {
  // A node's `dependsOn` lists ids it must wait for — so each entry is an
  // edge [blocker, blocked] = [dep, node.id].
  return nodes.flatMap((n) => n.dependsOn.map((dep): [string, string] => [dep, n.id]));
}

function leavesOf(nodes: SubmittedNode[]): SubmittedNode[] {
  const parentIds = new Set(nodes.map((n) => n.parentId).filter((id): id is string => id != null));
  return nodes.filter((n) => !parentIds.has(n.id));
}

export type AssembleInput = {
  item: { type: DecompositionItemType; key: DecompositionKey; seededFault?: FaultTag };
  structure: DecompositionStructure;
  /** `node_added` check-event payloads, in the order they were logged. */
  addEventsInOrder: NodeAddedPayload[];
  /** True iff the `whole_stated` event predates the first `node_added` event. */
  wholeStatedFirst: boolean;
  /** The item's own scenario/prompt text, same locale, for the near-copy check (D1). */
  itemPrompt: string;
  locale: Locale;
  /** Whether a judge is configured — Phase 6. Always `false` in this build. */
  judgeAvailable: boolean;
};

export function assembleDecompositionScore(input: AssembleInput): DecompositionScore {
  const { item, structure, locale } = input;
  const nodes = structure.nodes;
  const isVoid = !structure.whole.statement.trim() && nodes.length === 0;

  const d1 = isVoid
    ? { level: 0 as RubricLevel, evidence: ev(locale, "nothingSubmitted") }
    : scoreWholeStatement({
        statement: structure.whole.statement,
        doneWhen: structure.whole.doneWhen,
        itemPrompt: input.itemPrompt,
        pieceExistedFirst: !input.wholeStatedFirst,
        locale,
      });

  const dependsOn = nodesToEdges(nodes);
  const finalDepth1Ids = new Set(nodes.filter((n) => n.parentId === null).map((n) => n.id));
  const leaves = leavesOf(nodes);

  let d2: KeyedCriterionResult;
  let d3: KeyedCriterionResult;
  let d4: KeyedCriterionResult;
  let d5: KeyedCriterionResult;
  let d6: KeyedCriterionResult;
  let coverage: { found: number; required: number } | null = null;
  let bfi: number | null = null;

  if (isVoid) {
    d2 = d3 = d4 = d5 = d6 = { level: null, evidence: ev(locale, "nothingSubmitted") };
  } else if (item.type === "arrangement") {
    const scored: KeyedScores = scoreArrangement(nodes, dependsOn, input.addEventsInOrder, item.key, locale);
    ({ d2, d3, d4, d5, d6 } = scored);
    bfi = scored.d2.bfi;
    coverage = { found: scored.d6.found, required: scored.d6.required };
  } else if (item.type === "control") {
    const scored: KeyedScores = scoreControl(nodes.length, locale);
    ({ d2, d3, d4, d5, d6 } = scored);
  } else if (item.type === "repair") {
    // A fix that only edits/removes pre-seeded pieces — never adding a fresh
    // one — has no authoring order for D2 to judge at all. Scoring it via the
    // general formula would read as depth-first (0) rather than not
    // applicable, and since mastery requires *no* criterion at 0, that would
    // make every edit-in-place repair permanently ineligible.
    if (input.addEventsInOrder.length === 0) {
      d2 = { level: null, evidence: ev(locale, "d2.noAuthoringOrder") };
      bfi = null;
    } else {
      const bf = breadthFirstIndex(input.addEventsInOrder, finalDepth1Ids);
      d2 = { level: bf.level, evidence: bfiEvidence(locale, bf.bfi) };
      bfi = bf.bfi;
    }
    const fault = item.seededFault ?? "overlap";
    const scored = scoreRepairFix(fault, nodes, dependsOn, leaves, item.key, locale);
    ({ d3, d4, d5, d6 } = scored);
    coverage = { found: scored.d6.found, required: scored.d6.required };
  } else {
    // breakdown: free authoring. D1/D2/D4(boundedness) resolve with no model;
    // D3/D5/D6 need matching free text to the key's concepts, which is a
    // judge's job (see the file header note on D5).
    const bf = breadthFirstIndex(input.addEventsInOrder, finalDepth1Ids);
    d2 = { level: bf.level, evidence: bfiEvidence(locale, bf.bfi) };
    bfi = bf.bfi;
    d4 = scoreD4FreeAuthoring(
      leaves.map((l) => ({ id: l.id, doneWhen: l.doneWhen, splitAnAtomicPiece: false })),
      locale
    );
    // Phase 6 branches here on input.judgeAvailable; until then every
    // breakdown item degrades to self-diagnosis against the revealed key.
    const unscored = { level: null as null, evidence: ev(locale, "needsJudge") };
    d3 = unscored;
    d5 = unscored;
    d6 = unscored;
  }

  const criteria: DecompositionCriterionScore[] = [
    { id: "D1", level: isVoid ? 0 : d1.level, scoredBy: "detector", evidence: d1.evidence },
    { id: "D2", level: d2.level, scoredBy: d2.level == null ? "unscored" : "instrumentation", evidence: d2.evidence },
    { id: "D3", level: d3.level, scoredBy: d3.level == null ? "unscored" : "key", evidence: d3.evidence },
    { id: "D4", level: d4.level, scoredBy: d4.level == null ? "unscored" : item.type === "breakdown" ? "detector" : "key", evidence: d4.evidence },
    { id: "D5", level: d5.level, scoredBy: d5.level == null ? "unscored" : "key", evidence: d5.evidence },
    { id: "D6", level: d6.level, scoredBy: d6.level == null ? "unscored" : "key", evidence: d6.evidence },
  ];

  const scored = criteria.filter((c) => c.level !== null);
  const overDecomposed = item.type === "control" && isOverDecomposedControl(nodes.length);

  return {
    criteria,
    total: isVoid ? 0 : scored.reduce((sum, c) => sum + (c.level as number), 0),
    scoredCount: scored.length,
    coverage,
    bfi,
    overDecomposed,
    isVoid,
    isComplete: !isVoid && scored.length === DECOMPOSITION_CRITERIA.length,
  };
}

// ─── Real-work practice (§8) ────────────────────────────────────────────────

export type AssembleRealWorkInput = {
  structure: DecompositionStructure;
  /** `node_added` check-event payloads, in the order they were logged. */
  addEventsInOrder: NodeAddedPayload[];
  /** True iff the `whole_stated` event predates the first `node_added` event. */
  wholeStatedFirst: boolean;
  /** The target Goal/Project's own title + DoD, for the D1 near-copy check. */
  itemPrompt: string;
  locale: Locale;
};

/**
 * Real-work material has no authored item and therefore no key — not "no
 * judge yet" the way a breakdown item's D3/D5/D6 are, but permanently, by
 * construction: there is nothing to compare overlap, dependency or coverage
 * against. D1 and D2 are unaffected (they never needed a key). D4 degrades
 * to leaf-boundedness only, the same shape `scoreD4FreeAuthoring` already
 * gives a breakdown item when nothing is marked atomic. Reuses exactly the
 * detector/instrumentation paths `assembleDecompositionScore`'s `breakdown`
 * branch uses — this function differs only in never having D3/D5/D6 to
 * offer, scored or not.
 */
export function assembleRealWorkScore(input: AssembleRealWorkInput): DecompositionScore {
  const { structure, locale } = input;
  const nodes = structure.nodes;
  const isVoid = !structure.whole.statement.trim() && nodes.length === 0;

  const d1 = isVoid
    ? { level: 0 as RubricLevel, evidence: ev(locale, "nothingSubmitted") }
    : scoreWholeStatement({
        statement: structure.whole.statement,
        doneWhen: structure.whole.doneWhen,
        itemPrompt: input.itemPrompt,
        pieceExistedFirst: !input.wholeStatedFirst,
        locale,
      });

  const finalDepth1Ids = new Set(nodes.filter((n) => n.parentId === null).map((n) => n.id));
  const leaves = leavesOf(nodes);

  let d2: KeyedCriterionResult = { level: null, evidence: ev(locale, "nothingSubmitted") };
  let d4: KeyedCriterionResult = { level: null, evidence: ev(locale, "nothingSubmitted") };
  let bfi: number | null = null;

  if (!isVoid) {
    const bf = breadthFirstIndex(input.addEventsInOrder, finalDepth1Ids);
    d2 = { level: bf.level, evidence: bfiEvidence(locale, bf.bfi) };
    bfi = bf.bfi;
    d4 = scoreD4FreeAuthoring(
      leaves.map((l) => ({ id: l.id, doneWhen: l.doneWhen, splitAnAtomicPiece: false })),
      locale
    );
  }

  const noKey = ev(locale, "noKey");

  const criteria: DecompositionCriterionScore[] = [
    { id: "D1", level: isVoid ? 0 : d1.level, scoredBy: "detector", evidence: d1.evidence },
    { id: "D2", level: d2.level, scoredBy: d2.level == null ? "unscored" : "instrumentation", evidence: d2.evidence },
    { id: "D3", level: null, scoredBy: "unscored", evidence: noKey },
    { id: "D4", level: d4.level, scoredBy: d4.level == null ? "unscored" : "detector", evidence: d4.evidence },
    { id: "D5", level: null, scoredBy: "unscored", evidence: noKey },
    { id: "D6", level: null, scoredBy: "unscored", evidence: noKey },
  ];

  const scored = criteria.filter((c) => c.level !== null);

  return {
    criteria,
    total: isVoid ? 0 : scored.reduce((sum, c) => sum + (c.level as number), 0),
    scoredCount: scored.length,
    coverage: null,
    bfi,
    overDecomposed: false,
    isVoid,
    // D3/D5/D6 can never be scored here, so "complete" is unreachable by
    // construction — consistent with real-work never counting toward
    // mastery (engine §4: open_practice earns feedback and history only).
    isComplete: false,
  };
}

// ─── Mastery (§4.7) ─────────────────────────────────────────────────────────

export type ScoredDecompositionAttempt = {
  score: DecompositionScore;
  moduleKey: string;
  itemType: DecompositionItemType;
  /** "YYYY-MM-DD" in the learner's own timezone. */
  dayKey: string;
  /** Step-6-equivalent attempts only; a revision never earns mastery. */
  unscaffolded: boolean;
  /** The criterion this module trains, so mastery can require it at level 2. */
  ownCriterion: DecompositionCriterionId;
};

export type DecompositionMasteryVerdict = { mastered: boolean; unmetCriteria: MasteryGap[] };

const MASTERY_CONSECUTIVE = 2;
const MASTERY_MIN_DISTINCT_DAYS = 2;

/**
 * Mastered = on two consecutive unscaffolded items across two distinct
 * calendar days: total >= 10/12, no criterion at 0, level 2 on the module's
 * own criterion, and no over-decomposition on any control item in the
 * window. All four clauses are load-bearing (spec §7) — a globally strong
 * decomposer could otherwise coast to mastery on `d5` while leaving
 * dependencies unmarked, and coverage without granularity discrimination is a
 * learner who breaks everything down and calls it rigour.
 */
export function evaluateDecompositionMastery(attempts: ScoredDecompositionAttempt[]): DecompositionMasteryVerdict {
  const unscaffolded = attempts.filter((a) => a.unscaffolded && !a.score.isVoid);
  const window = unscaffolded.slice(-MASTERY_CONSECUTIVE);
  const unmet: MasteryGap[] = [];

  if (window.length < MASTERY_CONSECUTIVE) {
    unmet.push({ code: "attempts", count: window.length, required: MASTERY_CONSECUTIVE });
  }

  const incomplete = window.find((a) => !a.score.isComplete);
  if (incomplete) {
    unmet.push({ code: "rubricIncomplete", count: DECOMPOSITION_CRITERIA.length - incomplete.score.scoredCount });
  }

  const atBar = window.filter((a) => atCriterion(a));
  if (atBar.length < MASTERY_CONSECUTIVE) {
    unmet.push({
      code: "atCriterion",
      count: atBar.length,
      required: MASTERY_CONSECUTIVE,
      minTotal: DECOMPOSITION_MASTERY_MIN_TOTAL,
    });
  }

  const distinctDays = new Set(window.map((a) => a.dayKey)).size;
  if (window.length >= MASTERY_CONSECUTIVE && distinctDays < MASTERY_MIN_DISTINCT_DAYS) {
    unmet.push({ code: "days", count: distinctDays, required: MASTERY_MIN_DISTINCT_DAYS });
  }

  const controlOverDecomposed = attempts.some((a) => a.itemType === "control" && a.score.overDecomposed);
  if (controlOverDecomposed) {
    unmet.push({ code: "overDecomposedControl" });
  }

  return { mastered: unmet.length === 0, unmetCriteria: unmet };
}

/** Did this attempt clear the bar for its module? Requires the module's own criterion at level 2. */
export function atCriterion(attempt: ScoredDecompositionAttempt): boolean {
  const { score } = attempt;
  if (!score.isComplete) return false;
  if (score.total < DECOMPOSITION_MASTERY_MIN_TOTAL) return false;
  if (score.criteria.some((c) => c.level === 0)) return false;
  return score.criteria.find((c) => c.id === attempt.ownCriterion)?.level === 2;
}

export { granularityDiscrimination };
