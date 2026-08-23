import { describe, expect, it } from "vitest";
import { checkRateDecay, computeBias, inflationFor, influenceDiscrimination, scoreCountermeasure } from "../services/skills/monitoring/metrics";

describe("computeBias", () => {
  it("is positive (overconfident) when predicted probability exceeds accuracy", () => {
    const bias = computeBias([
      { prediction: "confident", outcome: 0 },
      { prediction: "confident", outcome: 1 },
    ]);
    expect(bias).toBeGreaterThan(0);
  });

  it("is null with no pairs", () => {
    expect(computeBias([])).toBeNull();
  });
});

describe("inflationFor — the pair is the unit (build plan §4.3)", () => {
  it("averages assisted-minus-unassisted across complete pairs", () => {
    const inflation = inflationFor([
      { assistedRating: 8, unassistedRating: 5 },
      { assistedRating: 6, unassistedRating: 6 },
    ]);
    expect(inflation).toBeCloseTo(1.5, 5);
  });

  it("is null with no complete pairs", () => {
    expect(inflationFor([])).toBeNull();
  });
});

describe("influenceDiscrimination (build plan §4.4)", () => {
  it("computes hitRate minus falseAlarmRate, with weightedHits reported separately", () => {
    const result = influenceDiscrimination({
      plantedTotal: 2,
      plantedFound: 1,
      weight2Total: 1,
      weight2Found: 1,
      cleanTurnsTotal: 4,
      falseAlarms: 1,
    });
    expect(result.hitRate).toBeCloseTo(0.5, 5);
    expect(result.falseAlarmRate).toBeCloseTo(0.25, 5);
    expect(result.discrimination).toBeCloseTo(0.25, 5);
    expect(result.weightedHits).toBe(1);
  });
});

describe("checkRateDecay — descriptive only, never scored (build plan §4.5)", () => {
  it("computes last-third over first-third", () => {
    const nine = [true, true, true, false, false, false, false, false, false];
    const { firstThird, lastThird, decay } = checkRateDecay(nine);
    expect(firstThird).toBe(1);
    expect(lastThird).toBe(0);
    expect(decay).toBe(0);
  });

  it("is null when the first third had a zero check-rate (nothing to divide by)", () => {
    const nine = [false, false, false, true, true, true, true, true, true];
    expect(checkRateDecay(nine).decay).toBeNull();
  });
});

describe("scoreCountermeasure (build plan §4.6)", () => {
  it("scores 2 for an attention-independent option regardless of trigger", () => {
    expect(scoreCountermeasure(false, false)).toBe(2);
    expect(scoreCountermeasure(false, true)).toBe(2);
  });

  it("scores 1 for an attention-dependent option that names a trigger", () => {
    expect(scoreCountermeasure(true, true)).toBe(1);
  });

  it("scores 0 for bare effort", () => {
    expect(scoreCountermeasure(true, false)).toBe(0);
  });
});
