import { describe, expect, it } from "vitest";
import { buildClarityPack, ITEM_SPECS } from "../content/skills/clarity/v1";
import { CLARITY_MODULE_KEYS, toPublicClarityItem } from "../content/skills/clarity/types";
import {
  isOfflineCapable,
  isServable,
  MIN_POOL_ITEMS_PER_MODULE,
  validateClarityContent,
} from "../content/skills/clarity/validate";

describe("clarity content pack", () => {
  const issues = validateClarityContent();
  const errors = issues.filter((i) => i.severity === "error");

  it("has no blocking validation errors", () => {
    expect(errors, `Content errors:\n${errors.map((e) => `  [${e.code}] ${e.message}`).join("\n")}`).toEqual([]);
    expect(isServable(issues)).toBe(true);
  });

  it("gives every module three practice items that run with no model", () => {
    // The offline count is the one that matters. A pool of elicitation items
    // looks fully stocked on the modules page and is empty the moment there is
    // no credential configured — which, for phases 1 to 3, is always.
    for (const moduleKey of CLARITY_MODULE_KEYS) {
      const pool = ITEM_SPECS.filter((i) => i.formId === "pool" && i.moduleKey === moduleKey);
      const offline = pool.filter((i) => isOfflineCapable(i.type));
      expect(offline.length, `module ${moduleKey}`).toBeGreaterThanOrEqual(MIN_POOL_ITEMS_PER_MODULE);
    }
  });

  it("proves every repair drill is both faulty and fixable", () => {
    // The validator does the detector work; this asserts it actually ran on
    // something. A satisfiability check that silently covers zero drills is
    // indistinguishable from one that passes.
    const en = buildClarityPack("en");
    const drills = en.items.filter((i) => i.type === "repair");
    expect(drills.length).toBeGreaterThanOrEqual(6);
    for (const drill of drills) {
      expect(drill.repairCheck, drill.itemId).toBeTruthy();
      expect(drill.surface.weakText?.trim(), drill.itemId).toBeTruthy();
      expect(drill.surface.exemplarFix?.trim(), drill.itemId).toBeTruthy();
    }
    expect(
      errors.filter((e) => e.code.startsWith("repair-")),
      "a drill disagrees with the rubric it teaches"
    ).toEqual([]);
  });

  it("keeps every item in both locales with identical specs", () => {
    const en = buildClarityPack("en");
    const fa = buildClarityPack("fa");
    expect(fa.items.map((i) => i.itemId).sort()).toEqual(en.items.map((i) => i.itemId).sort());

    for (const enItem of en.items) {
      const faItem = fa.items.find((i) => i.itemId === enItem.itemId)!;
      expect(faItem.type).toBe(enItem.type);
      expect(faItem.difficulty).toBe(enItem.difficulty);
      expect(faItem.seededFaults).toEqual(enItem.seededFaults);
      expect(faItem.requiredSlots).toEqual(enItem.requiredSlots);
    }
  });

  it("ships a revision item's misread, so the gap reveal needs no model", () => {
    // This is the property the whole offline-first plan rests on: a revision
    // item is a playback, not a generation.
    const en = buildClarityPack("en");
    const revisions = en.items.filter((i) => i.type === "revision");
    expect(revisions.length).toBeGreaterThan(0);
    for (const item of revisions) {
      expect(item.surface.authoredMisread?.trim(), item.itemId).toBeTruthy();
    }
  });

  it("never leaks a key, a seeded fault, an exemplar fix or a reveal to the client", () => {
    const pack = buildClarityPack("en");
    for (const item of pack.items) {
      const pub = toPublicClarityItem(item);
      const serialised = JSON.stringify(pub);

      expect(Object.keys(pub)).not.toContain("seededFaults");
      expect(Object.keys(pub)).not.toContain("requiredSlots");
      expect(Object.keys(pub)).not.toContain("keyNote");
      expect(Object.keys(pub)).not.toContain("repairCheck");
      expect(serialised, item.itemId).not.toContain(item.keyNote);
      expect(serialised, item.itemId).not.toContain(item.surface.reveal);
      if (item.surface.exemplarFix) {
        // Handing the learner the answer to a repair drill would be the most
        // direct possible way to make the drill measure nothing.
        expect(serialised, item.itemId).not.toContain(item.surface.exemplarFix);
      }
    }
  });

  it("blocks unverified probe items while leaving practice usable", () => {
    const blockers = issues.filter((i) => i.code === "key-unverified");
    expect(blockers.length).toBeGreaterThan(0);
    expect(isServable(issues)).toBe(true);
  });
});
