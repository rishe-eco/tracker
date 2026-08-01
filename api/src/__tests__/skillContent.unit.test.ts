import { describe, expect, it } from "vitest";
import { buildEvidencePack, ITEM_SPECS } from "../content/skills/evidence/v1";
import { isControl, toPublicItem } from "../content/skills/types";
import { isServable, validateEvidenceContent } from "../content/skills/validate";

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
