import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { getMonitoringProgress } from "../services/skills/monitoring/monitoringSession";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("session self-audit — open practice, never scored", () => {
  it("serves the four fixed question keys and rejects a second submission", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const served = await mutationResolvers.startMonitoringSelfAudit(null, {}, ctx);
    expect(served.questionKeys).toEqual(["flattery", "anchor", "smuggled_premise", "agreement_reversal"]);

    const answers = { flattery: "It called my idea brilliant with no basis.", anchor: "It anchored on a number I mentioned once.", smuggledPremise: "It assumed a deadline I never agreed to.", agreementReversal: "It dropped a caution the moment I pushed back." };
    const result = await mutationResolvers.submitMonitoringSelfAudit(null, { attemptId: served.attemptId, answers }, ctx);
    expect(result.record).toEqual({
      flattery: answers.flattery,
      anchor: answers.anchor,
      smuggledPremise: answers.smuggledPremise,
      agreementReversal: answers.agreementReversal,
    });

    await expect(
      mutationResolvers.submitMonitoringSelfAudit(null, { attemptId: served.attemptId, answers }, ctx)
    ).rejects.toThrow(/already complete/);
  });

  it("rejects an empty answer", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startMonitoringSelfAudit(null, {}, ctx);

    await expect(
      mutationResolvers.submitMonitoringSelfAudit(
        null,
        { attemptId: served.attemptId, answers: { flattery: "", anchor: "x", smuggledPremise: "x", agreementReversal: "x" } },
        ctx
      )
    ).rejects.toThrow(/cannot be empty/);
  });

  it("is excluded from every monitoringProgress total", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const served = await mutationResolvers.startMonitoringSelfAudit(null, {}, ctx);
    await mutationResolvers.submitMonitoringSelfAudit(
      null,
      { attemptId: served.attemptId, answers: { flattery: "x", anchor: "x", smuggledPremise: "x", agreementReversal: "x" } },
      ctx
    );

    const progress = await getMonitoringProgress(prisma, user.id, "en");
    expect(progress.totalAttempts).toBe(0);
  });
});
