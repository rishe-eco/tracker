/**
 * Verification content-pack validator.
 *
 * Runs in CI and in a unit test, never at request time. Mirrors
 * `decomposition/validate.ts`'s shape. Spec: `04-verification-lab.md` §5, §9,
 * §12; build plan §3 Phase 2 (the exact rule table).
 *
 * Two rules have no equivalent in the build plan's table and are this file's
 * own resolution of a gap in it, recorded here rather than silently:
 *
 * - `no-oracle-bears-on-claim` — `bench-no-discriminating` (≥1 discriminating
 *   entry) is stated as unconditional in the build plan, but a `NO_ORACLE`
 *   item is defined (spec §5) as one where **nothing on the bench can settle
 *   the claim**. Applying `bench-no-discriminating` to `NO_ORACLE` items would
 *   make every one of them a validator error. Resolved by exempting
 *   `NO_ORACLE` from that rule and adding this one instead: every bench entry
 *   on a `NO_ORACLE` item must have `discriminating: false` **and**
 *   `bearsOnClaim: false` — the item is unsolvable by construction, not by
 *   omission.
 * - `verdict-profile-mismatch` — the build plan's `VerificationItemSpec`
 *   leaves `keyVerdict` free-form per item; this validator pins it to the
 *   profile (`CORRECT` → `supported`, `NO_ORACLE` → `cannot_verify`,
 *   `STALE_ASSUMPTION` → `outdated`, every other faulty profile →
 *   `unsupported`) so the mapping is authored once, in code, rather than
 *   re-decided per item with room to drift.
 */

import {
  ORACLE_CLASS_BY_PROFILE,
  VERDICT_BY_PROFILE,
  VERIFICATION_MODULE_KEYS,
  cheapestSufficientCost,
  isControlProfile,
  type Locale,
  type VerificationItemSpec,
} from "./types";
import { buildVerificationPack, ITEM_SPECS } from "./v1";

export type ValidationIssue = { severity: "error" | "warning"; code: string; message: string };

const LOCALES: Locale[] = ["en", "fa"];
const PERSIAN_DIGITS = /[۰-۹٠-٩]/;

export const MIN_POOL_ITEMS_PER_MODULE = 6;
export const MIN_CONTROL_ITEMS_PER_MODULE = 2;
export const PROBE_FORM_IDS = ["A", "B", "C"] as const;
export const PROBE_ITEMS_PER_FORM = 6;
export const MIN_CONTROL_ITEMS_PER_FORM = 2;
export const BENCH_SIZE = 6;
export const MIN_ELEMENTS = 4;
export const MIN_DECOYS = 2;

export function validateVerificationContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  const seen = new Set<string>();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.itemId)) err("duplicate-item-id", `Item id "${spec.itemId}" is used more than once.`);
    seen.add(spec.itemId);

    if (!VERIFICATION_MODULE_KEYS.includes(spec.moduleKey)) {
      err("unknown-module", `Item "${spec.itemId}" references unknown module "${spec.moduleKey}".`);
    }

    if (spec.oracleClass !== ORACLE_CLASS_BY_PROFILE[spec.profile]) {
      err(
        "oracle-class-mismatch",
        `Item "${spec.itemId}": profile "${spec.profile}" implies oracleClass "${ORACLE_CLASS_BY_PROFILE[spec.profile]}", not "${spec.oracleClass}".`
      );
    }

    if (spec.keyVerdict !== VERDICT_BY_PROFILE[spec.profile]) {
      err(
        "verdict-profile-mismatch",
        `Item "${spec.itemId}": profile "${spec.profile}" implies keyVerdict "${VERDICT_BY_PROFILE[spec.profile]}", not "${spec.keyVerdict}".`
      );
    }

    checkBench(spec, err);
    checkElements(spec, err);

    if (spec.profile === "NO_ORACLE" && !spec.notWorthChecking) {
      err("no-oracle-not-worth-checking", `Item "${spec.itemId}" is NO_ORACLE but notWorthChecking is false — nothing on this bench should ever be worth spending on.`);
    }
    if (spec.notWorthChecking && spec.profile !== "NO_ORACLE") {
      err("not-worth-checking-off-control", `Item "${spec.itemId}" sets notWorthChecking but is not a NO_ORACLE item.`);
    }
  }

  // ── Practice coverage, per module ───────────────────────────────────────
  for (const moduleKey of VERIFICATION_MODULE_KEYS) {
    const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
    if (pool.length < MIN_POOL_ITEMS_PER_MODULE) {
      err("pool-too-small", `Module "${moduleKey}" has ${pool.length} practice item(s); at least ${MIN_POOL_ITEMS_PER_MODULE} are needed.`);
    }
    const controls = pool.filter((i) => isControlProfile(i.profile));
    if (controls.length < MIN_CONTROL_ITEMS_PER_MODULE) {
      err("control-ratio", `Module "${moduleKey}" has ${controls.length} control item(s) in its pool; at least ${MIN_CONTROL_ITEMS_PER_MODULE} are needed.`);
    }
    if (!pool.some((i) => i.profile === "CORRECT")) {
      err("control-ratio", `Module "${moduleKey}"'s pool has no CORRECT control item.`);
    }
    if (!pool.some((i) => i.profile === "NO_ORACLE")) {
      err("control-ratio", `Module "${moduleKey}"'s pool has no NO_ORACLE control item.`);
    }
    const classes = new Set(pool.map((i) => i.oracleClass));
    if (classes.size < 4) {
      err("oracle-class-coverage", `Module "${moduleKey}"'s pool spans ${classes.size} oracle class(es) (${[...classes].join(", ")}); all 4 (partial, metamorphic, full, none) are required, or the module measures one habit rather than a skill.`);
    }
  }

  // ── Probe forms ──────────────────────────────────────────────────────────
  for (const formId of PROBE_FORM_IDS) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);
    if (form.length !== PROBE_ITEMS_PER_FORM) {
      err("form-composition", `Probe form ${formId} has ${form.length} item(s); exactly ${PROBE_ITEMS_PER_FORM} are required.`);
    }
    const controls = form.filter((i) => isControlProfile(i.profile));
    if (controls.length < MIN_CONTROL_ITEMS_PER_FORM) {
      err("control-ratio", `Probe form ${formId} has ${controls.length} control item(s); at least ${MIN_CONTROL_ITEMS_PER_FORM} (roughly a third) are required.`);
    }
    const classes = new Set(form.map((i) => i.oracleClass));
    if (classes.size < 4) {
      err("oracle-class-coverage", `Probe form ${formId} spans ${classes.size} oracle class(es); all 4 are required.`);
    }
    const moduleSet = new Set(form.map((i) => i.moduleKey));
    if (moduleSet.size !== VERIFICATION_MODULE_KEYS.length) {
      err("form-composition", `Probe form ${formId} does not cover all six modules exactly once.`);
    }
  }

  // ── Matched forms: same module → profile/difficulty mapping ─────────────
  const formA = ITEM_SPECS.filter((i) => i.formId === "A");
  for (const formId of ["B", "C"] as const) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);
    for (const a of formA) {
      const match = form.find((i) => i.moduleKey === a.moduleKey);
      if (!match) continue;
      if (match.profile !== a.profile || match.difficulty !== a.difficulty) {
        err(
          "form-mismatch",
          `Probe form ${formId}'s "${match.moduleKey}" slot (profile ${match.profile}, difficulty ${match.difficulty}) doesn't match form A's (profile ${a.profile}, difficulty ${a.difficulty}).`
        );
      }
    }
  }

  // ── Locale parity ────────────────────────────────────────────────────────
  const packs = new Map<Locale, ReturnType<typeof buildVerificationPack>>();
  for (const locale of LOCALES) {
    const pack = safeBuild(locale, err);
    if (pack) packs.set(locale, pack);
  }

  const base = packs.get("en");
  if (base) {
    for (const locale of LOCALES) {
      const pack = packs.get(locale);
      if (!pack) continue;

      if (locale !== "en") {
        const baseIds = new Set(base.items.map((i) => i.itemId));
        const otherIds = new Set(pack.items.map((i) => i.itemId));
        for (const id of baseIds) if (!otherIds.has(id)) err("locale-parity", `Item "${id}" exists in en but not in ${locale}.`);
        for (const id of otherIds) if (!baseIds.has(id)) err("locale-parity", `Item "${id}" exists in ${locale} but not in en.`);
      }

      for (const item of pack.items) {
        if (!item.surface.ask.trim() || !item.surface.answer.trim()) {
          err("empty-surface", `Item "${item.itemId}" has an empty ${locale} ask or answer.`);
        }
        for (const entry of item.bench) {
          if (!item.surface.checkLabels[entry.checkId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} label for check "${entry.checkId}".`);
          if (!item.surface.checkOutcomes[entry.checkId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} outcome for check "${entry.checkId}".`);
        }
        for (const element of item.elements) {
          if (!item.surface.elementLabels[element.elementId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} label for element "${element.elementId}".`);
        }
      }

      const allStrings = pack.items.flatMap((i) => [
        i.surface.ask,
        i.surface.answer,
        ...Object.values(i.surface.checkLabels),
        ...Object.values(i.surface.checkOutcomes),
        ...Object.values(i.surface.elementLabels),
      ]);
      for (const s of allStrings) {
        if (PERSIAN_DIGITS.test(s)) {
          err("no-persian-digits", `Locale "${locale}" has a Persian-digit character in surface text — Western digits only (04-verification-lab.md §10, §4a).`);
          break;
        }
      }

      if (pack.reviewStatus === "draft") {
        warn("locale-draft", `Locale "${locale}" is machine-drafted and awaiting native review. Surfaced in the UI; not a blocker for practice.`);
      }
    }
  }

  // ── Probe readiness ───────────────────────────────────────────────────────
  for (const spec of ITEM_SPECS) {
    if (spec.formId === "pool") continue;
    if (!spec.keyVerifiedAt) {
      warn("key-unverified", `Item "${spec.itemId}" has no keyVerifiedAt — usable in practice, blocked from probes until a human re-derives the authored outcomes and confirms the key.`);
    }
  }

  return issues;
}

function checkBench(spec: VerificationItemSpec, err: (code: string, message: string) => void) {
  if (spec.bench.length !== BENCH_SIZE) {
    err("bench-size", `Item "${spec.itemId}" has ${spec.bench.length} bench entries; exactly ${BENCH_SIZE} are required.`);
  }

  const checkIds = new Set<string>();
  for (const entry of spec.bench) {
    if (checkIds.has(entry.checkId)) err("duplicate-check-id", `Item "${spec.itemId}": checkId "${entry.checkId}" repeated.`);
    checkIds.add(entry.checkId);
  }

  const discriminating = spec.bench.filter((b) => b.discriminating);
  const nonIndependent = spec.bench.filter((b) => !b.independent);

  if (spec.profile === "NO_ORACLE") {
    const settling = spec.bench.filter((b) => b.discriminating || b.bearsOnClaim);
    if (settling.length > 0) {
      err(
        "no-oracle-bears-on-claim",
        `Item "${spec.itemId}" is NO_ORACLE but ${settling.length} bench entry(ies) are discriminating or bear on the claim — nothing should settle an unverifiable claim.`
      );
    }
  } else {
    if (discriminating.length === 0) {
      err("bench-no-discriminating", `Item "${spec.itemId}" has no discriminating bench entry — the item is unsolvable and V3 is unscoreable.`);
    }
    if (discriminating.length === spec.bench.length) {
      err("bench-all-discriminating", `Item "${spec.itemId}" has every bench entry discriminating — V3 is free and the item measures nothing.`);
    }
    if (cheapestSufficientCost(spec.bench) === null && !spec.notWorthChecking) {
      err("no-cheapest-cost", `Item "${spec.itemId}" has no discriminating entry to derive cheapestSufficientCost from.`);
    }
  }

  if (nonIndependent.length === 0) {
    err("bench-no-costume", `Item "${spec.itemId}" has no non-independent bench entry — the self-critique/confidence costumes must be present on every item to be recognisable (spec §10).`);
  }
}

function checkElements(spec: VerificationItemSpec, err: (code: string, message: string) => void) {
  if (spec.elements.length < MIN_ELEMENTS) {
    err("elements-too-few", `Item "${spec.itemId}" has ${spec.elements.length} elements; at least ${MIN_ELEMENTS} are required.`);
  }
  const decoys = spec.elements.filter((e) => e.decoy).length;
  if (decoys < MIN_DECOYS) {
    err("elements-no-decoys", `Item "${spec.itemId}" has ${decoys} decoy element(s); at least ${MIN_DECOYS} are required, or the list narrows to its own answer.`);
  }

  const isControl = isControlProfile(spec.profile);
  if (isControl && spec.failingElementId !== null) {
    err("element-key-missing", `Item "${spec.itemId}" is a control (${spec.profile}) but sets failingElementId — nothing fails on a control.`);
  }
  if (!isControl) {
    if (spec.failingElementId === null) {
      err("element-key-missing", `Item "${spec.itemId}" is faulty (${spec.profile}) but has no failingElementId.`);
    } else {
      const element = spec.elements.find((e) => e.elementId === spec.failingElementId);
      if (!element) err("element-key-missing", `Item "${spec.itemId}": failingElementId "${spec.failingElementId}" is not one of its elements.`);
      else if (element.decoy) err("element-key-missing", `Item "${spec.itemId}": failingElementId "${spec.failingElementId}" is marked as a decoy.`);
    }
  }
}

function safeBuild(locale: Locale, err: (code: string, message: string) => void) {
  try {
    return buildVerificationPack(locale);
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
