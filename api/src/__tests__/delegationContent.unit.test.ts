import { describe, expect, it } from "vitest";
import { isProbeReady, isServable, validateDelegationContent } from "../content/skills/delegation/validate";
import { buildDelegationPack } from "../content/skills/delegation/v1";

describe("delegation content pack", () => {
  it("has no validator errors", () => {
    const issues = validateDelegationContent();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length) {
      throw new Error(errors.map((e) => `[${e.code}] ${e.message}`).join("\n"));
    }
    expect(errors).toHaveLength(0);
  });

  it("is servable for practice", () => {
    expect(isServable(validateDelegationContent())).toBe(true);
  });

  it("is not probe-ready yet — every key is unverified", () => {
    expect(isProbeReady(validateDelegationContent())).toBe(false);
  });

  it("builds en and fa packs with parity", () => {
    const en = buildDelegationPack("en");
    const fa = buildDelegationPack("fa");
    expect(en.items.length).toBe(fa.items.length);
    expect(en.items.length).toBe(63);
    expect(fa.reviewStatus).toBe("draft");
    expect(en.reviewStatus).toBe("reviewed");
  });
});
