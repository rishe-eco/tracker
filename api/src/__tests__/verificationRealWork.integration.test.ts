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

describe("startVerificationRealWork", () => {
  it("opens an open_practice attempt with no moduleKey and no bench", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const served = await mutationResolvers.startVerificationRealWork(null, { claim: "The library parses ISO week dates." }, ctx);
    expect(served.claim).toBe("The library parses ISO week dates.");

    const attempt = await prisma.skillAttempt.findUnique({ where: { id: served.attemptId } });
    expect(attempt!.mode).toBe("open_practice");
    expect(attempt!.moduleKey).toBeNull();
    expect(attempt!.skillKey).toBe("verification");
    expect(attempt!.itemId).toContain("open-practice");
  });

  it("rejects an empty claim", async () => {
    const ctx = makeCtx(await createTestUser());
    await expect(mutationResolvers.startVerificationRealWork(null, { claim: "   " }, ctx)).rejects.toThrow(/cannot be empty/);
  });
});

describe("submitVerificationRealWork", () => {
  it("completes the record and rejects a second submission", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await mutationResolvers.startVerificationRealWork(null, { claim: "The API is deprecated." }, ctx);

    const result = await mutationResolvers.submitVerificationRealWork(
      null,
      {
        attemptId: served.attemptId,
        oracle: "Check the changelog directly.",
        result: "Changelog confirms it was deprecated in v3.0.",
        verdict: "supported",
        confidence: 90,
        residualRisk: "Whether a later patch reversed it is still unchecked.",
      },
      ctx
    );

    expect(result.record).toEqual({
      claim: "The API is deprecated.",
      oracle: "Check the changelog directly.",
      result: "Changelog confirms it was deprecated in v3.0.",
      verdict: "supported",
      residualRisk: "Whether a later patch reversed it is still unchecked.",
    });

    await expect(
      mutationResolvers.submitVerificationRealWork(
        null,
        { attemptId: served.attemptId, oracle: "again", result: "again", verdict: "supported", confidence: 50, residualRisk: "x" },
        ctx
      )
    ).rejects.toThrow(/already complete/);
  });

  it("rejects someone else's attempt", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const intruder = await createTestUser({ email: "intruder@example.com" });
    const served = await mutationResolvers.startVerificationRealWork(null, { claim: "x" }, makeCtx(owner));

    await expect(
      mutationResolvers.submitVerificationRealWork(
        null,
        { attemptId: served.attemptId, oracle: "o", result: "r", verdict: "supported", confidence: 50, residualRisk: "x" },
        makeCtx(intruder)
      )
    ).rejects.toThrow(/Not found/);
  });
});

describe("real-work never counts toward progress or mastery", () => {
  it("is excluded from verificationProgress totals", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await mutationResolvers.startVerificationRealWork(null, { claim: "x" }, ctx);
    await mutationResolvers.submitVerificationRealWork(
      null,
      { attemptId: served.attemptId, oracle: "o", result: "r", verdict: "supported", confidence: 50, residualRisk: "x" },
      ctx
    );

    const progress = await queryResolvers.verificationProgress(null, {}, ctx);
    expect(progress.totalAttempts).toBe(0);
  });
});
