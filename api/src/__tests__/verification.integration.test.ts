import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function startAndName(ctx: any, moduleKey = "v1-oracle") {
  const served = await mutationResolvers.startVerificationItem(null, { mode: "module", moduleKey, probeId: null }, ctx);
  await mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "Recompute the figure myself." }, ctx);
  return served;
}

/**
 * A fresh user's first `startVerificationItem` call for "v1-oracle" always
 * serves `v1-oracle-pool-1` (CORRECT, difficulty 1, first in the pool array
 * and tied for lowest difficulty — sort is stable). Each item is served
 * exactly once per user (the seen-filter keys off any existing attempt row),
 * so calling this module's serve `n` times in a row reliably walks the pool
 * in its authored order: pool-1, pool-2, pool-3, ...
 */
async function serveNth(ctx: any, n: number, moduleKey = "v1-oracle") {
  let served: any = null;
  for (let i = 0; i < n; i++) {
    served = await mutationResolvers.startVerificationItem(null, { mode: "module", moduleKey, probeId: null }, ctx);
  }
  return served;
}

describe("startVerificationItem — bench-leak rule", () => {
  it("never ships independent/discriminating/outcome/failingElementId in the served item", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startVerificationItem(null, { mode: "module", moduleKey: "v1-oracle", probeId: null }, ctx);

    expect(served).not.toBeNull();
    for (const entry of served.item.bench) {
      expect(Object.keys(entry).sort()).toEqual(["checkId", "costSeconds", "label"]);
    }
    expect((served.item as any).failingElementId).toBeUndefined();
    expect((served.item as any).keyVerdict).toBeUndefined();
  });
});

describe("nameVerificationOracle — ordering lock", () => {
  it("rejects when a check was already selected", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startVerificationItem(null, { mode: "module", moduleKey: "v1-oracle", probeId: null }, ctx);

    await expect(
      mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c3_recompute" }, ctx)
    ).rejects.toThrow(/Name an oracle/);
  });

  it("rejects reveal-before-name even after a later oracle attempt", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await mutationResolvers.startVerificationItem(null, { mode: "module", moduleKey: "v1-oracle", probeId: null }, ctx);
    await mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "recompute" }, ctx);

    await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c3_recompute" }, ctx);

    await expect(
      mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "second try" }, ctx)
    ).rejects.toThrow(/already been run|already named/);
  });
});

describe("revealVerificationCheck", () => {
  it("rejects revealing the same check twice", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const served = await startAndName(ctx);

    await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c3_recompute" }, ctx);
    await expect(
      mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c3_recompute" }, ctx)
    ).rejects.toThrow(/already been revealed/);
  });

  it("enforces the assisted-rung ceiling", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "assisted" }, ctx);
    const served = await startAndName(ctx);
    expect(served.rung).toBe("assisted");
    expect(served.assistedCeilingSeconds).not.toBeNull();

    // c5_bill_compare costs 180s on this item — far past a ceiling derived from a 10s cheapest check.
    await expect(
      mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c5_bill_compare" }, ctx)
    ).rejects.toThrow(/ceiling/);
  });
});

describe("full unassisted-rung path — a faulty item, correctly caught", () => {
  it("completes: name oracle -> reveal -> commit -> localise -> scored", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "unassisted" }, ctx);
    // 3rd served item in this module is v1-oracle-pool-3 (SUM_MISMATCH) — see serveNth's docstring.
    const served = await serveNth(ctx, 3);
    expect(served.item.itemId).toBe("v1-oracle-pool-3");
    expect(served.rung).toBe("unassisted");

    await mutationResolvers.nameVerificationOracle(
      null,
      { attemptId: served.attemptId, text: "Add up the six monthly figures myself.", predictedCostSeconds: 15 },
      ctx
    );
    await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c3_add_it_up" }, ctx);

    const commit = await mutationResolvers.commitVerificationVerdict(
      null,
      {
        attemptId: served.attemptId,
        verdict: "unsupported",
        confidence: 90,
        residualRisk: "The October figure itself was never independently checked.",
        elementFreeText: "the stated total",
      },
      ctx
    );
    expect(commit.stage).toBe("awaitingLocalisation");
    expect(commit.elements.length).toBeGreaterThanOrEqual(4);
    expect(commit.elements.some((e: any) => e.decoy !== undefined)).toBe(false); // decoy flag never leaks

    const scored = await mutationResolvers.setVerificationLocalization(
      null,
      { attemptId: served.attemptId, elementId: "e1_total" },
      ctx
    );

    expect(scored.score.rung).toBe("unassisted");
    expect(scored.score.strict).toBe(true);
    expect(scored.score.criteria.find((c: any) => c.id === "V5")?.level).toBe(2);
    expect(scored.score.criteria.find((c: any) => c.id === "V3")?.level).toBe(2);
    expect(scored.reveal.failingElementLabel).toBeTruthy();
  });

  it("rejects a second commit", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "unassisted" }, ctx);
    const served = await serveNth(ctx, 3);
    expect(served.item.itemId).toBe("v1-oracle-pool-3");
    await mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "add it up" }, ctx);
    await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c3_add_it_up" }, ctx);
    await mutationResolvers.commitVerificationVerdict(
      null,
      { attemptId: served.attemptId, verdict: "unsupported", confidence: 80, residualRisk: "nothing else checked", elementFreeText: "total" },
      ctx
    );

    await expect(
      mutationResolvers.commitVerificationVerdict(
        null,
        { attemptId: served.attemptId, verdict: "unsupported", confidence: 80, residualRisk: "again", elementFreeText: "total" },
        ctx
      )
    ).rejects.toThrow(/already committed/);
  });
});

describe("the fixture that matters most — a correct verdict reached by ritual", () => {
  it("scores strict composite 0, V3 = 0, ritual state none-could-fail", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "unassisted" }, ctx);
    // 1st served item in this module is v1-oracle-pool-1 (CORRECT).
    const served = await serveNth(ctx, 1);
    expect(served.item.itemId).toBe("v1-oracle-pool-1");

    await mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "Ask the model if it's sure." }, ctx);
    // Both costumes: self-critique and stated confidence — neither discriminates.
    await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c1_self_critique" }, ctx);
    await mutationResolvers.revealVerificationCheck(null, { attemptId: served.attemptId, checkId: "c2_confidence" }, ctx);

    const commit = await mutationResolvers.commitVerificationVerdict(
      null,
      {
        attemptId: served.attemptId,
        verdict: "supported", // happens to be correct for this CORRECT item
        confidence: 90,
        residualRisk: "none, seems fine",
        elementFreeText: "n/a",
      },
      ctx
    );
    const scored = await mutationResolvers.setVerificationLocalization(
      null,
      { attemptId: served.attemptId, elementId: "e1_kwh_figure" }, // control item: nothing fails, so any element is a "decoy"
      ctx
    );

    expect(scored.score.strict).toBe(false);
    expect(scored.score.criteria.find((c: any) => c.id === "V3")?.level).toBe(0);
    expect(scored.score.ritualState).toBe("none-could-fail");
  });
});

describe("no-oracle control", () => {
  it("scores strict, V1=2 and V2=2 when the learner correctly says cannot_verify", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "unassisted" }, ctx);
    // 2nd served item in this module is v1-oracle-pool-2 (NO_ORACLE).
    const served = await serveNth(ctx, 2);
    expect(served.item.itemId).toBe("v1-oracle-pool-2");

    await mutationResolvers.nameVerificationOracle(
      null,
      { attemptId: served.attemptId, text: "Nothing here can settle a claim about next month's specific bill." },
      ctx
    );
    const commit = await mutationResolvers.commitVerificationVerdict(
      null,
      {
        attemptId: served.attemptId,
        verdict: "cannot_verify",
        confidence: 60,
        residualRisk: "The actual next-month reading remains unknown either way.",
        elementFreeText: "n/a",
      },
      ctx
    );
    const scored = await mutationResolvers.setVerificationLocalization(
      null,
      { attemptId: served.attemptId, elementId: "e1_likely_framing" },
      ctx
    );

    // Not "strict" — strict requires V3=2, and nothing on a NO_ORACLE item
    // ever discriminates by construction, so V3 is 0 here regardless of what
    // was run. That's fine: mastery tolerates 1 of 6 non-strict per window,
    // and a module's pool carries exactly one NO_ORACLE control.
    expect(commit.stage).toBe("awaitingLocalisation");
    expect(scored.score.strict).toBe(false);
    expect(scored.score.criteria.find((c: any) => c.id === "V1")?.level).toBe(2);
    expect(scored.score.criteria.find((c: any) => c.id === "V2")?.level).toBe(2);
    expect(scored.score.criteria.find((c: any) => c.id === "V6")?.level).toBe(2);
  });

  it("scores V4=2 (ideal is to spend nothing) when no check is run at all", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "unassisted" }, ctx);
    const served = await serveNth(ctx, 2);
    expect(served.item.itemId).toBe("v1-oracle-pool-2");

    await mutationResolvers.nameVerificationOracle(null, { attemptId: served.attemptId, text: "Nothing settles this." }, ctx);
    await mutationResolvers.commitVerificationVerdict(
      null,
      { attemptId: served.attemptId, verdict: "cannot_verify", confidence: 60, residualRisk: "unknown either way", elementFreeText: "n/a" },
      ctx
    );
    const scored = await mutationResolvers.setVerificationLocalization(
      null,
      { attemptId: served.attemptId, elementId: "e1_likely_framing" },
      ctx
    );

    expect(scored.score.criteria.find((c: any) => c.id === "V4")?.level).toBe(2);
    expect(scored.score.costSpent).toBe(0);
  });
});

describe("probes run unassisted regardless of module rung", () => {
  it("stamps rung unassisted on an assessment-mode item even after the module is set to assisted", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await mutationResolvers.setVerificationRung(null, { moduleKey: "v1-oracle", rung: "assisted" }, ctx);

    const probeStart = await mutationResolvers.startSkillProbe(null, { skillKey: "verification", timepoint: "baseline" }, ctx).catch((e: any) => e);
    // Content is key-unverified in this build, so a scored probe correctly refuses to start.
    expect(probeStart).toBeInstanceOf(Error);
    expect(String(probeStart.message)).toMatch(/verify the answer key|not ready/i);
  });
});
