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

describe("startDelegationRealWork", () => {
  it("opens an open_practice attempt with no moduleKey", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const served = await mutationResolvers.startDelegationRealWork(
      null,
      {
        handingOver: "Drafting the migration script from the schema diff.",
        keeping: "Deciding whether the down-migration is safe on live data.",
        wouldTellMeWrong: "If I can't read the generated script well enough to judge the rollback.",
      },
      ctx
    );
    expect(served.handingOver).toBe("Drafting the migration script from the schema diff.");

    const attempt = await prisma.skillAttempt.findUnique({ where: { id: served.attemptId } });
    expect(attempt!.mode).toBe("open_practice");
    expect(attempt!.moduleKey).toBeNull();
    expect(attempt!.skillKey).toBe("delegation");
    expect(attempt!.itemId).toContain("open-practice");
  });

  it("rejects an empty field", async () => {
    const ctx = makeCtx(await createTestUser());
    await expect(
      mutationResolvers.startDelegationRealWork(null, { handingOver: "   ", keeping: "x", wouldTellMeWrong: "y" }, ctx)
    ).rejects.toThrow(/cannot be empty/);
  });
});

describe("submitDelegationRealWork", () => {
  it("completes the record and rejects a second submission", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await mutationResolvers.startDelegationRealWork(
      null,
      { handingOver: "Draft the reply", keeping: "Decide on a refund", wouldTellMeWrong: "If the tone feels off" },
      ctx
    );

    const result = await mutationResolvers.submitDelegationRealWork(
      null,
      { attemptId: served.attemptId, whatActuallyHappened: "Draft was fine. I couldn't judge the refund call and approved it anyway." },
      ctx
    );

    expect(result.record).toEqual({
      handingOver: "Draft the reply",
      keeping: "Decide on a refund",
      wouldTellMeWrong: "If the tone feels off",
      whatActuallyHappened: "Draft was fine. I couldn't judge the refund call and approved it anyway.",
    });

    await expect(
      mutationResolvers.submitDelegationRealWork(null, { attemptId: served.attemptId, whatActuallyHappened: "again" }, ctx)
    ).rejects.toThrow(/already complete/);
  });

  it("rejects someone else's attempt", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const intruder = await createTestUser({ email: "intruder@example.com" });
    const served = await mutationResolvers.startDelegationRealWork(null, { handingOver: "x", keeping: "y", wouldTellMeWrong: "z" }, makeCtx(owner));

    await expect(
      mutationResolvers.submitDelegationRealWork(null, { attemptId: served.attemptId, whatActuallyHappened: "r" }, makeCtx(intruder))
    ).rejects.toThrow(/Not found/);
  });
});

describe("real-work never counts toward progress or mastery", () => {
  it("is excluded from delegationProgress totals", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await mutationResolvers.startDelegationRealWork(null, { handingOver: "x", keeping: "y", wouldTellMeWrong: "z" }, ctx);
    await mutationResolvers.submitDelegationRealWork(null, { attemptId: served.attemptId, whatActuallyHappened: "r" }, ctx);

    const progress = await queryResolvers.delegationProgress(null, {}, ctx);
    expect(progress.totalAttempts).toBe(0);
  });
});
