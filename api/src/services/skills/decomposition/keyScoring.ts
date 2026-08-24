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
import { decompositionEvidence as ev } from "../../../content/skills/decomposition/v1/evidence";
import { pluralKey } from "../evidenceText";
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

// ─── Shared evidence phrasing ──────────────────────────────────────────────
// Four criteria say the same thing from three call sites each (arrangement,
// repair fix, real work). Building the line once per criterion is what keeps
// the `en`/`fa` tables in step with the code that reads them.

/** Persian uses its own comma; joining with an ASCII one reads as a typo. */
function listSeparator(locale: Locale): string {
  return locale === "fa" ? "، " : ", ";
}

/** D2, everywhere. */
export function bfiEvidence(locale: Locale, bfi: number | null): string {
  return bfi == null ? ev(locale, "d2.tooFewTop") : ev(locale, "d2.bfi", { bfi: bfi.toFixed(2) });
}

/** D3. `phase` distinguishes "you placed both" from "both are still there after your fix". */
export function overlapEvidence(
  locale: Locale,
  violatedPairs: [string, string][] | string[][],
  phase: "placed" | "present"
): string {
  if (!violatedPairs.length) {
    return ev(locale, phase === "placed" ? "d3.noOverlapPlaced" : "d3.noOverlapPresent");
  }
  const pairs = violatedPairs.map((p) => p.join(" + ")).join(listSeparator(locale));
  const key =
    phase === "placed"
      ? pluralKey(violatedPairs.length, "d3.overlapPlacedOne", "d3.overlapPlacedMany")
      : pluralKey(violatedPairs.length, "d3.stillOverlapOne", "d3.stillOverlapMany");
  return ev(locale, key, { pairs });
}

/** D5. */
export function dependencyEvidence(
  locale: Locale,
  dependency: { missingOrInverted: unknown[]; falselyOrdered: unknown[] },
  phase: "placed" | "present"
): string {
  const wrong = dependency.missingOrInverted.length > 0 || dependency.falselyOrdered.length > 0;
  if (!wrong) return ev(locale, "d5.match");
  return ev(locale, phase === "placed" ? "d5.mismatchPlaced" : "d5.mismatchFix");
}

/** D6. */
export function coverageEvidence(
  locale: Locale,
  coverage: { missing: string[]; required: number }
): string {
  if (coverage.missing.length) {
    return ev(locale, "d6.missing", { missing: coverage.missing.join(listSeparator(locale)) });
  }
  return ev(locale, pluralKey(coverage.required, "d6.allPresentOne", "d6.allPresentMany"), {
    required: coverage.required,
  });
}

/** Arrangement items: pieces come from a palette, so placement is a direct id match. */
export function scoreArrangement(
  nodes: SubmittedNode[],
  dependsOn: SubmittedEdge[],
  addEventsInOrder: NodeAddedPayload[],
  key: DecompositionKey,
  locale: Locale
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
    ? { level: 0, evidence: ev(locale, "d4.monolithPlaced") }
    : { level: 2, evidence: ev(locale, "d4.monolithAvoided") };

  return {
    d2: { level: bf.level, bfi: bf.bfi, evidence: bfiEvidence(locale, bf.bfi) },
    d3: {
      level: overlap.level,
      evidence: overlapEvidence(locale, overlap.violatedPairs, "placed"),
    },
    d4,
    d5: { level: dependency.level, evidence: dependencyEvidence(locale, dependency, "placed") },
    d6: {
      level: coverage.level,
      found: coverage.found,
      required: coverage.required,
      evidence: coverageEvidence(locale, coverage),
    },
  };
}

/**
 * Control items: the correct response is to leave the problem whole. D4 is
 * the only criterion with teeth — over-decomposed iff more than one node
 * exists at all (build plan §4.5). The others are vacuous with an empty key:
 * nothing to overlap, no dependency to mark, nothing required to cover.
 */
export function scoreControl(nodeCount: number, locale: Locale): KeyedScores {
  const overDecomposed = isOverDecomposedControl(nodeCount);
  return {
    d2: { level: null, bfi: null, evidence: ev(locale, "d2.controlNotApplicable") },
    d3: { level: 2, evidence: ev(locale, "d3.controlNothing") },
    d4: overDecomposed
      ? { level: 0, evidence: ev(locale, "d4.controlSplit", { count: nodeCount }) }
      : { level: 2, evidence: ev(locale, "d4.controlWhole") },
    d5: { level: 2, evidence: ev(locale, "d5.controlNone") },
    d6: { level: 2, found: 0, required: 0, evidence: ev(locale, "d6.controlNone") },
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

  const unboundedEvidence = () =>
    ev(locale, pluralKey(unbounded, "d4.unboundedLeavesOne", "d4.unboundedLeavesMany"), {
      count: unbounded,
    });

  if (fault === "monolith") {
    if (finalNodeCount <= 1) return { level: 0, evidence: ev(locale, "d4.repairStillSingle") };
    if (unbounded >= 2) return { level: 0, evidence: unboundedEvidence() };
    if (unbounded === 1) return { level: 1, evidence: unboundedEvidence() };
    return { level: 2, evidence: ev(locale, "d4.repairSplitOk") };
  }

  // premature_split
  if (finalNodeCount >= 4) {
    return { level: 0, evidence: ev(locale, "d4.repairStillMany", { count: finalNodeCount }) };
  }
  if (finalNodeCount > 1) {
    return { level: 1, evidence: ev(locale, "d4.repairMergedPartly", { count: finalNodeCount }) };
  }
  if (unbounded >= 1) return { level: 1, evidence: ev(locale, "d4.repairMergedUnbounded") };
  return { level: 2, evidence: ev(locale, "d4.repairMergedOk") };
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
    : { level: 2 as RubricLevel, evidence: ev(locale, "d4.repairNotThisFault") };

  return {
    d3: {
      level: overlap.level,
      evidence: overlapEvidence(locale, overlap.violatedPairs, "present"),
    },
    d4,
    d5: { level: dependency.level, evidence: dependencyEvidence(locale, dependency, "present") },
    d6: {
      level: coverage.level,
      found: coverage.found,
      required: coverage.required,
      evidence: coverageEvidence(locale, coverage),
    },
  };
}
