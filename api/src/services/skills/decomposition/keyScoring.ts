/**
 * Scoring against a `DecompositionKey` — arrangement and control items, where
 * every piece the learner can place has a server-known, stable id (a palette
 * entry, or nothing at all). No judge, no fuzzy matching: build plan §4.6.
 *
 * Free-authored items (breakdown, and a repair item's fix) cannot match this
 * way — the learner's node ids are their own invention, not palette ids — so
 * D3/D5/D6 on those degrade to self-diagnosis without a judge. That routing
 * lives in `scoring.ts`, not here.
 */

import type { DecompositionKey, FaultTag, Locale } from "../../../content/skills/decomposition/types";
import { isBounded } from "./detectors";
import {
  breadthFirstIndex,
  granularityDiscrimination,
  isOverDecomposedControl,
  scoreCoverage,
  scoreDependency,
  scoreOverlap,
  type NodeAddedPayload,
  type RubricLevel,
} from "./metrics";

export type { RubricLevel };
export { granularityDiscrimination, isOverDecomposedControl };

export type SubmittedNode = { id: string; parentId: string | null };
export type SubmittedEdge = [string, string];

export type KeyedCriterionResult = { level: RubricLevel | null; evidence: string };

export type KeyedScores = {
  d2: KeyedCriterionResult & { bfi: number | null };
  d3: KeyedCriterionResult;
  d4: KeyedCriterionResult;
  d5: KeyedCriterionResult;
  d6: KeyedCriterionResult & { found: number; required: number };
};

/**
 * A decoy id that starts with `monolith_` — the content pack's own naming
 * convention (verified by `decompositionContent.unit.test.ts`) rather than a
 * schema field, since every arrangement item's one monolith-style decoy is
 * authored with that prefix. If a later content pack drops the convention,
 * this stops recognising the piece and D4 degrades to "no monolith fault
 * found" rather than mis-scoring — worth revisiting if content authoring
 * moves away from the prefix.
 */
function isMonolithDecoy(id: string): boolean {
  return id.startsWith("monolith_");
}

/** Arrangement items: pieces come from a palette, so placement is a direct id match. */
export function scoreArrangement(
  nodes: SubmittedNode[],
  dependsOn: SubmittedEdge[],
  addEventsInOrder: NodeAddedPayload[],
  key: DecompositionKey
): KeyedScores {
  const placedIds = new Set(nodes.map((n) => n.id));
  const finalDepth1Ids = new Set(nodes.filter((n) => n.parentId === null).map((n) => n.id));

  const pieceById = new Map(key.pieces.map((p) => [p.id, p]));
  const depthAllCorrect = [...placedIds].every((id) => {
    const piece = pieceById.get(id);
    if (!piece) return true; // stray id — not this function's job to police
    const actualDepth = finalDepth1Ids.has(id) ? 1 : 2;
    return actualDepth === piece.intendedDepth;
  });

  const bf = breadthFirstIndex(addEventsInOrder, finalDepth1Ids, { arrangementDepthAllCorrect: depthAllCorrect });
  const decoyIds = key.pieces.filter((p) => p.decoy).map((p) => p.id);
  const coverage = scoreCoverage(placedIds, key.requiredPieceIds, decoyIds);
  const overlap = scoreOverlap(placedIds, key.overlapPairs);
  const dependency = scoreDependency(dependsOn, key.blockingEdges, key.independentPairs);

  const monolithPlaced = [...placedIds].some(isMonolithDecoy);
  const d4: KeyedCriterionResult = monolithPlaced
    ? { level: 0, evidence: "The monolith option was placed instead of the right-sized pieces." }
    : { level: 2, evidence: "The monolith option was not placed." };

  return {
    d2: { level: bf.level, bfi: bf.bfi, evidence: bf.bfi == null ? "Fewer than two top-level pieces." : `Breadth-first index ${bf.bfi.toFixed(2)}.` },
    d3: { level: overlap.level, evidence: overlap.violatedPairs.length ? `Overlapping pair(s) both placed: ${overlap.violatedPairs.map((p) => p.join(" + ")).join(", ")}.` : "No overlapping pair both placed." },
    d4,
    d5: { level: dependency.level, evidence: dependency.missingOrInverted.length || dependency.falselyOrdered.length ? "A required blocking relation was missing/inverted, or an independent pair was falsely ordered." : "Dependencies match the key." },
    d6: { level: coverage.level, found: coverage.found, required: coverage.required, evidence: coverage.missing.length ? `Missing: ${coverage.missing.join(", ")}.` : `All ${coverage.required} required pieces present.` },
  };
}

/**
 * Control items: the correct response is to leave the problem whole. D4 is
 * the only criterion with teeth — over-decomposed iff more than one node
 * exists at all (build plan §4.5). The others are vacuous with an empty key:
 * nothing to overlap, no dependency to mark, nothing required to cover.
 */
export function scoreControl(nodeCount: number): KeyedScores {
  const overDecomposed = isOverDecomposedControl(nodeCount);
  return {
    d2: { level: null, bfi: null, evidence: "Not applicable to a control item." },
    d3: { level: 2, evidence: "Nothing to overlap." },
    d4: overDecomposed
      ? { level: 0, evidence: `Split into ${nodeCount} pieces; this task was already one checkable piece.` }
      : { level: 2, evidence: "Left whole, as the task already was." },
    d5: { level: 2, evidence: "No dependency to mark." },
    d6: { level: 2, found: 0, required: 0, evidence: "Nothing required beyond the whole itself." },
  };
}

/**
 * `monolith`/`premature_split` repair items are graded by node count against
 * the key's expected piece count plus leaf boundedness — the fault *is* the
 * granularity, so there is no piece identity to match against (build plan
 * §4.3's free-authoring D4 rule, specialised to a repair where the whole
 * faulty piece is replaced rather than edited in place).
 */
export function scoreD4RepairGranularity(
  fault: "monolith" | "premature_split",
  finalNodeCount: number,
  leaves: { doneWhen: string }[],
  locale: Locale
): KeyedCriterionResult {
  const unbounded = leaves.filter((l) => !isBounded(l.doneWhen, locale)).length;

  if (fault === "monolith") {
    if (finalNodeCount <= 1) return { level: 0, evidence: "Still a single unsplit piece." };
    if (unbounded >= 2) return { level: 0, evidence: `${unbounded} leaves with no bounded done condition.` };
    if (unbounded === 1) return { level: 1, evidence: "One leaf with no bounded done condition." };
    return { level: 2, evidence: "Split into checkable pieces." };
  }

  // premature_split
  if (finalNodeCount >= 4) return { level: 0, evidence: `Still ${finalNodeCount} pieces for one atomic action.` };
  if (finalNodeCount > 1) return { level: 1, evidence: `Merged to ${finalNodeCount} pieces; one atomic action needs one.` };
  if (unbounded >= 1) return { level: 1, evidence: "Merged to one piece, but its done condition isn't bounded." };
  return { level: 2, evidence: "Merged back into one checkable piece." };
}

/**
 * The repair fix, scored the same way arrangement is — direct id match, no
 * judge — because node identity survives the fix for every fault *except*
 * `monolith`/`premature_split` (content design note in `v1/spec.ts`'s
 * `repairItem` docstring). Those two route D4 through the node-count check
 * above instead of `scoreCoverage`/`scoreOverlap`/`scoreDependency`.
 */
export function scoreRepairFix(
  seededFault: FaultTag,
  nodes: SubmittedNode[],
  dependsOn: SubmittedEdge[],
  leaves: { doneWhen: string }[],
  key: DecompositionKey,
  locale: Locale
): Omit<KeyedScores, "d2"> {
  const placedIds = new Set(nodes.map((n) => n.id));
  const decoyIds = key.pieces.filter((p) => p.decoy).map((p) => p.id);

  const isGranularityFault = seededFault === "monolith" || seededFault === "premature_split";

  const overlap = scoreOverlap(placedIds, key.overlapPairs);
  const coverage = scoreCoverage(placedIds, key.requiredPieceIds, decoyIds);
  const dependency = scoreDependency(dependsOn, key.blockingEdges, key.independentPairs);

  const d4 = isGranularityFault
    ? scoreD4RepairGranularity(seededFault as "monolith" | "premature_split", nodes.length, leaves, locale)
    : { level: 2 as RubricLevel, evidence: "Not this item's fault type; boundedness only." };

  return {
    d3: { level: overlap.level, evidence: overlap.violatedPairs.length ? `Overlapping pair(s) still both present: ${overlap.violatedPairs.map((p) => p.join(" + ")).join(", ")}.` : "No overlapping pair both present." },
    d4,
    d5: { level: dependency.level, evidence: dependency.missingOrInverted.length || dependency.falselyOrdered.length ? "A blocking relation is still missing/inverted, or an independent pair is falsely ordered." : "Dependencies match the key." },
    d6: { level: coverage.level, found: coverage.found, required: coverage.required, evidence: coverage.missing.length ? `Missing: ${coverage.missing.join(", ")}.` : `All ${coverage.required} required pieces present.` },
  };
}
