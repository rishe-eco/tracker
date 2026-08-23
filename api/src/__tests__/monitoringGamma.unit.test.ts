import { describe, expect, it } from "vitest";
import { computeGamma } from "../services/skills/monitoring/gamma";

describe("computeGamma — the null cases (build plan §4.1)", () => {
  it("computes a positive gamma when predictions track outcomes", () => {
    const gamma = computeGamma([
      { prediction: 3, outcome: 1 },
      { prediction: 2, outcome: 1 },
      { prediction: 1, outcome: 0 },
      { prediction: 0, outcome: 0 },
    ]);
    expect(gamma).not.toBeNull();
    expect(gamma).toBeGreaterThan(0);
  });

  it("computes a negative gamma when predictions are inversely related to outcomes", () => {
    const gamma = computeGamma([
      { prediction: 3, outcome: 0 },
      { prediction: 2, outcome: 0 },
      { prediction: 1, outcome: 1 },
      { prediction: 0, outcome: 1 },
    ]);
    expect(gamma).not.toBeNull();
    expect(gamma).toBeLessThan(0);
  });

  it("is null with fewer than GAMMA_MIN_ITEMS items", () => {
    expect(
      computeGamma([
        { prediction: 3, outcome: 1 },
        { prediction: 0, outcome: 0 },
      ])
    ).toBeNull();
  });

  it("is null, not zero, when all predictions are identical", () => {
    const gamma = computeGamma([
      { prediction: 2, outcome: 1 },
      { prediction: 2, outcome: 0 },
      { prediction: 2, outcome: 1 },
      { prediction: 2, outcome: 0 },
    ]);
    expect(gamma).toBeNull();
  });

  it("is null, not zero, when all outcomes are identical (a learner who got everything right)", () => {
    const gamma = computeGamma([
      { prediction: 3, outcome: 1 },
      { prediction: 2, outcome: 1 },
      { prediction: 1, outcome: 1 },
      { prediction: 0, outcome: 1 },
    ]);
    expect(gamma).toBeNull();
  });

  it("is null when every outcome is wrong too (0/6-style extreme)", () => {
    const gamma = computeGamma([
      { prediction: 3, outcome: 0 },
      { prediction: 2, outcome: 0 },
      { prediction: 1, outcome: 0 },
      { prediction: 0, outcome: 0 },
    ]);
    expect(gamma).toBeNull();
  });

  it("ignores tied pairs but still resolves from the discriminable ones", () => {
    const gamma = computeGamma([
      { prediction: 3, outcome: 1 },
      { prediction: 3, outcome: 0 },
      { prediction: 0, outcome: 0 },
      { prediction: 0, outcome: 1 },
      { prediction: 2, outcome: 1 },
    ]);
    expect(gamma).not.toBeNull();
  });
});
