/**
 * Pure, deterministic metrics — no database, no clock, no model. Build plan
 * §4.1 (breadth-first index), §4.4 (coverage/overlap rates), §4.5 (granularity
 * discrimination).
 */

export type RubricLevel = 0 | 1 | 2;

// ─── D2: breadth-first index ───────────────────────────────────────────────

export type NodeAddedPayload = { nodeId: string; depth: 1 | 2 };

export type BreadthFirstResult = {
  /** null when the structure has fewer than two top-level pieces — nothing to be breadth-first about. */
  bfi: number | null;
  level: RubricLevel | null;
};

/**
 * `addEventsInOrder` is every `node_added` event for the attempt, in the order
 * they were logged — the payload's `depth` is what the learner reported *at
 * the time*, not after any later `node_moved`. `finalDepth1Ids` is `T`: the
 * ids sitting at depth 1 in the structure the learner actually submitted.
 *
 * `node_moved` is deliberately absent from this function's inputs: rearranging
 * afterwards does not retroactively make the authoring breadth-first, and
 * letting it would delete the only behavioural measure this tool has.
 */
export function breadthFirstIndex(
  addEventsInOrder: NodeAddedPayload[],
  finalDepth1Ids: ReadonlySet<string>,
  opts: { arrangementDepthAllCorrect?: boolean } = {}
): BreadthFirstResult {
  const T = [...finalDepth1Ids];
  if (T.length < 2) return { bfi: null, level: null };

  const firstDeepEventIdx = addEventsInOrder.findIndex((e) => e.depth >= 2);
  const firstDeepIdx = firstDeepEventIdx === -1 ? Infinity : firstDeepEventIdx;

  const firstAddIndexOf = new Map<string, number>();
  addEventsInOrder.forEach((e, i) => {
    if (!firstAddIndexOf.has(e.nodeId)) firstAddIndexOf.set(e.nodeId, i);
  });

  const before = T.filter((id) => (firstAddIndexOf.get(id) ?? Infinity) < firstDeepIdx).length;
  const bfi = before / T.length;

  let level: RubricLevel = bfi === 1 ? 2 : bfi >= 0.5 ? 1 : 0;
  // Arrangement items additionally require every piece at the depth the key
  // specifies — a structure can be perfectly breadth-first in *order* and
  // still put a piece at the wrong level.
  if (level === 2 && opts.arrangementDepthAllCorrect === false) level = 1;

  return { bfi, level };
}

// ─── D6 coverage / D3 overlap on keyed structures ──────────────────────────

export type CoverageResult = { level: RubricLevel; found: number; required: number; missing: string[] };

/** D6: every `requiredPieceId` placed exactly once, at most one decoy placed. */
export function scoreCoverage(
  placedPieceIds: ReadonlySet<string>,
  requiredPieceIds: readonly string[],
  decoyPieceIds: readonly string[]
): CoverageResult {
  const missing = requiredPieceIds.filter((id) => !placedPieceIds.has(id));
  const decoysPlaced = decoyPieceIds.filter((id) => placedPieceIds.has(id)).length;

  let level: RubricLevel;
  if (missing.length >= 2) level = 0;
  else if (missing.length === 1) level = 1;
  else level = decoysPlaced <= 1 ? 2 : 1;

  return { level, found: requiredPieceIds.length - missing.length, required: requiredPieceIds.length, missing };
}

export type OverlapResult = { level: RubricLevel; violatedPairs: [string, string][] };

/** D3: no overlap pair may have both members placed. */
export function scoreOverlap(
  placedPieceIds: ReadonlySet<string>,
  overlapPairs: readonly [string, string][]
): OverlapResult {
  const violated = overlapPairs.filter(([a, b]) => placedPieceIds.has(a) && placedPieceIds.has(b));
  const level: RubricLevel = violated.length >= 2 ? 0 : violated.length === 1 ? 1 : 2;
  return { level, violatedPairs: violated };
}

// ─── D5 dependency comparison ───────────────────────────────────────────────

export type DependencyResult = { level: RubricLevel; missingOrInverted: [string, string][]; falselyOrdered: [string, string][] };

/**
 * Compare the learner's placed `dependsOn` edges against the key's
 * `blockingEdges` and `independentPairs`. `placedEdges` is `[blocker, blocked]`
 * pairs as the learner marked them.
 */
export function scoreDependency(
  placedEdges: readonly [string, string][],
  blockingEdges: readonly [string, string][],
  independentPairs: readonly [string, string][]
): DependencyResult {
  const placedSet = new Set(placedEdges.map(([a, b]) => `${a}::${b}`));

  const missingOrInverted = blockingEdges.filter(([blocker, blocked]) => {
    const forward = placedSet.has(`${blocker}::${blocked}`);
    return !forward;
  });

  const falselyOrdered = independentPairs.filter(
    ([a, b]) => placedSet.has(`${a}::${b}`) || placedSet.has(`${b}::${a}`)
  );

  const faults = missingOrInverted.length + falselyOrdered.length;
  const level: RubricLevel = faults >= 2 ? 0 : faults === 1 ? 1 : 2;
  return { level, missingOrInverted, falselyOrdered };
}

// ─── Granularity discrimination (§4.5) ──────────────────────────────────────

/**
 * `discrimination = (D4 level-2 rate on decomposable items) − (over-decomposition rate on control items)`.
 * Reported beside the rubric total, never alone — a learner who shatters
 * everything into pieces has not learned decomposition; they have acquired a
 * different failure, and coverage alone cannot see it.
 */
export function granularityDiscrimination(opts: {
  decomposableD4Level2Count: number;
  decomposableCount: number;
  overDecomposedControlCount: number;
  controlCount: number;
}): number | null {
  if (opts.decomposableCount === 0 || opts.controlCount === 0) return null;
  const rightSizedRate = opts.decomposableD4Level2Count / opts.decomposableCount;
  const overDecompositionRate = opts.overDecomposedControlCount / opts.controlCount;
  return rightSizedRate - overDecompositionRate;
}

/** A control item is over-decomposed iff it has more than one node — the whole point is to leave it whole. */
export function isOverDecomposedControl(nodeCount: number): boolean {
  return nodeCount > 1;
}
