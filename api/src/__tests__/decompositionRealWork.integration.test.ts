import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function lockWholeAndAddNodes(
  ctx: any,
  attemptId: string,
  nodes: { id: string; parentId: string | null }[]
) {
  await mutationResolvers.lockDecompositionWhole(
    null,
    { attemptId, statement: "Move the household to the new city.", doneWhen: "Keys handed back by the 30th." },
    ctx
  );
  for (const n of nodes) {
    await mutationResolvers.logSkillCheckEvent(
      null,
      { attemptId, kind: "node_added", payload: JSON.stringify({ nodeId: n.id, depth: n.parentId ? 2 : 1 }) },
      ctx
    );
  }
}

const node = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  parentId: null,
  label: id,
  doneWhen: "",
  order: 0,
  dependsOn: [] as string[],
  ...over,
});

describe("startDecompositionRealWork", () => {
  it("serves the target's own title and DoD, mode open_practice, no authored itemId", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await prisma.goal.create({ data: { title: "Move house", dod: "Settled in the new place", userId: user.id } });

    const served = await mutationResolvers.startDecompositionRealWork(
      null,
      { targetType: "goal", targetId: goal.id },
      ctx
    );

    expect(served.title).toBe("Move house");
    expect(served.dod).toBe("Settled in the new place");
    expect(served.targetType).toBe("goal");

    const attempt = await prisma.skillAttempt.findUnique({ where: { id: served.attemptId } });
    expect(attempt!.mode).toBe("open_practice");
    expect(attempt!.moduleKey).toBeNull();
    expect(attempt!.itemId).toContain("open-practice");
  });

  it("rejects a goal or project that belongs to someone else", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const intruder = await createTestUser({ email: "intruder@example.com" });
    const goal = await prisma.goal.create({ data: { title: "Private goal", userId: owner.id } });

    await expect(
      mutationResolvers.startDecompositionRealWork(
        null,
        { targetType: "goal", targetId: goal.id },
        makeCtx(intruder)
      )
    ).rejects.toThrow(/Not found/);
  });
});

describe("submitDecompositionRealWork", () => {
  it("scores D1/D2/D4 and leaves D3/D5/D6 permanently null — no key exists for real material", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });

    const served = await mutationResolvers.startDecompositionRealWork(
      null,
      { targetType: "project", targetId: project.id },
      ctx
    );

    await lockWholeAndAddNodes(ctx, served.attemptId, [{ id: "a", parentId: null }, { id: "b", parentId: null }]);

    const nodes = [
      node("a", { doneWhen: "Booked by Friday." }),
      node("b", { doneWhen: "Boxes packed by the 20th." }),
    ];
    const result = await mutationResolvers.submitDecompositionRealWork(
      null,
      { attemptId: served.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes } },
      ctx
    );

    const byId = Object.fromEntries(result.score.criteria.map((c: any) => [c.id, c]));
    expect(byId.D1.level).not.toBeNull();
    expect(byId.D2.level).not.toBeNull();
    expect(byId.D4.level).not.toBeNull();
    expect(byId.D3.level).toBeNull();
    expect(byId.D5.level).toBeNull();
    expect(byId.D6.level).toBeNull();
    expect(byId.D3.scoredBy).toBe("unscored");
    expect(result.score.isComplete).toBe(false);
    expect(result.score.coverage).toBeNull();
  });

  it("rejects a second submission for the same attempt", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "project", targetId: project.id }, ctx);
    await mutationResolvers.lockDecompositionWhole(null, { attemptId: served.attemptId, statement: "x", doneWhen: "y" }, ctx);
    const structure = { whole: { statement: "x", doneWhen: "y" }, nodes: [] };
    await mutationResolvers.submitDecompositionRealWork(null, { attemptId: served.attemptId, structure }, ctx);
    await expect(
      mutationResolvers.submitDecompositionRealWork(null, { attemptId: served.attemptId, structure }, ctx)
    ).rejects.toThrow(/already scored/);
  });

  it("rejects scoring before the whole is locked", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "project", targetId: project.id }, ctx);
    await expect(
      mutationResolvers.submitDecompositionRealWork(
        null,
        { attemptId: served.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
        ctx
      )
    ).rejects.toThrow(/State the whole/);
  });
});

describe("real-work attempts never enter progress totals", () => {
  it("excludes open_practice attempts from criterionMeans, BFI trend and totalAttempts", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "project", targetId: project.id }, ctx);
    await lockWholeAndAddNodes(ctx, served.attemptId, [{ id: "a", parentId: null }, { id: "b", parentId: null }]);
    await mutationResolvers.submitDecompositionRealWork(
      null,
      { attemptId: served.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [node("a"), node("b")] } },
      ctx
    );

    const progress = await queryResolvers.decompositionProgress(null, {}, ctx);
    expect(progress.totalAttempts).toBe(0);
    expect(progress.criterionMeans.every((c: any) => c.count === 0)).toBe(true);
    expect(progress.breadthFirstIndexTrend).toEqual([]);
  });
});

describe("exportDecompositionBreakdown", () => {
  async function scoredProjectAttempt(ctx: any, projectId: string, nodes: any[]) {
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "project", targetId: projectId }, ctx);
    await lockWholeAndAddNodes(ctx, served.attemptId, nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
    await mutationResolvers.submitDecompositionRealWork(
      null,
      { attemptId: served.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes } },
      ctx
    );
    return served.attemptId;
  }

  it("rejects exporting before the attempt is scored", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "project", targetId: project.id }, ctx);
    await expect(
      mutationResolvers.exportDecompositionBreakdown(null, { attemptId: served.attemptId, nodeIds: ["a"] }, ctx)
    ).rejects.toThrow(/Score this breakdown/);
  });

  it("targeting a Project: every selected piece becomes a flat Action under it, doneWhen survives as a Note", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const nodes = [
      node("a", { label: "Book movers", doneWhen: "Booked by Friday." }),
      node("b", { label: "Pack boxes", parentId: "a", doneWhen: "" }),
    ];
    const attemptId = await scoredProjectAttempt(ctx, project.id, nodes);

    const result = await mutationResolvers.exportDecompositionBreakdown(null, { attemptId, nodeIds: ["a", "b"] }, ctx);

    expect(result.createdProjects).toHaveLength(0);
    expect(result.createdActions).toHaveLength(2);
    expect(result.createdActions.every((a: any) => a.projectId === project.id)).toBe(true);

    const booked = result.createdActions.find((a: any) => a.title === "Book movers");
    const note = await prisma.note.findFirst({ where: { entityType: "action", entityId: booked!.id } });
    expect(note?.body).toBe("Booked by Friday.");

    const actionsInDb = await prisma.action.findMany({ where: { projectId: project.id } });
    expect(actionsInDb).toHaveLength(2);
  });

  it("targeting a Goal: depth-1 pieces become Projects under it, their depth-2 children become Actions under the new Project", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await prisma.goal.create({ data: { title: "Move house", userId: user.id } });
    const nodes = [
      node("a", { label: "Logistics" }),
      node("b", { label: "Book movers", parentId: "a", doneWhen: "Booked by Friday." }),
      node("c", { label: "Paperwork" }),
    ];
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "goal", targetId: goal.id }, ctx);
    await lockWholeAndAddNodes(ctx, served.attemptId, nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
    await mutationResolvers.submitDecompositionRealWork(
      null,
      { attemptId: served.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes } },
      ctx
    );

    const result = await mutationResolvers.exportDecompositionBreakdown(
      null,
      { attemptId: served.attemptId, nodeIds: ["a", "b", "c"] },
      ctx
    );

    expect(result.createdProjects.map((p: any) => p.title).sort()).toEqual(["Logistics", "Paperwork"]);
    expect(result.createdActions).toHaveLength(1);
    const logisticsProject = result.createdProjects.find((p: any) => p.title === "Logistics")!;
    expect(result.createdActions[0].projectId).toBe(logisticsProject.id);

    const dbProjects = await prisma.project.findMany({ where: { goalId: goal.id } });
    expect(dbProjects).toHaveLength(2);
  });

  it("exports a depth-2 piece as a standalone action when its parent wasn't selected", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await prisma.goal.create({ data: { title: "Move house", userId: user.id } });
    const nodes = [node("a", { label: "Logistics" }), node("b", { label: "Book movers", parentId: "a" })];
    const served = await mutationResolvers.startDecompositionRealWork(null, { targetType: "goal", targetId: goal.id }, ctx);
    await lockWholeAndAddNodes(ctx, served.attemptId, nodes.map((n) => ({ id: n.id, parentId: n.parentId })));
    await mutationResolvers.submitDecompositionRealWork(
      null,
      { attemptId: served.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes } },
      ctx
    );

    const result = await mutationResolvers.exportDecompositionBreakdown(null, { attemptId: served.attemptId, nodeIds: ["b"] }, ctx);

    expect(result.createdProjects).toHaveLength(0);
    expect(result.createdActions).toHaveLength(1);
    expect(result.createdActions[0].projectId).toBeNull();
  });

  it("counts dropped dependency edges among the exported pieces and states them, never silently", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const nodes = [node("a"), node("b", { dependsOn: ["a"] })];
    const attemptId = await scoredProjectAttempt(ctx, project.id, nodes);

    const result = await mutationResolvers.exportDecompositionBreakdown(null, { attemptId, nodeIds: ["a", "b"] }, ctx);
    expect(result.dependencyEdgesDropped).toBe(1);

    const onlyOne = await scoredProjectAttempt(ctx, project.id, [node("c"), node("d", { dependsOn: ["c"] })]);
    const resultPartial = await mutationResolvers.exportDecompositionBreakdown(null, { attemptId: onlyOne, nodeIds: ["d"] }, ctx);
    expect(resultPartial.dependencyEdgesDropped).toBe(0);
  });

  it("rejects a second export of the same attempt — reversible via Tracker's own delete, not a second write", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({ data: { title: "Relocate", userId: user.id } });
    const attemptId = await scoredProjectAttempt(ctx, project.id, [node("a")]);

    await mutationResolvers.exportDecompositionBreakdown(null, { attemptId, nodeIds: ["a"] }, ctx);
    await expect(
      mutationResolvers.exportDecompositionBreakdown(null, { attemptId, nodeIds: ["a"] }, ctx)
    ).rejects.toThrow(/already been exported/);

    const actionsInDb = await prisma.action.findMany({ where: { projectId: project.id } });
    expect(actionsInDb).toHaveLength(1);
  });

  it("rejects exporting into a target that no longer belongs to the caller", async () => {
    const owner = await createTestUser({ email: "owner2@example.com" });
    const intruder = await createTestUser({ email: "intruder2@example.com" });
    const project = await prisma.project.create({ data: { title: "Relocate", userId: owner.id } });
    const attemptId = await scoredProjectAttempt(makeCtx(owner), project.id, [node("a")]);

    await expect(
      mutationResolvers.exportDecompositionBreakdown(null, { attemptId, nodeIds: ["a"] }, makeCtx(intruder))
    ).rejects.toThrow(/Not found/);
  });
});
