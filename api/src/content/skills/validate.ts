/**
 * Content-pack validator.
 *
 * This runs in CI and in a unit test, not at request time. Its job is to make
 * the failure modes that would otherwise be *silent* loud instead — every rule
 * below corresponds to something that, left unchecked, produces a tool that
 * looks like it works and quietly measures nothing.
 *
 * Spec: 00-skills-engine.md §5.1, §6; 02-evidence-lab.md §4, §5, §11.
 */

import { EVIDENCE_MODULE_KEYS, isControl, type EvidencePack, type Locale } from "./types";
import { buildEvidencePack, EXPECTED_VERDICT, ITEM_SPECS } from "./evidence/v1";

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

const LOCALES: Locale[] = ["en", "fa"];

/** Minimum share of control (true-claim) items in any scored form. */
export const MIN_CONTROL_RATIO = 1 / 3;

export function validateEvidenceContent(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  // ── Structural integrity ────────────────────────────────────────────────
  const seen = new Set<string>();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.itemId)) err("duplicate-item-id", `Item id "${spec.itemId}" is used more than once.`);
    seen.add(spec.itemId);

    if (!EVIDENCE_MODULE_KEYS.includes(spec.moduleKey)) {
      err("unknown-module", `Item "${spec.itemId}" references unknown module "${spec.moduleKey}".`);
    }

    // The key must follow from the profile. Catches the authoring slip where a
    // contested item is keyed "unsupported" and every learner who meets it is
    // mis-scored — invisible at runtime, obvious here.
    const expected = EXPECTED_VERDICT[spec.profile];
    if (spec.key !== expected) {
      err(
        "key-profile-mismatch",
        `Item "${spec.itemId}" has profile "${spec.profile}" (implies key "${expected}") but is keyed "${spec.key}".`
      );
    }

    // A control has nothing to locate; a faulty item must say what fails, or
    // trace-quality cannot be scored.
    if (isControl(spec.profile) && spec.faultTarget !== null) {
      err("control-has-fault", `Control item "${spec.itemId}" must have faultTarget: null.`);
    }
    if (!isControl(spec.profile) && !spec.faultTarget) {
      err("missing-fault-target", `Faulty item "${spec.itemId}" needs a faultTarget for trace-quality scoring.`);
    }
  }

  // ── Control ratio, per scored form ──────────────────────────────────────
  // A tool where the AI is never right teaches distrust and calls it vigilance.
  const forms = new Map<string, typeof ITEM_SPECS>();
  for (const spec of ITEM_SPECS) {
    if (spec.formId === "pool") continue;
    const list = forms.get(spec.formId) ?? [];
    list.push(spec);
    forms.set(spec.formId, list);
  }
  for (const [formId, items] of forms) {
    const controls = items.filter((i) => isControl(i.profile)).length;
    const ratio = controls / items.length;
    if (ratio < MIN_CONTROL_RATIO) {
      err(
        "control-ratio",
        `Form ${formId} is ${(ratio * 100).toFixed(0)}% control items (${controls}/${items.length}); ` +
          `minimum is ${(MIN_CONTROL_RATIO * 100).toFixed(0)}%. Without true claims the score measures suspicion, not discrimination.`
      );
    }
  }

  // ── Probe readiness ─────────────────────────────────────────────────────
  // Both gates below are *blocking for probes only*. Practice runs on live
  // search in a new tab and needs neither, so the tool is usable while the
  // verification pass is still outstanding.
  for (const spec of ITEM_SPECS) {
    if (spec.formId === "pool") continue;
    if (!spec.keyVerifiedAt) {
      warn(
        "key-unverified",
        `Item "${spec.itemId}" has no keyVerifiedAt — usable in practice, blocked from probes until a human re-checks the key.`
      );
    }
    if (spec.snapshot.status !== "verified") {
      warn(
        "snapshot-pending",
        `Item "${spec.itemId}" has no verified snapshot — assessment needs frozen results, so this item cannot serve a probe yet.`
      );
    }
    if (spec.snapshot.status === "verified" && !spec.keyVerifiedAt) {
      err(
        "snapshot-without-key",
        `Item "${spec.itemId}" has a verified snapshot but an unverified key. The key must be re-checked *against the frozen results* — a snapshot refresh that leaves the key stale is the one failure this design introduces, and it fails silently.`
      );
    }
  }

  // ── Locale parity ───────────────────────────────────────────────────────
  // Drift between locales is where the long-run cost lives. Catch it free.
  const packs = new Map<Locale, EvidencePack>();
  for (const locale of LOCALES) {
    try {
      packs.set(locale, buildEvidencePack(locale));
    } catch (e: any) {
      err("locale-build-failed", `Could not build "${locale}" pack: ${e.message}`);
    }
  }

  const en = packs.get("en");
  if (en) {
    for (const locale of LOCALES) {
      const pack = packs.get(locale);
      if (!pack || locale === "en") continue;

      const enIds = new Set(en.items.map((i) => i.itemId));
      const otherIds = new Set(pack.items.map((i) => i.itemId));
      for (const id of enIds) {
        if (!otherIds.has(id)) err("locale-parity", `Item "${id}" exists in en but not in ${locale}.`);
      }
      for (const id of otherIds) {
        if (!enIds.has(id)) err("locale-parity", `Item "${id}" exists in ${locale} but not in en.`);
      }

      for (const item of pack.items) {
        if (!item.surface.prompt.trim() || !item.surface.answer.trim()) {
          err("empty-surface", `Item "${item.itemId}" has empty ${locale} prompt or answer.`);
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

  return issues;
}

/** True when nothing blocks the pack from serving practice sessions. */
export function isServable(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}

/** True when the pack can serve a *scored probe* — the stricter bar. */
export function isProbeReady(issues: ValidationIssue[]): boolean {
  return !issues.some(
    (i) =>
      i.severity === "error" ||
      i.code === "key-unverified" ||
      i.code === "snapshot-pending"
  );
}
