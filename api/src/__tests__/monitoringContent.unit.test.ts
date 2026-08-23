import { describe, expect, it } from "vitest";
import { isProbeReady, isServable, validateMonitoringContent } from "../content/skills/monitoring/validate";
import { buildMonitoringPack } from "../content/skills/monitoring/v1";

describe("monitoring content pack", () => {
  it("has no validator errors", () => {
    const issues = validateMonitoringContent();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length) {
      throw new Error(errors.map((e) => `[${e.code}] ${e.message}`).join("\n"));
    }
    expect(errors).toHaveLength(0);
  });

  it("is servable for practice", () => {
    expect(isServable(validateMonitoringContent())).toBe(true);
  });

  it("is not probe-ready yet — every key is unverified", () => {
    expect(isProbeReady(validateMonitoringContent())).toBe(false);
  });

  it("builds en and fa packs with parity", () => {
    const en = buildMonitoringPack("en");
    const fa = buildMonitoringPack("fa");
    expect(en.items.length).toBe(fa.items.length);
    expect(en.items.length).toBe(69);
    expect(fa.reviewStatus).toBe("draft");
    expect(en.reviewStatus).toBe("reviewed");
  });

  it("keeps s2-explain and s6-complacency out of probe forms", () => {
    const en = buildMonitoringPack("en");
    const probeItems = en.items.filter((i) => i.formId !== "pool");
    expect(probeItems.every((i) => i.kind !== "explain" && i.kind !== "longset")).toBe(true);
  });

  it("every s4-agreement transcript is marked reauthored in fa, not translated", () => {
    const fa = buildMonitoringPack("fa");
    const s4 = fa.items.filter((i) => i.moduleKey === "s4-agreement" && i.kind === "transcript" && !i.isCleanControl);
    expect(s4.length).toBeGreaterThan(0);
    expect(s4.every((i) => i.surface.reauthored === true)).toBe(true);
  });
});
