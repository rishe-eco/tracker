import { describe, expect, it } from "vitest";
import { buildEvidencePack, ITEM_SPECS } from "../content/skills/evidence/v2";
import {
  EVIDENCE_MODULE_KEYS,
  isControl,
  PROFILE_FAULT_TAG,
  PROFILE_VERDICT,
  toPublicItem,
} from "../content/skills/types";
import { EXPECTED_VERDICT as V1_VERDICT, FAULT_TAG as V1_FAULT } from "../content/skills/evidence/v1/spec";
import { EXPECTED_VERDICT as V2_VERDICT, FAULT_TAG as V2_FAULT } from "../content/skills/evidence/v2/spec";
import { EVIDENCE_VERSIONS } from "../content/skills/versions";
import {
  isServable,
  MIN_POOL_ITEMS_PER_MODULE,
  validateEvidenceContent,
} from "../content/skills/validate";

describe("evidence content pack", () => {
  const issues = validateEvidenceContent();
  const errors = issues.filter((i) => i.severity === "error");

  it("has no blocking validation errors", () => {
    expect(errors, `Content errors:\n${errors.map((e) => `  [${e.code}] ${e.message}`).join("\n")}`).toEqual([]);
    expect(isServable(issues)).toBe(true);
  });

  it("keeps every item in both locales with identical specs", () => {
    const en = buildEvidencePack("en");
    const fa = buildEvidencePack("fa");
    expect(fa.items.map((i) => i.itemId).sort()).toEqual(en.items.map((i) => i.itemId).sort());

    // Structure is shared, not translated — that is what makes the two versions
    // comparable at all.
    for (const enItem of en.items) {
      const faItem = fa.items.find((i) => i.itemId === enItem.itemId)!;
      expect(faItem.profile).toBe(enItem.profile);
      expect(faItem.key).toBe(enItem.key);
      expect(faItem.difficulty).toBe(enItem.difficulty);
      expect(faItem.formId).toBe(enItem.formId);
    }
  });

  it("ships at least a third control items in every scored form", () => {
    const formA = ITEM_SPECS.filter((i) => i.formId === "A");
    const controls = formA.filter((i) => isControl(i.profile));
    expect(controls.length / formA.length).toBeGreaterThanOrEqual(1 / 3);
  });

  it("never leaks the answer key to the client", () => {
    // The single most important assertion in this file. A leaked key does not
    // break anything visibly — it just makes every score meaningless.
    const pack = buildEvidencePack("en");
    for (const item of pack.items) {
      const pub = toPublicItem(item, { includeSnapshot: true });
      const serialised = JSON.stringify(pub);
      expect(Object.keys(pub)).not.toContain("key");
      expect(Object.keys(pub)).not.toContain("faultTarget");
      expect(Object.keys(pub)).not.toContain("keyNote");
      expect(Object.keys(pub)).not.toContain("nonIndependentHosts");
      expect(serialised).not.toContain(item.keyNote);
      // The reveal text names the fault and must not ship before submission.
      expect(serialised).not.toContain(item.surface.reveal);
    }
  });

  it("gives every module enough practice items to be masterable", () => {
    // v1 shipped two pool items in total, so four of six modules opened to an
    // empty page and none of them could reach mastery. The rule exists so that
    // failure is a build error rather than something a learner discovers.
    for (const moduleKey of EVIDENCE_MODULE_KEYS) {
      const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
      expect(pool.length, `module ${moduleKey}`).toBeGreaterThanOrEqual(MIN_POOL_ITEMS_PER_MODULE);
      const controls = pool.filter((i) => isControl(i.profile)).length;
      expect(controls / pool.length, `module ${moduleKey} controls`).toBeGreaterThanOrEqual(1 / 3);
    }
  });

  it("keeps every version's profile tables agreeing with the canonical taxonomy", () => {
    // Scoring reads the canonical maps. If a version's local copy drifts, its
    // items are keyed against one table and scored against another — which
    // produces wrong scores and no error.
    expect(V1_VERDICT).toEqual(PROFILE_VERDICT);
    expect(V2_VERDICT).toEqual(PROFILE_VERDICT);
    expect(V1_FAULT).toEqual(PROFILE_FAULT_TAG);
    expect(V2_FAULT).toEqual(PROFILE_FAULT_TAG);
  });

  it("still builds every retired version, in both locales", () => {
    // A learner pinned to an old version must be able to finish, and any attempt
    // already recorded against it must still resolve its item.
    for (const [versionId, version] of Object.entries(EVIDENCE_VERSIONS)) {
      expect(() => version.build("en"), versionId).not.toThrow();
      expect(() => version.build("fa"), versionId).not.toThrow();
    }
  });

  it("blocks unverified items from probes while leaving practice usable", () => {
    // The seed pack ships with pending snapshots on purpose: the machinery is
    // complete, the content is not verified, and the gate says so out loud
    // rather than letting an unverified key serve a scored probe.
    const probeBlockers = issues.filter(
      (i) => i.code === "key-unverified" || i.code === "snapshot-pending"
    );
    expect(probeBlockers.length).toBeGreaterThan(0);
    expect(isServable(issues)).toBe(true);
  });
});
