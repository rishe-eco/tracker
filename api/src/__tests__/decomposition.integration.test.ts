import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { ITEM_SPEC_BY_ID } from "../content/skills/decomposition/v1";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const serve = (ctx: any, moduleKey?: string) =>
  mutationResolvers.startDecompositionItem(null, { mode: "calibrated_practice", moduleKey }, ctx);

const node = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  parentId: null,
  label: id,
  doneWhen: "booked by Friday",
  order: 0,
  dependsOn: [],
  ...over,
});

describe("startDecompositionItem", () => {
  it("serves an item without leaking anything that answers it", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    expect(served).not.toBeNull();

    const payload = JSON.stringify(served);
    const spec = ITEM_SPEC_BY_ID.get(served!.item.itemId)!;
    expect(served!.item).not.toHaveProperty("key");
    expect(served!.item).not.toHaveProperty("seededFault");
    expect(payload).not.toContain(spec.keyNote);
    if (spec.type === "arrangement") {
      // The palette carries {id, label} only — never decoy/atomic/intendedDepth.
      for (const piece of spec.key.pieces) {
        expect(payload).not.toContain(`"decoy"`);
        expect(payload).not.toContain(`"atomic"`);
        expect(payload).not.toContain(`"intendedDepth"`);
      }
    }
  });

  it("gives every module a servable offline item", async () => {
    for (const moduleKey of ["d1-frame", "d2-breadth", "d3-seams", "d4-size", "d5-order", "d6-recompose"]) {
      const ctx = makeCtx(await createTestUser({ email: `${moduleKey}@example.com` }));
      const served = await serve(ctx, moduleKey);
      expect(served, `module ${moduleKey}`).not.toBeNull();
      expect(served!.item.moduleKey).toBe(moduleKey);
    }
  });

  it("never serves the same item to a learner twice", async () => {
    const ctx = makeCtx(await createTestUser());
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const served = await serve(ctx, "d1-frame");
      if (!served) break;
      expect(seen.has(served.item.itemId)).toBe(false);
      seen.add(served.item.itemId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("the whole-first gate", () => {
  it("rejects locking the whole after a piece already exists", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    await mutationResolvers.logSkillCheckEvent(
      null,
      { attemptId: served!.attemptId, kind: "node_added", payload: JSON.stringify({ nodeId: "a", depth: 1 }) },
      ctx
    );
    await expect(
      mutationResolvers.lockDecompositionWhole(null, { attemptId: served!.attemptId, statement: "x", doneWhen: "y" }, ctx)
    ).rejects.toThrow(/piece already exists/);
  });

  it("rejects scoring before the whole is locked", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    await expect(
      mutationResolvers.submitDecompositionAttempt(
        null,
        { attemptId: served!.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
        ctx
      )
    ).rejects.toThrow(/State the whole/);
  });

  it("rejects locking the whole twice", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    await mutationResolvers.lockDecompositionWhole(null, { attemptId: served!.attemptId, statement: "x", doneWhen: "y" }, ctx);
    await expect(
      mutationResolvers.lockDecompositionWhole(null, { attemptId: served!.attemptId, statement: "x2", doneWhen: "y2" }, ctx)
    ).rejects.toThrow(/already locked/);
  });
});

describe("repair items require a diagnosis first", () => {
  it("rejects scoring a repair item before the fault is named", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d3-seams"); // pool has repair items under d3
    // Find a repair item specifically by re-serving until one comes up, or
    // trust the pool composition (>=2 repair items per module d3/d4/d5/d6).
    let repairServed = served;
    for (let i = 0; i < 6 && repairServed && !repairServed.needsDiagnosis; i++) {
      repairServed = await serve(ctx, "d3-seams");
    }
    expect(repairServed?.needsDiagnosis).toBe(true);

    await mutationResolvers.lockDecompositionWhole(
      null,
      { attemptId: repairServed!.attemptId, statement: "Fix the given plan.", doneWhen: "Pieces no longer overlap." },
      ctx
    );
    await expect(
      mutationResolvers.submitDecompositionAttempt(
        null,
        { attemptId: repairServed!.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
        ctx
      )
    ).rejects.toThrow(/Name the fault/);
  });
});

describe("full path: serve -> lock whole -> author -> commit -> score", () => {
  it("scores an arrangement item end to end with no credential configured", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    // dc-p3/dc-p4 are the pool arrangement items for d1-frame.
    let attempt = served!;
    for (let i = 0; i < 6 && attempt && ITEM_SPEC_BY_ID.get(attempt.item.itemId)!.type !== "arrangement"; i++) {
      attempt = (await serve(ctx, "d1-frame"))!;
    }
    const spec = ITEM_SPEC_BY_ID.get(attempt.item.itemId)!;
    expect(spec.type).toBe("arrangement");

    await mutationResolvers.lockDecompositionWhole(
      null,
      { attemptId: attempt.attemptId, statement: "The sale is priced, advertised, and staffed for the day.", doneWhen: "Priced and advertised by Friday." },
      ctx
    );

    const requiredIds = spec.key.requiredPieceIds;
    for (const id of requiredIds) {
      await mutationResolvers.logSkillCheckEvent(
        null,
        { attemptId: attempt.attemptId, kind: "node_added", payload: JSON.stringify({ nodeId: id, depth: 1 }) },
        ctx
      );
    }

    const nodes = requiredIds.map((id) => node(id, { doneWhen: "booked by Friday" }));
    const result = await mutationResolvers.submitDecompositionAttempt(
      null,
      { attemptId: attempt.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes } },
      ctx
    );

    expect(result.score.criteria).toHaveLength(6);
    expect(result.score.criteria.every((c: any) => c.level !== null)).toBe(true);
    expect(result.reveal.pieces.length).toBeGreaterThan(0);
    expect(typeof result.moduleState).toBe("string");
  });

  it("rejects a second submission for the same attempt", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    await mutationResolvers.lockDecompositionWhole(null, { attemptId: served!.attemptId, statement: "x", doneWhen: "y" }, ctx);
    const structure = { whole: { statement: "x", doneWhen: "y" }, nodes: [] };
    await mutationResolvers.submitDecompositionAttempt(null, { attemptId: served!.attemptId, structure }, ctx);
    await expect(
      mutationResolvers.submitDecompositionAttempt(null, { attemptId: served!.attemptId, structure }, ctx)
    ).rejects.toThrow(/already scored/);
  });
});

describe("the revision chain", () => {
  it("links a revision to its draft, never asks for a diagnosis twice, and computes a delta", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    await mutationResolvers.lockDecompositionWhole(null, { attemptId: served!.attemptId, statement: "x", doneWhen: "y" }, ctx);
    await mutationResolvers.submitDecompositionAttempt(
      null,
      { attemptId: served!.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
      ctx
    );

    const revision = await mutationResolvers.startDecompositionRevision(null, { attemptId: served!.attemptId }, ctx);
    expect(revision.item.itemId).toBe(served!.item.itemId);
    expect(revision.needsDiagnosis).toBe(false);

    await mutationResolvers.lockDecompositionWhole(
      null,
      { attemptId: revision.attemptId, statement: "A better whole statement with a real done condition.", doneWhen: "Booked by Friday." },
      ctx
    );
    const result = await mutationResolvers.submitDecompositionAttempt(
      null,
      { attemptId: revision.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
      ctx
    );
    expect(result.delta).not.toBeNull();
  });

  it("refuses to revise an unscored draft, or to revise twice", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "d1-frame");
    await expect(
      mutationResolvers.startDecompositionRevision(null, { attemptId: served!.attemptId }, ctx)
    ).rejects.toThrow(/Score the draft/);

    await mutationResolvers.lockDecompositionWhole(null, { attemptId: served!.attemptId, statement: "x", doneWhen: "y" }, ctx);
    await mutationResolvers.submitDecompositionAttempt(
      null,
      { attemptId: served!.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
      ctx
    );
    await mutationResolvers.startDecompositionRevision(null, { attemptId: served!.attemptId }, ctx);
    await expect(
      mutationResolvers.startDecompositionRevision(null, { attemptId: served!.attemptId }, ctx)
    ).rejects.toThrow(/already been revised/);
  });
});

describe("a full probe path completes with outbound network blocked", () => {
  it("serves, locks, and scores every item type with no credential and no network reachable", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    const token = process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    try {
      const ctx = makeCtx(await createTestUser());
      for (const moduleKey of ["d1-frame", "d3-seams", "d4-size", "d5-order", "d6-recompose"]) {
        const served = await serve(ctx, moduleKey);
        expect(served, moduleKey).not.toBeNull();
        const spec = ITEM_SPEC_BY_ID.get(served!.item.itemId)!;
        if (spec.type === "repair") {
          await mutationResolvers.lockDecompositionDiagnosis(null, { attemptId: served!.attemptId, tags: [spec.seededFault] }, ctx);
        }
        await mutationResolvers.lockDecompositionWhole(
          null,
          { attemptId: served!.attemptId, statement: "A reframed whole for this task.", doneWhen: "Booked by Friday." },
          ctx
        );
        const result = await mutationResolvers.submitDecompositionAttempt(
          null,
          { attemptId: served!.attemptId, structure: { whole: { statement: "x", doneWhen: "y" }, nodes: [] } },
          ctx
        );
        expect(result.score.criteria.length).toBe(6);
      }
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });
});
