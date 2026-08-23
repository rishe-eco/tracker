/**
 * Delegation content-pack validator.
 *
 * Runs in CI and in a unit test, never at request time. Mirrors
 * `verification/validate.ts`'s shape. Spec: `05-delegation-lab.md` §4, §5,
 * §7, §12; build plan §3 Phase 2 (the exact rule table) and §4.1-4.4 (the
 * arithmetic the rules protect).
 *
 * `advice-balance` and `cue-balance` are scoped to `CUE_SCOPED_MODULES`
 * (g1/g2/g3/g5) — see `types.ts`'s header note on why `split` and `sequence`
 * items carry no single truth/advice/cueDirection to balance.
 */

import {
  CUE_SCOPED_MODULES,
  DELEGATION_MODULE_KEYS,
  G6_ROUNDS,
  isAdviceGood,
  type DelegationItemSpec,
  type Locale,
} from "./types";
import { buildDelegationPack, ITEM_SPECS } from "./v1";

export type ValidationIssue = { severity: "error" | "warning"; code: string; message: string };

const LOCALES: Locale[] = ["en", "fa"];
const PERSIAN_DIGITS = /[۰-۹٠-٩]/;

export const MIN_POOL_ITEMS_PER_MODULE = 6;
export const PROBE_FORM_IDS = ["A", "B", "C"] as const;
export const PROBE_ITEMS_PER_FORM = 6;
export const BALANCE_TOLERANCE_ITEMS = 1;

export function validateDelegationContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  const seen = new Set<string>();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.itemId)) err("duplicate-item-id", `Item id "${spec.itemId}" is used more than once.`);
    seen.add(spec.itemId);

    if (!DELEGATION_MODULE_KEYS.includes(spec.moduleKey)) {
      err("unknown-module", `Item "${spec.itemId}" references unknown module "${spec.moduleKey}".`);
    }

    checkShape(spec, err);
  }

  // ── Practice coverage, per module ───────────────────────────────────────
  for (const moduleKey of DELEGATION_MODULE_KEYS) {
    const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
    const unitCount = moduleKey === "g5-stakes" ? pool.length / 2 : pool.length;
    if (unitCount < MIN_POOL_ITEMS_PER_MODULE) {
      err(
        "pool-too-small",
        `Module "${moduleKey}" has ${unitCount} pool unit(s) (${moduleKey === "g5-stakes" ? "pairs" : moduleKey === "g6-drift" ? "sequences" : "items"}); at least ${MIN_POOL_ITEMS_PER_MODULE} are needed.`
      );
    }
    if (CUE_SCOPED_MODULES.includes(moduleKey)) {
      checkCueBalance(pool, `module "${moduleKey}"'s pool`, err);
      checkAdviceBalance(pool, `module "${moduleKey}"'s pool`, err);
    }
  }

  // ── Stakes pairing ───────────────────────────────────────────────────────
  const stakesGroups = new Map<string, DelegationItemSpec[]>();
  for (const spec of ITEM_SPECS) {
    if (spec.kind !== "stakes" || !spec.stakesPairId) continue;
    const group = stakesGroups.get(spec.stakesPairId) ?? [];
    group.push(spec);
    stakesGroups.set(spec.stakesPairId, group);
  }
  for (const [pairId, group] of stakesGroups) {
    if (group.length !== 2) {
      err("stakes-orphan", `Stakes pair "${pairId}" has ${group.length} item(s); exactly 2 are required.`);
      continue;
    }
    const roles = new Set(group.map((i) => i.stakesRole));
    if (!roles.has("low") || !roles.has("high")) {
      err("stakes-orphan", `Stakes pair "${pairId}" must have one "low" and one "high" role.`);
    }
  }

  // ── Probe forms ──────────────────────────────────────────────────────────
  // "6 scored items" (build plan Phase 5) counts units, not physical rows: a
  // g5-stakes pair is two rows scoring as one unit everywhere else in this
  // engine (spec §7's pool-floor rule), so a form is 5 single-item modules
  // (g1-g4, g6) plus exactly one g5 pair — 7 rows, 6 scored units.
  for (const formId of PROBE_FORM_IDS) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);
    const moduleSet = new Set(form.map((i) => i.moduleKey));
    if (moduleSet.size !== DELEGATION_MODULE_KEYS.length) {
      err("form-composition", `Probe form ${formId} does not cover all six modules.`);
    }
    const g5Pairs = new Set(form.filter((i) => i.moduleKey === "g5-stakes").map((i) => i.stakesPairId));
    if (g5Pairs.size !== 1) {
      err("form-composition", `Probe form ${formId} must contain exactly one g5-stakes pair; found ${g5Pairs.size}.`);
    }
    const unitCount = form.filter((i) => i.moduleKey !== "g5-stakes").length + (g5Pairs.size > 0 ? 1 : 0);
    if (unitCount !== PROBE_ITEMS_PER_FORM) {
      err("form-composition", `Probe form ${formId} has ${unitCount} scored unit(s); exactly ${PROBE_ITEMS_PER_FORM} are required.`);
    }
    const cueScoped = form.filter((i) => CUE_SCOPED_MODULES.includes(i.moduleKey));
    checkCueBalance(cueScoped, `probe form ${formId}`, err);
  }

  // ── Matched forms: same module (+ stakes role) → kind/difficulty mapping ─
  const formA = ITEM_SPECS.filter((i) => i.formId === "A");
  for (const formId of ["B", "C"] as const) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);
    for (const a of formA) {
      const match = form.find((i) => i.moduleKey === a.moduleKey && (i.kind !== "stakes" || i.stakesRole === a.stakesRole));
      if (!match) continue;
      if (match.kind !== a.kind || match.difficulty !== a.difficulty) {
        err(
          "form-mismatch",
          `Probe form ${formId}'s "${match.moduleKey}" slot (kind ${match.kind}, difficulty ${match.difficulty}) doesn't match form A's (kind ${a.kind}, difficulty ${a.difficulty}).`
        );
      }
    }
  }

  // ── Locale parity ────────────────────────────────────────────────────────
  const packs = new Map<Locale, ReturnType<typeof buildDelegationPack>>();
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
        if (!item.surface.ask.trim()) err("empty-surface", `Item "${item.itemId}" has an empty ${locale} ask.`);
        if (item.kind === "cue") {
          for (const c of item.cueOptions ?? []) {
            if (!item.surface.cueLabels?.[c.cueId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} label for cue "${c.cueId}".`);
          }
        }
        if (item.kind === "split") {
          for (const p of item.splitPieces ?? []) {
            if (!item.surface.pieceLabels?.[p.pieceId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} label for piece "${p.pieceId}".`);
          }
        }
      }

      const allStrings = pack.items.flatMap((i) => [
        i.surface.ask,
        ...Object.values(i.surface.cueLabels ?? {}),
        ...Object.values(i.surface.pieceLabels ?? {}),
        ...(i.surface.roundContext ?? []),
      ]);
      for (const s of allStrings) {
        if (PERSIAN_DIGITS.test(s)) {
          err("no-persian-digits", `Locale "${locale}" has a Persian-digit character in surface text — Western digits only (05-delegation-lab.md §4, §10).`);
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
      warn("key-unverified", `Item "${spec.itemId}" has no keyVerifiedAt — usable in practice, blocked from probes until a human re-derives its truth value and confirms the key.`);
    }
  }

  return issues;
}

function checkShape(spec: DelegationItemSpec, err: (code: string, message: string) => void) {
  const needsQuantity = spec.kind === "estimate" || spec.kind === "cue" || spec.kind === "stakes";

  if (needsQuantity) {
    if (spec.truth === null || spec.advice === null || spec.plausibleRange === null || spec.unit === null) {
      err("quantity-missing", `Item "${spec.itemId}" (kind ${spec.kind}) is missing truth/advice/plausibleRange/unit.`);
      return;
    }
    if (spec.advice === spec.truth) {
      err("advice-equals-truth-impossible", `Item "${spec.itemId}": advice equals truth — WOA is undefined for every learner who guesses correctly. Authored ties are never allowed.`);
    }
    const [lo, hi] = spec.plausibleRange;
    if (spec.advice < lo || spec.advice > hi) {
      err("advice-implausible", `Item "${spec.itemId}": advice ${spec.advice} falls outside plausibleRange [${lo}, ${hi}].`);
    }
    if (spec.truth < lo || spec.truth > hi) {
      err("advice-implausible", `Item "${spec.itemId}": truth ${spec.truth} falls outside plausibleRange [${lo}, ${hi}].`);
    }
  } else {
    if (spec.truth !== null || spec.advice !== null || spec.plausibleRange !== null) {
      err("quantity-unexpected", `Item "${spec.itemId}" (kind ${spec.kind}) authors a truth/advice/plausibleRange it cannot use.`);
    }
  }

  if (spec.kind === "cue") {
    const opts = spec.cueOptions ?? [];
    if (!opts.some((o) => o.kind === "category")) err("cue-options-shape", `Item "${spec.itemId}" has no category-claim cue distractor.`);
    if (!opts.some((o) => o.kind === "instance")) err("cue-options-shape", `Item "${spec.itemId}" has no instance-level cue option.`);
    const noneOpts = opts.filter((o) => o.kind === "none");
    if (noneOpts.length !== 1) err("cue-options-shape", `Item "${spec.itemId}" must have exactly one "none" cue option; found ${noneOpts.length}.`);
  }

  if (spec.kind === "split") {
    const pieces = spec.splitPieces ?? [];
    if (pieces.length < 2) err("split-shape", `Item "${spec.itemId}" needs at least 2 split pieces.`);
    if (!pieces.some((p) => p.keyDisposition === "give")) err("split-shape", `Item "${spec.itemId}" has no piece marked "give".`);
    if (!pieces.some((p) => p.keyDisposition === "keep")) err("split-shape", `Item "${spec.itemId}" has no piece marked "keep".`);
  }

  if (spec.kind === "stakes") {
    if (!spec.stakesPairId) err("stakes-orphan", `Item "${spec.itemId}" (kind stakes) has no stakesPairId.`);
    if (spec.stakesRole !== "low" && spec.stakesRole !== "high") err("stakes-orphan", `Item "${spec.itemId}" must set stakesRole to "low" or "high".`);
  }

  if (spec.kind === "sequence") {
    const rounds = spec.sequenceRounds ?? [];
    if (rounds.length !== G6_ROUNDS) {
      err("sequence-shape", `Item "${spec.itemId}" has ${rounds.length} round(s); exactly ${G6_ROUNDS} are required.`);
    }
    const seeded = rounds.filter((r) => r.isSeededError);
    if (seeded.length !== 1) {
      err("sequence-shape", `Item "${spec.itemId}" must have exactly one seeded-error round; found ${seeded.length}.`);
    } else if (rounds[1] !== seeded[0]) {
      err("sequence-shape", `Item "${spec.itemId}"'s seeded error must be round 2 (index 1).`);
    }
    for (const r of rounds) {
      if (r.advice === r.truth) err("advice-equals-truth-impossible", `Item "${spec.itemId}": a sequence round has advice equal to truth.`);
    }
  }
}

function checkCueBalance(items: DelegationItemSpec[], where: string, err: (code: string, message: string) => void) {
  const values = new Set(items.map((i) => i.cueDirection));
  if (!values.has("trust") || !values.has("keep") || !values.has("none")) {
    err("cue-balance", `${where} does not have all three cueDirection values present (has: ${[...values].join(", ") || "none"}).`);
  }
}

function checkAdviceBalance(items: DelegationItemSpec[], where: string, err: (code: string, message: string) => void) {
  const scored = items.map((i) => isAdviceGood(i)).filter((v): v is boolean => v !== null);
  const good = scored.filter(Boolean).length;
  const bad = scored.length - good;
  if (Math.abs(good - bad) > BALANCE_TOLERANCE_ITEMS) {
    err("advice-balance", `${where} has ${good} good-advice item(s) and ${bad} bad-advice item(s) — must balance to within ${BALANCE_TOLERANCE_ITEMS} of each other (spec §4: the failure here is symmetric, unlike the other tools' ⅓-control packs).`);
  }
}

function safeBuild(locale: Locale, err: (code: string, message: string) => void) {
  try {
    return buildDelegationPack(locale);
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
