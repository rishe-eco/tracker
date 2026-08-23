/**
 * Monitoring content-pack validator.
 *
 * Runs in CI and in a unit test, never at request time. Mirrors
 * `delegation/validate.ts`'s shape. Spec: `06-monitoring-lab.md` §4, §5, §7,
 * §10; build plan §3 Phase 2 (the exact rule table) and §4.1-4.6.
 *
 * Two rules beyond the build plan's own table, both documented here because
 * the build plan's illustrative type didn't force the choice:
 *   - `pair-unassisted-answerable`: the unassisted half of a pair must carry
 *     `answerVariants` (it's a full recall item); the assisted half must not
 *     (nothing is scored for correctness on the half that was just told the
 *     answer — build plan §2 trap 2's logic applied to s1 rather than s2).
 *   - `probe-form-composition`: the build plan states forms "recall items
 *     for resolution, one matched pair, one transcript" without a number —
 *     resolved as 6 recall + 1 pair (2 rows) + 1 transcript per form, so
 *     gamma has a stable >=6-item base at every timepoint (build plan §4.1:
 *     fewer than 4 is null).
 */

import {
  LONGSET_SIZE,
  MIN_ANSWER_VARIANTS,
  MONITORING_MODULE_KEYS,
  S2_STEPS,
  type MonitoringItemSpec,
  type Locale,
} from "./types";
import { buildMonitoringPack, ITEM_SPECS } from "./v1";

export type ValidationIssue = { severity: "error" | "warning"; code: string; message: string };

const LOCALES: Locale[] = ["en", "fa"];
const PERSIAN_DIGITS = /[۰-۹٠-٩]/;

export const MIN_POOL_ITEMS_PER_MODULE = 6;
export const MIN_CLEAN_CONTROLS_PER_POOL = 2;
export const MIN_TRANSCRIPT_CONTROL_RATIO = 1 / 3;
export const PROBE_FORM_IDS = ["A", "B", "C"] as const;
export const RECALL_PER_FORM = 6;

export function validateMonitoringContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  const seen = new Set<string>();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.itemId)) err("duplicate-item-id", `Item id "${spec.itemId}" is used more than once.`);
    seen.add(spec.itemId);

    if (!MONITORING_MODULE_KEYS.includes(spec.moduleKey)) {
      err("unknown-module", `Item "${spec.itemId}" references unknown module "${spec.moduleKey}".`);
    }

    checkShape(spec, err);
  }

  // ── Practice coverage, per module ───────────────────────────────────────
  for (const moduleKey of MONITORING_MODULE_KEYS) {
    const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
    const unitCount = moduleKey === "s1-access" ? pool.length / 2 : pool.length;
    if (unitCount < MIN_POOL_ITEMS_PER_MODULE) {
      err(
        "pool-too-small",
        `Module "${moduleKey}" has ${unitCount} pool unit(s) (${moduleKey === "s1-access" ? "pairs" : "items"}); at least ${MIN_POOL_ITEMS_PER_MODULE} are needed.`
      );
    }
    if (moduleKey === "s4-agreement" || moduleKey === "s5-anchor") {
      const clean = pool.filter((i) => i.isCleanControl).length;
      if (clean < MIN_CLEAN_CONTROLS_PER_POOL) {
        err("transcript-control-ratio", `Module "${moduleKey}"'s pool has ${clean} clean control(s); at least ${MIN_CLEAN_CONTROLS_PER_POOL} are needed.`);
      }
      if (pool.length > 0 && clean / pool.length < MIN_TRANSCRIPT_CONTROL_RATIO) {
        err("transcript-control-ratio", `Module "${moduleKey}"'s pool has a clean-control ratio of ${(clean / pool.length).toFixed(2)}; at least ${MIN_TRANSCRIPT_CONTROL_RATIO.toFixed(2)} is required.`);
      }
    }
  }

  // ── Pair matching ───────────────────────────────────────────────────────
  const pairGroups = new Map<string, MonitoringItemSpec[]>();
  for (const spec of ITEM_SPECS) {
    if (spec.kind !== "pair" || !spec.pairId) continue;
    const group = pairGroups.get(spec.pairId) ?? [];
    group.push(spec);
    pairGroups.set(spec.pairId, group);
  }
  for (const [pairId, group] of pairGroups) {
    if (group.length !== 2) {
      err("pair-orphan", `Pair "${pairId}" has ${group.length} item(s); exactly 2 are required.`);
      continue;
    }
    const halves = new Set(group.map((i) => i.pairHalf));
    if (!halves.has("assisted") || !halves.has("unassisted")) {
      err("pair-orphan", `Pair "${pairId}" must have one "assisted" and one "unassisted" half.`);
    }
    if (group[0].difficulty !== group[1].difficulty) {
      err("pair-orphan", `Pair "${pairId}"'s two halves must share a difficulty; found ${group[0].difficulty} and ${group[1].difficulty}.`);
    }
  }

  // ── Probe forms ──────────────────────────────────────────────────────────
  for (const formId of PROBE_FORM_IDS) {
    const form = ITEM_SPECS.filter((i) => i.formId === formId);

    const recallCount = form.filter((i) => i.kind === "recall").length;
    if (recallCount !== RECALL_PER_FORM) {
      err("probe-form-composition", `Probe form ${formId} has ${recallCount} recall item(s); exactly ${RECALL_PER_FORM} are required.`);
    }

    const pairIds = new Set(form.filter((i) => i.kind === "pair").map((i) => i.pairId));
    if (pairIds.size !== 1) {
      err("probe-form-composition", `Probe form ${formId} must contain exactly one matched pair; found ${pairIds.size}.`);
    }

    const transcripts = form.filter((i) => i.kind === "transcript");
    if (transcripts.length !== 1) {
      err("probe-form-composition", `Probe form ${formId} must contain exactly one transcript item; found ${transcripts.length}.`);
    }

    if (form.some((i) => i.kind === "explain" || i.kind === "longset")) {
      err("probe-form-composition", `Probe form ${formId} must not contain "explain" or "longset" items — those modules are pool-only (spec §5 item types 3, 5).`);
    }
  }

  const probeTranscripts = ITEM_SPECS.filter((i) => i.formId !== "pool" && i.kind === "transcript");
  const probeClean = probeTranscripts.filter((i) => i.isCleanControl).length;
  if (probeTranscripts.length > 0 && probeClean / probeTranscripts.length < MIN_TRANSCRIPT_CONTROL_RATIO) {
    err("transcript-control-ratio", `Probe transcripts have a clean-control ratio of ${(probeClean / probeTranscripts.length).toFixed(2)} across the form set; at least ${MIN_TRANSCRIPT_CONTROL_RATIO.toFixed(2)} is required (build plan §5).`);
  }
  const probeTranscriptModules = new Set(probeTranscripts.map((i) => i.moduleKey));
  if (!probeTranscriptModules.has("s4-agreement") || !probeTranscriptModules.has("s5-anchor")) {
    err("probe-form-composition", `The probe transcripts across forms A/B/C must cover both s4-agreement and s5-anchor; found: ${[...probeTranscriptModules].join(", ") || "none"}.`);
  }

  // ── Locale parity ────────────────────────────────────────────────────────
  const packs = new Map<Locale, ReturnType<typeof buildMonitoringPack>>();
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
        if ((item.kind === "recall" || item.kind === "pair") && !item.surface.question?.trim()) {
          err("empty-surface", `Item "${item.itemId}" has an empty ${locale} question.`);
        }
        if (item.kind === "recall" || (item.kind === "pair" && item.pairHalf === "unassisted")) {
          const variants = item.surface.answerVariants ?? [];
          const normalized = new Set(variants.map(normalize));
          if (normalized.size < MIN_ANSWER_VARIANTS) {
            err("answer-variants-thin", `Item "${item.itemId}" (${locale}) has ${normalized.size} distinct answer variant(s); at least ${MIN_ANSWER_VARIANTS} are required.`);
          }
        }
        if (item.kind === "pair" && item.pairHalf === "assisted" && item.surface.answerVariants?.length) {
          err("pair-unassisted-answerable", `Item "${item.itemId}" (assisted half, ${locale}) authors answerVariants it cannot use — nothing is scored for correctness on the half that was shown the explanation.`);
        }
        if (item.kind === "pair") {
          if (item.pairHalf === "assisted" && !item.surface.authoredExplanation?.trim()) {
            err("pair-explanation", `Item "${item.itemId}" (assisted half, ${locale}) has no authoredExplanation.`);
          }
          if (item.pairHalf === "unassisted" && item.surface.authoredExplanation) {
            err("pair-explanation", `Item "${item.itemId}" (unassisted half, ${locale}) authors an explanation it must not show.`);
          }
        }
        if (item.kind === "transcript") {
          for (const t of item.turns ?? []) {
            if (!item.surface.turnText?.[t.turnId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} text for turn "${t.turnId}".`);
          }
          if (locale === "fa" && item.moduleKey === "s4-agreement" && !item.isCleanControl && !item.surface.reauthored) {
            warn("fa-s4-reauthored", `Item "${item.itemId}" (s4-agreement, fa) is not marked reauthored — تعارف makes agreement the default register, so a translated beat may carry no influence (spec §4, §10).`);
          }
        }
        if (item.kind === "longset") {
          for (const c of item.checkpoints ?? []) {
            if (!item.surface.checkpointText?.[c.checkpointId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} text for checkpoint "${c.checkpointId}".`);
          }
          for (const cm of item.countermeasures ?? []) {
            if (!item.surface.countermeasureLabels?.[cm.optionId]?.trim()) err("empty-surface", `Item "${item.itemId}" has no ${locale} label for countermeasure "${cm.optionId}".`);
          }
        }
      }

      // answer-variant-collision: within one form, two items' variant sets must
      // not normalize to the same string, or the matcher can't tell them apart
      // for review-queue purposes.
      for (const formId of new Set(pack.items.map((i) => i.formId))) {
        const seenVariants = new Map<string, string>();
        for (const item of pack.items.filter((i) => i.formId === formId && i.surface.answerVariants?.length)) {
          for (const v of item.surface.answerVariants ?? []) {
            const n = normalize(v);
            const owner = seenVariants.get(n);
            if (owner && owner !== item.itemId) {
              err("answer-variant-collision", `Locale "${locale}", form "${formId}": variant "${v}" normalizes the same for items "${owner}" and "${item.itemId}".`);
            }
            seenVariants.set(n, item.itemId);
          }
        }
      }

      const allStrings = pack.items.flatMap((i) => [
        i.surface.question ?? "",
        i.surface.explainPrompt ?? "",
        i.surface.authoredExplanation ?? "",
        ...(i.surface.answerVariants ?? []),
        ...Object.values(i.surface.stepLabels ?? {}),
        ...Object.values(i.surface.turnText ?? {}),
        ...Object.values(i.surface.checkpointText ?? {}),
        ...Object.values(i.surface.countermeasureLabels ?? {}),
      ]);
      for (const s of allStrings) {
        if (PERSIAN_DIGITS.test(s)) {
          err("no-persian-digits", `Locale "${locale}" has a Persian-digit character in surface text — Western digits only (06-monitoring-lab.md §4, §10).`);
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
      warn("key-unverified", `Item "${spec.itemId}" has no keyVerifiedAt — usable in practice, blocked from probes until a human re-derives its key and confirms it.`);
    }
  }

  return issues;
}

function checkShape(spec: MonitoringItemSpec, err: (code: string, message: string) => void) {
  if (spec.kind === "explain") {
    const steps = spec.causalSteps ?? [];
    if (steps.length !== S2_STEPS) err("steps-count", `Item "${spec.itemId}" has ${steps.length} causal step(s); exactly ${S2_STEPS} are required.`);
    if (!steps.some((s) => s.loadBearing)) err("steps-count", `Item "${spec.itemId}" has no load-bearing causal step.`);
  }

  if (spec.kind === "transcript") {
    const planted = spec.planted ?? [];
    if (spec.isCleanControl) {
      if (planted.length > 0) err("transcript-clean-has-plant", `Item "${spec.itemId}" is a clean control but authors ${planted.length} planted influence(s).`);
    } else {
      if (!planted.some((p) => p.weight === 2)) err("transcript-weight-mix", `Item "${spec.itemId}" has no weight-2 (decision-moving) influence.`);
      if (!planted.some((p) => p.weight === 1)) err("transcript-weight-mix", `Item "${spec.itemId}" has no weight-1 influence.`);
    }
    const turnIds = new Set((spec.turns ?? []).map((t) => t.turnId));
    for (const p of planted) {
      if (!turnIds.has(p.turnId)) err("transcript-weight-mix", `Item "${spec.itemId}" plants an influence on unknown turn "${p.turnId}".`);
    }
  }

  if (spec.kind === "longset") {
    const checkpoints = spec.checkpoints ?? [];
    if (checkpoints.length !== LONGSET_SIZE) err("longset-shape", `Item "${spec.itemId}" has ${checkpoints.length} checkpoint(s); exactly ${LONGSET_SIZE} are required.`);
    const opts = spec.countermeasures ?? [];
    const independent = opts.filter((o) => !o.attentionDependent).length;
    const dependent = opts.filter((o) => o.attentionDependent).length;
    if (independent < 1) err("countermeasure-mix", `Item "${spec.itemId}" has no attention-independent countermeasure option.`);
    if (dependent < 3) err("countermeasure-mix", `Item "${spec.itemId}" has ${dependent} attention-dependent countermeasure option(s); at least 3 are required.`);
  }
}

function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeBuild(locale: Locale, err: (code: string, message: string) => void) {
  try {
    return buildMonitoringPack(locale);
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
