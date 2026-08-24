import { describe, expect, it } from "vitest";
import { benchmarkFor, computeWoa, relianceDirection, scoreProportionateWeight } from "../services/skills/delegation/woa";

describe("computeWoa — the four edge cases (build plan §4.1)", () => {
  it("computes a normal weight of advice", () => {
    const { raw, clamped } = computeWoa(900, 1240, 950);
    expect(raw).toBeCloseTo((950 - 900) / (1240 - 900), 5);
    expect(clamped).toBeCloseTo(raw as number, 5);
  });

  it("is undefined when advice equals the initial estimate", () => {
    const { raw, clamped } = computeWoa(900, 900, 950);
    expect(raw).toBeNull();
    expect(clamped).toBeNull();
  });

  it("clamps to 1.0 on overshoot past the advice, retaining the raw value", () => {
    const { raw, clamped } = computeWoa(900, 1000, 1300);
    expect(raw).toBeGreaterThan(1);
    expect(clamped).toBe(1);
  });

  it("clamps to 0.0 when the final estimate moves away from advice, retaining the raw negative value", () => {
    const { raw, clamped } = computeWoa(900, 1000, 800);
    expect(raw).toBeLessThan(0);
    expect(clamped).toBe(0);
  });
});

describe("benchmarkFor", () => {
  it("returns the cue-direction benchmarks", () => {
    expect(benchmarkFor("trust")).toBe(0.75);
    expect(benchmarkFor("keep")).toBe(0.25);
    expect(benchmarkFor("none")).toBe(0.5);
  });
});

describe("scoreProportionateWeight", () => {
  it("scores 2 within 0.2 of the benchmark", () => {
    expect(scoreProportionateWeight(0.55, 0.5)).toBe(2);
  });
  it("scores 1 within 0.4", () => {
    expect(scoreProportionateWeight(0.85, 0.5)).toBe(1);
  });
  it("scores 0 beyond 0.4", () => {
    expect(scoreProportionateWeight(0.95, 0.5)).toBe(0);
  });
  it("is null when WOA is undefined", () => {
    expect(scoreProportionateWeight(null, 0.5)).toBeNull();
  });
});

describe("relianceDirection", () => {
  it("flags over-reliance: moved substantially toward advice that was worse", () => {
    // initial 1955, advice 1958, truth 1952 — advice is worse than initial.
    const { clamped } = computeWoa(1955, 1958, 1957);
    expect(relianceDirection(clamped, 1955, 1958, 1952, 1957)).toBe("over");
  });

  it("flags under-reliance: barely moved toward advice that was much better", () => {
    // initial 900, advice 1240, truth 1270 — advice is much better than initial.
    const { clamped } = computeWoa(900, 1240, 950);
    expect(relianceDirection(clamped, 900, 1240, 1270, 950)).toBe("under");
  });

  it("is ok otherwise", () => {
    const { clamped } = computeWoa(900, 1000, 950);
    expect(relianceDirection(clamped, 900, 1000, 950, 950)).toBe("ok");
  });

  it("flags a costly move that sits under the over-reliance threshold", () => {
    // own 1100, advice 1150, final 1120, truth 1105 — WOA 0.40, net gain -10.
    // Under the 0.5 bar, so not "over", but it still lost accuracy: the
    // reveal must not call this a well-matched movement.
    const { clamped } = computeWoa(1100, 1150, 1120);
    expect(clamped).toBeCloseTo(0.4, 5);
    expect(relianceDirection(clamped, 1100, 1150, 1105, 1120)).toBe("costly");
  });

  it("stays ok when the move toward worse advice still landed no further out", () => {
    // final lands exactly as far from the truth as the initial estimate did.
    const { clamped } = computeWoa(100, 120, 110);
    expect(relianceDirection(clamped, 100, 120, 105, 110)).toBe("ok");
  });
});
