import { describe, expect, it } from "vitest";
import { isProbeReady, isServable, validateVerificationContent } from "../content/skills/verification/validate";
import { buildVerificationPack } from "../content/skills/verification/v1";

describe("verification content pack", () => {
  it("has no validator errors", () => {
    const issues = validateVerificationContent();
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length) {
      throw new Error(errors.map((e) => `[${e.code}] ${e.message}`).join("\n"));
    }
    expect(errors).toHaveLength(0);
  });

  it("is servable for practice", () => {
    expect(isServable(validateVerificationContent())).toBe(true);
  });

  it("is not probe-ready yet — every key is unverified", () => {
    expect(isProbeReady(validateVerificationContent())).toBe(false);
  });

  it("builds en and fa packs with parity", () => {
    const en = buildVerificationPack("en");
    const fa = buildVerificationPack("fa");
    expect(en.items.length).toBe(fa.items.length);
    expect(en.items.length).toBe(54);
    expect(fa.reviewStatus).toBe("draft");
    expect(en.reviewStatus).toBe("reviewed");
  });
});
