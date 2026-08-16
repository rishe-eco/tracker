import { describe, expect, it } from "vitest";
import { ITEM_SPEC_BY_ID } from "../content/skills/decomposition/v1";
import {
  assembleDecompositionScore,
  atCriterion,
  evaluateDecompositionMastery,
  type DecompositionStructure,
  type ScoredDecompositionAttempt,
  type SubmittedNode,
} from "../services/skills/decomposition/scoring";

function node(id: string, over: Partial<SubmittedNode> = {}): SubmittedNode {
  return { id, parentId: null, label: id, doneWhen: "booked by Friday", order: 0, dependsOn: [], ...over };
}

const NO_EVENTS = { addEventsInOrder: [] as { nodeId: string; depth: 1 | 2 }[] };

describe("assembleDecompositionScore — arrangement (dc-a1)", () => {
  const item = ITEM_SPEC_BY_ID.get("dc-a1")!;
  // required: demo_old_fixtures, buy_new_fixtures, install_new_fixtures, paint_and_finish
  // decoys: monolith_renovate, clear_out_old_bathroom (overlaps demo), repaint_hallway

  const wholeStatement: DecompositionStructure["whole"] = {
    statement: "New fixtures are in and the room is finished, without redoing the whole bathroom myself.",
    doneWhen: "Painted and finished by Friday.",
  };

  it("scores every criterion at level 2 for a correct, breadth-first, no-decoy submission", () => {
    const nodes = [
      node("demo_old_fixtures", { order: 1 }),
      node("buy_new_fixtures", { order: 2 }),
      node("install_new_fixtures", { order: 3, dependsOn: ["demo_old_fixtures", "buy_new_fixtures"] }),
      node("paint_and_finish", { order: 4, dependsOn: ["install_new_fixtures"] }),
    ];
    const addEventsInOrder = nodes.map((n) => ({ nodeId: n.id, depth: 1 as const }));

    const score = assembleDecompositionScore({
      item,
      structure: { whole: wholeStatement, nodes },
      addEventsInOrder,
      wholeStatedFirst: true,
      itemPrompt: item.itemId, // stand-in; near-copy check only matters when it's actually the prompt
      locale: "en",
      judgeAvailable: false,
    });

    expect(score.isVoid).toBe(false);
    expect(score.isComplete).toBe(true);
    expect(score.criteria.map((c) => `${c.id}:${c.level}`)).toEqual(["D1:2", "D2:2", "D3:2", "D4:2", "D5:2", "D6:2"]);
    expect(score.total).toBe(12);
    expect(score.coverage).toEqual({ found: 4, required: 4 });
  });

  it("penalises placing the monolith decoy (D4) and an overlapping decoy (D3)", () => {
    const nodes = [
      node("monolith_renovate"),
      node("clear_out_old_bathroom"),
      node("demo_old_fixtures"),
      node("buy_new_fixtures"),
    ];
    const score = assembleDecompositionScore({
      item,
      structure: { whole: wholeStatement, nodes },
      addEventsInOrder: nodes.map((n) => ({ nodeId: n.id, depth: 1 as const })),
      wholeStatedFirst: true,
      itemPrompt: "unrelated prompt text",
      locale: "en",
      judgeAvailable: false,
    });

    const d3 = score.criteria.find((c) => c.id === "D3")!;
    const d4 = score.criteria.find((c) => c.id === "D4")!;
    const d6 = score.criteria.find((c) => c.id === "D6")!;
    expect(d4.level).toBe(0); // monolith placed
    expect(d3.level).toBe(1); // demo_old_fixtures + clear_out_old_bathroom both placed
    expect(d6.level).toBe(0); // install_new_fixtures and paint_and_finish missing (2+)
  });

  it("is void when nothing at all is submitted", () => {
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "", doneWhen: "" }, nodes: [] },
      addEventsInOrder: [],
      wholeStatedFirst: true,
      itemPrompt: "x",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.isVoid).toBe(true);
    expect(score.total).toBe(0);
    expect(score.isComplete).toBe(false);
  });
});

describe("assembleDecompositionScore — control (dc-a3)", () => {
  const item = ITEM_SPEC_BY_ID.get("dc-a3")!; // control

  it("scores level 2 across the board when left whole", () => {
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "The haircut appointment is confirmed for Saturday morning.", doneWhen: "Confirmed by phone." }, nodes: [] },
      ...NO_EVENTS,
      wholeStatedFirst: true,
      itemPrompt: "Confirm a haircut appointment for Saturday morning.",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.overDecomposed).toBe(false);
    expect(score.criteria.find((c) => c.id === "D4")!.level).toBe(2);
  });

  it("flags over-decomposition when split into more than one piece", () => {
    const score = assembleDecompositionScore({
      item,
      structure: {
        whole: { statement: "The haircut appointment is confirmed for Saturday morning.", doneWhen: "Confirmed by phone." },
        nodes: [node("call"), node("write_it_down")],
      },
      addEventsInOrder: [{ nodeId: "call", depth: 1 }, { nodeId: "write_it_down", depth: 1 }],
      wholeStatedFirst: true,
      itemPrompt: "Confirm a haircut appointment for Saturday morning.",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.overDecomposed).toBe(true);
    expect(score.criteria.find((c) => c.id === "D4")!.level).toBe(0);
  });
});

describe("assembleDecompositionScore — repair (dc-p17, overlap)", () => {
  const item = ITEM_SPEC_BY_ID.get("dc-p17")!;
  // key: required n1,n3,n4; decoy n2; overlapPairs [[n1,n2]]; independentPairs [[n3,n4]]

  it("scores D3 level 2 once the overlapping supplied node is removed", () => {
    const nodes = [node("n1"), node("n3", { doneWhen: "booked" }), node("n4", { doneWhen: "updated by Friday" })];
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "Move to the new apartment.", doneWhen: "Done by the 1st." }, nodes },
      addEventsInOrder: [],
      wholeStatedFirst: true,
      itemPrompt: "x",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.criteria.find((c) => c.id === "D3")!.level).toBe(2);
    expect(score.criteria.find((c) => c.id === "D6")!.level).toBe(2);
  });

  it("scores D2 as not-applicable (never 0) when the fix only edits/removes pre-seeded pieces", () => {
    // A pure edit-in-place fix has no authoring order to judge — scoring it 0
    // via the general breadth-first formula would make this fault type
    // permanently ineligible for mastery, since mastery requires no
    // criterion at 0.
    const nodes = [node("n1"), node("n3", { doneWhen: "booked" }), node("n4", { doneWhen: "updated by Friday" })];
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "Move to the new apartment.", doneWhen: "Done by the 1st." }, nodes },
      addEventsInOrder: [],
      wholeStatedFirst: true,
      itemPrompt: "x",
      locale: "en",
      judgeAvailable: false,
    });
    const d2 = score.criteria.find((c) => c.id === "D2")!;
    expect(d2.level).toBeNull();
    expect(d2.scoredBy).toBe("unscored");
  });

  it("still scores D3 level 1 if the fix leaves both overlapping pieces in place", () => {
    const nodes = [node("n1"), node("n2"), node("n3"), node("n4")];
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "Move to the new apartment.", doneWhen: "Done by the 1st." }, nodes },
      addEventsInOrder: [],
      wholeStatedFirst: true,
      itemPrompt: "x",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.criteria.find((c) => c.id === "D3")!.level).toBe(1);
  });
});

describe("assembleDecompositionScore — repair (dc-p23, monolith)", () => {
  const item = ITEM_SPEC_BY_ID.get("dc-p23")!;

  it("scores D4 level 0 if the fix leaves the monolith unsplit", () => {
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "Renovate the bathroom.", doneWhen: "Done by the end of the month." }, nodes: [node("n1", { doneWhen: "" })] },
      addEventsInOrder: [],
      wholeStatedFirst: true,
      itemPrompt: "x",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.criteria.find((c) => c.id === "D4")!.level).toBe(0);
  });

  it("scores D4 level 2 once split into bounded pieces", () => {
    const nodes = [node("demo"), node("plumbing"), node("install"), node("paint")];
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "Renovate the bathroom.", doneWhen: "Done by the end of the month." }, nodes },
      addEventsInOrder: [],
      wholeStatedFirst: true,
      itemPrompt: "x",
      locale: "en",
      judgeAvailable: false,
    });
    expect(score.criteria.find((c) => c.id === "D4")!.level).toBe(2);
  });
});

describe("assembleDecompositionScore — breakdown (dc-p5)", () => {
  const item = ITEM_SPEC_BY_ID.get("dc-p5")!;

  it("scores D1/D2/D4 with no model, and leaves D3/D5/D6 unscored", () => {
    const nodes = [
      node("flights"),
      node("entry_requirements"),
      node("rough_itinerary"),
      node("first_lodging"),
      node("pack_gear"),
    ];
    const score = assembleDecompositionScore({
      item,
      structure: { whole: { statement: "Fly to three countries and see them without over-planning it.", doneWhen: "Flights and first lodging booked by next Friday." }, nodes },
      addEventsInOrder: nodes.map((n) => ({ nodeId: n.id, depth: 1 as const })),
      wholeStatedFirst: true,
      itemPrompt: "totally different scenario text",
      locale: "en",
      judgeAvailable: false,
    });

    expect(score.criteria.find((c) => c.id === "D1")!.level).toBe(2);
    expect(score.criteria.find((c) => c.id === "D2")!.level).toBe(2);
    expect(score.criteria.find((c) => c.id === "D4")!.level).toBe(2);
    expect(score.criteria.find((c) => c.id === "D3")!.level).toBeNull();
    expect(score.criteria.find((c) => c.id === "D3")!.scoredBy).toBe("unscored");
    expect(score.criteria.find((c) => c.id === "D5")!.level).toBeNull();
    expect(score.criteria.find((c) => c.id === "D6")!.level).toBeNull();
    expect(score.isComplete).toBe(false);
  });
});

describe("evaluateDecompositionMastery (§4.7)", () => {
  const perfectScore = () => ({
    criteria: (["D1", "D2", "D3", "D4", "D5", "D6"] as const).map((id) => ({ id, level: 2 as const, scoredBy: "key" as const, evidence: "" })),
    total: 12,
    scoredCount: 6,
    coverage: null,
    bfi: 1,
    overDecomposed: false,
    isVoid: false,
    isComplete: true,
  });

  const attempt = (over: Partial<ScoredDecompositionAttempt> = {}): ScoredDecompositionAttempt => ({
    score: perfectScore(),
    moduleKey: "d1-frame",
    itemType: "arrangement",
    dayKey: "2026-08-15",
    unscaffolded: true,
    ownCriterion: "D1",
    ...over,
  });

  it("masters on two clean unscaffolded attempts across two distinct days", () => {
    const verdict = evaluateDecompositionMastery([attempt({ dayKey: "2026-08-14" }), attempt({ dayKey: "2026-08-15" })]);
    expect(verdict.mastered).toBe(true);
  });

  it("refuses mastery earned in a single sitting", () => {
    const verdict = evaluateDecompositionMastery([attempt(), attempt()]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.map((g) => g.code)).toContain("days");
  });

  it("ignores scaffolded (revision) attempts", () => {
    const verdict = evaluateDecompositionMastery([
      attempt({ unscaffolded: false, dayKey: "2026-08-14" }),
      attempt({ unscaffolded: false, dayKey: "2026-08-15" }),
    ]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.map((g) => g.code)).toContain("attempts");
  });

  it("requires level 2 on the module's own criterion, not just a strong total", () => {
    const weakOwnCriterion = {
      ...perfectScore(),
      criteria: perfectScore().criteria.map((c) => (c.id === "D1" ? { ...c, level: 1 as const } : c)),
      total: 11,
    };
    const verdict = evaluateDecompositionMastery([
      attempt({ dayKey: "2026-08-14", score: weakOwnCriterion }),
      attempt({ dayKey: "2026-08-15", score: weakOwnCriterion }),
    ]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.map((g) => g.code)).toContain("atCriterion");
  });

  it("blocks mastery if any control item in the window was over-decomposed, even with two perfect scored attempts", () => {
    const verdict = evaluateDecompositionMastery([
      attempt({ dayKey: "2026-08-14" }),
      attempt({ dayKey: "2026-08-15" }),
      attempt({ itemType: "control", score: { ...perfectScore(), overDecomposed: true }, dayKey: "2026-08-15" }),
    ]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.map((g) => g.code)).toContain("overDecomposedControl");
  });

  it("keeps mastery out of reach on an incomplete rubric rather than lowering the bar", () => {
    const incomplete = { ...perfectScore(), isComplete: false, scoredCount: 3 };
    const verdict = evaluateDecompositionMastery([
      attempt({ dayKey: "2026-08-14", score: incomplete }),
      attempt({ dayKey: "2026-08-15", score: incomplete }),
    ]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.map((g) => g.code)).toContain("rubricIncomplete");
  });
});

describe("atCriterion", () => {
  it("requires no criterion at zero even with a high total", () => {
    const score = {
      criteria: (["D1", "D2", "D3", "D4", "D5", "D6"] as const).map((id) => ({
        id,
        level: (id === "D3" ? 0 : 2) as 0 | 2,
        scoredBy: "key" as const,
        evidence: "",
      })),
      total: 10,
      scoredCount: 6,
      coverage: null,
      bfi: 1,
      overDecomposed: false,
      isVoid: false,
      isComplete: true,
    };
    expect(
      atCriterion({ score, moduleKey: "d1-frame", itemType: "arrangement", dayKey: "x", unscaffolded: true, ownCriterion: "D1" })
    ).toBe(false);
  });
});
