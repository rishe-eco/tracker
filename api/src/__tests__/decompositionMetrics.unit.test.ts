import { describe, expect, it } from "vitest";
import {
  breadthFirstIndex,
  granularityDiscrimination,
  isOverDecomposedControl,
  scoreCoverage,
  scoreDependency,
  scoreOverlap,
} from "../services/skills/decomposition/metrics";

describe("breadthFirstIndex (D2)", () => {
  it("is null when fewer than two top-level pieces exist — nothing to be breadth-first about", () => {
    expect(breadthFirstIndex([{ nodeId: "a", depth: 1 }], new Set(["a"])).bfi).toBeNull();
    expect(breadthFirstIndex([], new Set()).bfi).toBeNull();
  });

  it("scores 1.0 / level 2 when every top-level piece precedes any depth-2 piece", () => {
    const events = [
      { nodeId: "a", depth: 1 as const },
      { nodeId: "b", depth: 1 as const },
      { nodeId: "c", depth: 1 as const },
      { nodeId: "a1", depth: 2 as const },
    ];
    const result = breadthFirstIndex(events, new Set(["a", "b", "c"]));
    expect(result.bfi).toBe(1);
    expect(result.level).toBe(2);
  });

  it("scores 0 when the first branch is fully developed before any other top-level piece exists", () => {
    const events = [
      { nodeId: "a", depth: 1 as const },
      { nodeId: "a1", depth: 2 as const },
      { nodeId: "a2", depth: 2 as const },
      { nodeId: "b", depth: 1 as const },
      { nodeId: "c", depth: 1 as const },
    ];
    const result = breadthFirstIndex(events, new Set(["a", "b", "c"]));
    expect(result.bfi).toBeCloseTo(1 / 3);
    expect(result.level).toBe(0);
  });

  it("scores partial (level 1) when some top-level enumeration happens, then a dive", () => {
    const events = [
      { nodeId: "a", depth: 1 as const },
      { nodeId: "b", depth: 1 as const },
      { nodeId: "b1", depth: 2 as const },
      { nodeId: "c", depth: 1 as const },
    ];
    const result = breadthFirstIndex(events, new Set(["a", "b", "c"]));
    expect(result.bfi).toBeCloseTo(2 / 3);
    expect(result.level).toBe(1);
  });

  it("ignores node_moved entirely — rearranging afterwards does not retroactively fix a depth-first authoring order", () => {
    // The fixture: authored depth-first (a, then a1 and a2 immediately, then
    // b and c) — this function only ever sees node_added events, so a
    // hypothetical later node_moved reparenting a1 cannot appear in its input
    // at all. Asserting the depth-first authoring order still scores level 0
    // is the regression this guards: someone "fixing" this function to
    // accept moves would need a different signature, and this test would
    // need to change with it.
    const authoredDepthFirst = [
      { nodeId: "a", depth: 1 as const },
      { nodeId: "a1", depth: 2 as const },
      { nodeId: "a2", depth: 2 as const },
      { nodeId: "b", depth: 1 as const },
      { nodeId: "c", depth: 1 as const },
    ];
    const result = breadthFirstIndex(authoredDepthFirst, new Set(["a", "b", "c"]));
    expect(result.level).toBe(0);
  });

  it("requires every piece at its intended depth for arrangement level 2", () => {
    const events = [
      { nodeId: "a", depth: 1 as const },
      { nodeId: "b", depth: 1 as const },
    ];
    const perfect = breadthFirstIndex(events, new Set(["a", "b"]), { arrangementDepthAllCorrect: true });
    expect(perfect.level).toBe(2);
    const misplaced = breadthFirstIndex(events, new Set(["a", "b"]), { arrangementDepthAllCorrect: false });
    expect(misplaced.level).toBe(1);
  });
});

describe("scoreCoverage (D6)", () => {
  const required = ["a", "b", "c"];

  it("is level 2 when every required piece is placed and at most one decoy", () => {
    expect(scoreCoverage(new Set(["a", "b", "c"]), required, ["decoy1"]).level).toBe(2);
    expect(scoreCoverage(new Set(["a", "b", "c", "decoy1"]), required, ["decoy1", "decoy2"]).level).toBe(2);
  });

  it("is level 1 with exactly one missing required piece", () => {
    expect(scoreCoverage(new Set(["a", "b"]), required, []).level).toBe(1);
  });

  it("is level 0 with two or more missing", () => {
    expect(scoreCoverage(new Set(["a"]), required, []).level).toBe(0);
  });

  it("drops a fully-covered structure to level 1 when two decoys are placed", () => {
    const result = scoreCoverage(new Set(["a", "b", "c", "decoy1", "decoy2"]), required, ["decoy1", "decoy2"]);
    expect(result.level).toBe(1);
  });
});

describe("scoreOverlap (D3)", () => {
  it("is level 2 when no overlap pair has both members placed", () => {
    expect(scoreOverlap(new Set(["a", "c"]), [["a", "b"]]).level).toBe(2);
  });

  it("is level 1 with exactly one violated pair, level 0 with two or more", () => {
    expect(scoreOverlap(new Set(["a", "b"]), [["a", "b"]]).level).toBe(1);
    expect(scoreOverlap(new Set(["a", "b", "c", "d"]), [["a", "b"], ["c", "d"]]).level).toBe(0);
  });
});

describe("scoreDependency (D5)", () => {
  it("is level 2 when every blocking edge is present and no independent pair is falsely ordered", () => {
    const result = scoreDependency([["a", "b"]], [["a", "b"]], [["c", "d"]]);
    expect(result.level).toBe(2);
  });

  it("is level 0 when a blocking edge is missing and an independent pair is falsely ordered", () => {
    const result = scoreDependency([["c", "d"]], [["a", "b"]], [["c", "d"]]);
    expect(result.level).toBe(0);
    expect(result.missingOrInverted).toEqual([["a", "b"]]);
    expect(result.falselyOrdered).toEqual([["c", "d"]]);
  });

  it("treats a reversed edge as missing, not present — direction matters", () => {
    const result = scoreDependency([["b", "a"]], [["a", "b"]], []);
    expect(result.level).toBe(1);
    expect(result.missingOrInverted).toEqual([["a", "b"]]);
  });

  it("catches a falsely-ordered independent pair in either direction", () => {
    expect(scoreDependency([["c", "d"]], [], [["c", "d"]]).level).toBe(1);
    expect(scoreDependency([["d", "c"]], [], [["c", "d"]]).level).toBe(1);
  });
});

describe("granularity discrimination (§4.5)", () => {
  it("subtracts the control over-decomposition rate from the decomposable right-sized rate", () => {
    const d = granularityDiscrimination({
      decomposableD4Level2Count: 8,
      decomposableCount: 10,
      overDecomposedControlCount: 1,
      controlCount: 4,
    });
    expect(d).toBeCloseTo(0.8 - 0.25);
  });

  it("is null with no decomposable or control items to compare", () => {
    expect(granularityDiscrimination({ decomposableD4Level2Count: 0, decomposableCount: 0, overDecomposedControlCount: 0, controlCount: 4 })).toBeNull();
    expect(granularityDiscrimination({ decomposableD4Level2Count: 0, decomposableCount: 4, overDecomposedControlCount: 0, controlCount: 0 })).toBeNull();
  });

  it("a learner who shatters everything scores negative even with perfect coverage elsewhere", () => {
    const d = granularityDiscrimination({
      decomposableD4Level2Count: 10,
      decomposableCount: 10,
      overDecomposedControlCount: 4,
      controlCount: 4,
    });
    expect(d).toBe(0); // 1.0 - 1.0: right-sized everywhere it counted, but shattered every control too
  });
});

describe("isOverDecomposedControl", () => {
  it("is true iff more than one node exists", () => {
    expect(isOverDecomposedControl(0)).toBe(false);
    expect(isOverDecomposedControl(1)).toBe(false);
    expect(isOverDecomposedControl(2)).toBe(true);
  });
});
