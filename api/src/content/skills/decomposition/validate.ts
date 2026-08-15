/**
 * Decomposition content-pack validator.
 *
 * Runs in CI and in a unit test, never at request time. Mirrors
 * `clarity/validate.ts`'s shape; the rules below are specific to a tree
 * artifact rather than prose. Spec: `03-decomposition-lab.md` §11, build plan
 * §3 (the exact rule table) and §4.6 (the arrangement-key coherence checks).
 *
 * The rule with no Clarity or Evidence equivalent is `key-incoherent`: a key
 * can be internally consistent-looking and still score wrongly — a decoy
 * marked required, an overlap pair that could never both be placed, a cycle
 * in the blocking graph. **A wrong key does not fail loudly; it silently
 * produces a wrong score**, which is the exact failure this tool teaches
 * people to catch, so the validator is the one place it must be caught first.
 */

import {
  CRITERION_BY_FAULT,
  DECOMPOSITION_MODULE_KEYS,
  type DecompositionItemSpec,
  type DecompositionItemType,
  type DecompositionKey,
  type DecompositionModuleKey,
  type Locale,
} from "./types";
import { buildDecompositionPack, ITEM_SPECS } from "./v1";
import { RUBRIC_CRITERIA_BY_MODULE } from "./v1/rubric";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

const LOCALES: Locale[] = ["en", "fa"];

/** Settled in the build plan (§3): the content-count floor, per module. */
export const MIN_POOL_ITEMS_PER_MODULE = 6;
export const MIN_CONTROL_ITEMS_PER_MODULE = 2;
export const MIN_OFFLINE_ITEMS_PER_MODULE = 3;
export const PROBE_FORM_IDS = ["A", "B", "C"] as const;
export const PROBE_ITEMS_PER_FORM = 6;
export const MIN_CONTROL_ITEMS_PER_FORM = 2;

/** Item types whose criteria all resolve against the key, with no judge involved at all. */
const KEY_ONLY_TYPES: DecompositionItemType[] = ["arrangement", "repair", "control"];

export function isKeyOnly(type: DecompositionItemType): boolean {
  return KEY_ONLY_TYPES.includes(type);
}

export function validateDecompositionContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  // ── Structural integrity ────────────────────────────────────────────────
  const seen = new Set<string>();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.itemId)) err("duplicate-item-id", `Item id "${spec.itemId}" is used more than once.`);
    seen.add(spec.itemId);

    if (!DECOMPOSITION_MODULE_KEYS.includes(spec.moduleKey)) {
      err("unknown-module", `Item "${spec.itemId}" references unknown module "${spec.moduleKey}".`);
    }

    if (spec.type === "repair" && !spec.seededFault) {
      err("repair-without-fault", `Repair drill "${spec.itemId}" has no seededFault.`);
    }
    if (spec.type === "repair" && (!spec.suppliedTree || spec.suppliedTree.length === 0)) {
      err("repair-without-tree", `Repair drill "${spec.itemId}" has no suppliedTree.`);
    }

    // The named rule from build plan §3: a seeded fault must train its own module's criterion.
    if (spec.seededFault) {
      const faultCriterion = CRITERION_BY_FAULT[spec.seededFault];
      const ownCriterion = RUBRIC_CRITERIA_BY_MODULE[spec.moduleKey];
      if (faultCriterion !== ownCriterion) {
        err(
          "fault-off-module",
          `Item "${spec.itemId}" sits in ${spec.moduleKey} (criterion ${ownCriterion}) but seeds "${spec.seededFault}" (criterion ${faultCriterion}). Diagnosis accuracy is scored against the seeded fault, so a mismatch mis-scores the module it's filed under.`
        );
      }
    }

    if (spec.type === "arrangement") {
      checkKeyCoherence(spec, err);
    }
  }

  // ── Practice coverage, per module ───────────────────────────────────────
  for (const moduleKey of DECOMPOSITION_MODULE_KEYS) {
    const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
    if (pool.length < MIN_POOL_ITEMS_PER_MODULE) {
      err(
        "pool-too-small",
        `Module "${moduleKey}" has ${pool.length} practice item(s); at least ${MIN_POOL_ITEMS_PER_MODULE} are needed.`
      );
    }
    const controls = pool.filter((i) => i.type === "control");
    if (controls.length < MIN_CONTROL_ITEMS_PER_MODULE) {
      err(
        "control-ratio",
        `Module "${moduleKey}" has ${controls.length} control item(s) in its pool; at least ${MIN_CONTROL_ITEMS_PER_MODULE} are needed.`
      );
    }
    const keyOnly = pool.filter((i) => isKeyOnly(i.type));
    if (keyOnly.length < MIN_OFFLINE_ITEMS_PER_MODULE) {
      err(
        "pool-not-offline",
        `Module "${moduleKey}" has ${keyOnly.length} key-only (no-judge) item(s) of ${MIN_OFFLINE_ITEMS_PER_MODULE} required. ` +
          `A pool that's mostly free-authored breakdown items degrades every practice attempt's D3/D6 to feedback-only on an install with no credential.`
      );
    }
  }

  // ── Probe forms ──────────────────────────────────────────────────────────
  for (const formId of PROBE_FORM_IDS) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);
    if (form.length !== PROBE_ITEMS_PER_FORM) {
      err(
        "form-composition",
        `Probe form ${formId} has ${form.length} item(s); exactly ${PROBE_ITEMS_PER_FORM} are required (${MIN_CONTROL_ITEMS_PER_FORM} control, the rest decomposable).`
      );
    }
    const controls = form.filter((i) => i.type === "control");
    if (controls.length < MIN_CONTROL_ITEMS_PER_FORM) {
      err(
        "control-ratio",
        `Probe form ${formId} has ${controls.length} control item(s); at least ${MIN_CONTROL_ITEMS_PER_FORM} (roughly a third) are required.`
      );
    }
    const nonControl = form.filter((i) => i.type !== "control");
    if (nonControl.some((i) => i.type !== "arrangement")) {
      err(
        "form-composition",
        `Probe form ${formId} has a non-control, non-arrangement item — probe items must be arrangement type, the only one that is fully keyable, offline, and reproducible.`
      );
    }
  }

  // ── Matched forms: same modules, same difficulty profile ────────────────
  const formA = ITEM_SPECS.filter((i) => i.formId === "A");
  for (const formId of ["B", "C"] as const) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);
    const moduleSetA = new Set(formA.map((i) => i.moduleKey));
    const moduleSetOther = new Set(form.map((i) => i.moduleKey));
    if (moduleSetA.size !== moduleSetOther.size || [...moduleSetA].some((m) => !moduleSetOther.has(m))) {
      err("form-mismatch", `Probe form ${formId} does not cover the same modules as form A.`);
    }
  }

  // ── Locale parity ───────────────────────────────────────────────────────
  const packs = new Map<Locale, ReturnType<typeof buildDecompositionPack>>();
  for (const locale of LOCALES) {
    const pack = safeBuild(locale, err);
    if (pack) packs.set(locale, pack);
  }

  const base = packs.get("en");
  if (base) {
    for (const locale of LOCALES) {
      const pack = packs.get(locale);
      if (!pack || locale === "en") continue;

      const baseIds = new Set(base.items.map((i) => i.itemId));
      const otherIds = new Set(pack.items.map((i) => i.itemId));
      for (const id of baseIds) {
        if (!otherIds.has(id)) err("locale-parity", `Item "${id}" exists in en but not in ${locale}.`);
      }
      for (const id of otherIds) {
        if (!baseIds.has(id)) err("locale-parity", `Item "${id}" exists in ${locale} but not in en.`);
      }

      for (const item of pack.items) {
        if (!item.surface.scenario.trim()) {
          err("empty-surface", `Item "${item.itemId}" has an empty ${locale} scenario.`);
        }
        for (const piece of item.key.pieces) {
          if (!item.surface.pieceLabels[piece.id]?.trim()) {
            err("empty-surface", `Item "${item.itemId}" has no ${locale} label for piece "${piece.id}".`);
          }
        }
        if (item.type === "repair") {
          if (!item.surface.suppliedWhole?.statement?.trim()) {
            err("empty-surface", `Repair item "${item.itemId}" has no ${locale} suppliedWhole statement.`);
          }
          for (const node of item.suppliedTree ?? []) {
            if (!item.surface.suppliedNodeLabels?.[node.id]?.trim()) {
              err("empty-surface", `Repair item "${item.itemId}" has no ${locale} label for supplied node "${node.id}".`);
            }
          }
        }
      }

      if (pack.reviewStatus === "draft") {
        warn(
          "locale-draft",
          `Locale "${locale}" is machine-drafted and awaiting native review. Surfaced in the UI; not a blocker for practice.`
        );
      }
    }
  }

  // ── Probe readiness ─────────────────────────────────────────────────────
  for (const spec of ITEM_SPECS) {
    if (spec.formId === "pool") continue;
    if (!spec.keyVerifiedAt) {
      warn(
        "key-unverified",
        `Item "${spec.itemId}" has no keyVerifiedAt — usable in practice, blocked from probes until a human re-checks the key.`
      );
    }
  }

  return issues;
}

/**
 * The arrangement-key coherence checks (build plan §4.6). A key can compile
 * fine and score wrongly, so each of these is a shape the key must not have.
 */
function checkKeyCoherence(spec: DecompositionItemSpec, err: (code: string, message: string) => void) {
  const key: DecompositionKey = spec.key;
  const pieceById = new Map(key.pieces.map((p) => [p.id, p]));
  const decoyIds = new Set(key.pieces.filter((p) => p.decoy).map((p) => p.id));
  const requiredIds = new Set(key.requiredPieceIds);

  for (const id of key.requiredPieceIds) {
    if (decoyIds.has(id)) {
      err("key-incoherent", `Item "${spec.itemId}": piece "${id}" is both required and a decoy.`);
    }
    if (!pieceById.has(id)) {
      err("key-incoherent", `Item "${spec.itemId}": requiredPieceIds references unknown piece "${id}".`);
    }
  }

  for (const [a, b] of key.overlapPairs) {
    if (requiredIds.has(a) && requiredIds.has(b)) {
      err(
        "key-incoherent",
        `Item "${spec.itemId}": overlap pair ["${a}", "${b}"] are both required — they could never both be correctly placed.`
      );
    }
  }

  for (const [blocker, blocked] of key.blockingEdges) {
    if (decoyIds.has(blocker) || decoyIds.has(blocked)) {
      err("key-incoherent", `Item "${spec.itemId}": blocking edge ["${blocker}", "${blocked}"] references a decoy.`);
    }
  }

  if (hasCycle(key.blockingEdges)) {
    err("key-incoherent", `Item "${spec.itemId}": blockingEdges contains a cycle.`);
  }

  const blockingPairs = new Set(key.blockingEdges.map(([a, b]) => pairKey(a, b)));
  for (const [a, b] of key.independentPairs) {
    if (blockingPairs.has(pairKey(a, b))) {
      err(
        "key-incoherent",
        `Item "${spec.itemId}": pair ["${a}", "${b}"] appears in both blockingEdges and independentPairs.`
      );
    }
  }

  for (const piece of key.pieces) {
    if (piece.intendedDepth === 2) {
      const hasPossibleParent = key.pieces.some((p) => p.id !== piece.id && p.intendedDepth === 1);
      if (!hasPossibleParent) {
        err("key-incoherent", `Item "${spec.itemId}": piece "${piece.id}" is depth 2 but no depth-1 piece exists to be its parent.`);
      }
    }
  }
}

const pairKey = (a: string, b: string) => [a, b].sort().join("::");

function hasCycle(edges: [string, string][]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push(b);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const [a] of edges) {
    if (dfs(a)) return true;
  }
  return false;
}

function safeBuild(locale: Locale, err: (code: string, message: string) => void) {
  try {
    return buildDecompositionPack(locale);
  } catch (e: any) {
    err("locale-build-failed", `Could not build "${locale}" pack: ${e.message}`);
    return null;
  }
}

/** True when nothing blocks the pack from serving practice sessions. */
export function isServable(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}

/** True when the pack can serve a *scored probe* — the stricter bar. */
export function isProbeReady(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === "error" || i.code === "key-unverified");
}
