/**
 * Clarity content-pack validator.
 *
 * Runs in CI and in a unit test, never at request time. Every rule below
 * corresponds to something that, left unchecked, produces a tool that looks like
 * it works and quietly teaches or measures the wrong thing.
 *
 * Two rules here have no Evidence Lab equivalent and are the interesting ones:
 *
 * 1. **Offline coverage per module.** Clarity's item types differ in whether
 *    they need a model at all — revision and repair ship everything they need,
 *    elicitation cannot. A module whose pool is all elicitation looks fully
 *    stocked and is empty on an install with no credential.
 *
 * 2. **Repair drills must be satisfiable.** The weak text has to fail its own
 *    criterion under the detector, and the authored exemplar fix has to clear
 *    it. Without that, a drill can teach something the rubric then marks wrong
 *    and nothing anywhere notices.
 *
 * Spec: 01-clarity-lab.md §5, §10; build plan 01a §3, §5.
 */

import { CLARITY_MODULE_KEYS, type ClarityItemType, type Locale } from "./types";
import { buildClarityPack, ITEM_SPECS } from "./v1";
import { RUBRIC_CRITERIA_BY_MODULE } from "./v1/rubric";
import { runDetectors } from "../../../services/skills/clarity/detectors";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

const LOCALES: Locale[] = ["en", "fa"];

/** Practice items per module. Settled 2026-08-01 — see build plan 01a §1. */
export const MIN_POOL_ITEMS_PER_MODULE = 3;

/**
 * Item types that run with no model configured.
 *
 * Revision ships its reader misread in the pack, so the gap reveal is a
 * playback rather than a generation. Repair is detector-scored. Elicitation
 * needs a live reader responding to the learner's own text — it cannot be
 * authored, by definition.
 */
const OFFLINE_TYPES: ClarityItemType[] = ["revision", "repair"];

export function isOfflineCapable(type: ClarityItemType): boolean {
  return OFFLINE_TYPES.includes(type);
}

export function validateClarityContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  // ── Structural integrity ────────────────────────────────────────────────
  const seen = new Set<string>();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.itemId)) err("duplicate-item-id", `Item id "${spec.itemId}" is used more than once.`);
    seen.add(spec.itemId);

    if (!CLARITY_MODULE_KEYS.includes(spec.moduleKey)) {
      err("unknown-module", `Item "${spec.itemId}" references unknown module "${spec.moduleKey}".`);
    }

    // An item trains its module's criterion or it belongs in another module.
    const own = RUBRIC_CRITERIA_BY_MODULE[spec.moduleKey];
    if (spec.type !== "elicitation" && own && !spec.seededFaults.includes(own)) {
      err(
        "fault-off-module",
        `Item "${spec.itemId}" sits in ${spec.moduleKey} (criterion ${own}) but seeds ${
          spec.seededFaults.join(", ") || "nothing"
        }. Diagnosis accuracy is scored against seededFaults, so an item that doesn't fail its own criterion mis-scores the module it's filed under.`
      );
    }

    if (spec.type === "elicitation" && spec.requiredSlots.length === 0) {
      err(
        "no-required-slots",
        `Elicitation item "${spec.itemId}" marks no required context slots, so R3 has nothing to score against.`
      );
    }
    if (spec.type === "repair" && !spec.repairCheck) {
      err("repair-without-check", `Repair drill "${spec.itemId}" has no repairCheck.`);
    }
  }

  // ── Practice coverage, per module ───────────────────────────────────────
  for (const moduleKey of CLARITY_MODULE_KEYS) {
    const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
    if (pool.length < MIN_POOL_ITEMS_PER_MODULE) {
      err(
        "pool-too-small",
        `Module "${moduleKey}" has ${pool.length} practice item(s); at least ${MIN_POOL_ITEMS_PER_MODULE} are needed.`
      );
    }
    const offline = pool.filter((i) => isOfflineCapable(i.type));
    if (offline.length < MIN_POOL_ITEMS_PER_MODULE) {
      err(
        "pool-not-offline",
        `Module "${moduleKey}" has ${offline.length} practice item(s) that run without a model, of ${MIN_POOL_ITEMS_PER_MODULE} required. ` +
          `An all-elicitation pool looks stocked and is empty on an install with no credential.`
      );
    }
  }

  // ── Repair drills must be satisfiable ───────────────────────────────────
  // English only: `fa` routes R4 and R6 to the judge rather than to detectors
  // (pro-drop, ezāfe, اسم‌مصدر), so there is no detector to run against the
  // Persian surface and no honest check to make here.
  const en = safeBuild("en", err);
  for (const item of en?.items ?? []) {
    if (item.type !== "repair" || !item.repairCheck) continue;
    const { criterion, requiredLevel } = item.repairCheck;

    const weak = item.surface.weakText;
    if (!weak) {
      err("repair-without-text", `Repair drill "${item.itemId}" has no weakText.`);
      continue;
    }
    const weakLevel = runDetectors(weak, [criterion])[0]?.level;
    if (weakLevel === undefined) {
      err("repair-criterion-undetectable", `"${item.itemId}" checks ${criterion}, which has no detector.`);
      continue;
    }
    if (weakLevel >= requiredLevel) {
      err(
        "repair-not-faulty",
        `Repair drill "${item.itemId}" already scores ${criterion} at level ${weakLevel} before the learner touches it — the seeded fault is not detectable, so the drill teaches nothing and the rubric disagrees with it.`
      );
    }

    const fix = item.surface.exemplarFix;
    if (!fix) {
      err(
        "repair-without-exemplar",
        `Repair drill "${item.itemId}" has no exemplarFix, so nothing proves the drill can be passed.`
      );
      continue;
    }
    const fixLevel = runDetectors(fix, [criterion])[0]?.level ?? 0;
    if (fixLevel < requiredLevel) {
      err(
        "repair-unsatisfiable",
        `Repair drill "${item.itemId}" requires ${criterion} at level ${requiredLevel}, but its own exemplar fix only reaches ${fixLevel}. The drill cannot be passed as specified.`
      );
    }
  }

  // ── Locale parity ───────────────────────────────────────────────────────
  const packs = new Map<Locale, ReturnType<typeof buildClarityPack>>();
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
        if (item.type !== "elicitation" && !item.surface.weakText?.trim()) {
          err("empty-surface", `Item "${item.itemId}" has no ${locale} weakText.`);
        }
        if (item.type === "revision" && !item.surface.authoredMisread?.trim()) {
          err(
            "missing-misread",
            `Revision item "${item.itemId}" has no ${locale} authoredMisread — the misread is what lets revision items run offline.`
          );
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

function safeBuild(locale: Locale, err: (code: string, message: string) => void) {
  try {
    return buildClarityPack(locale);
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
