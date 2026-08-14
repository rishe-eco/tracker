import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";
import { ITEM_SPEC_BY_ID } from "../content/skills/clarity/v1";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const serve = (ctx: any, moduleKey?: string) =>
  mutationResolvers.startClarityItem(null, { mode: "calibrated_practice", moduleKey }, ctx);

/** Walk an item to the point where it will accept a submission. */
async function readyToSubmit(ctx: any, moduleKey: string) {
  const served = await serve(ctx, moduleKey);
  if (!served) throw new Error(`no item for ${moduleKey}`);
  if (served.needsDiagnosis) {
    await mutationResolvers.lockClarityDiagnosis(
      null,
      { attemptId: served.attemptId, criteria: ["R1"] },
      ctx
    );
  }
  return served;
}

describe("startClarityItem", () => {
  it("serves an item without leaking anything that answers it", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx);
    expect(served).not.toBeNull();

    const payload = JSON.stringify(served);
    const spec = ITEM_SPEC_BY_ID.get(served!.item.itemId)!;
    expect(served!.item).not.toHaveProperty("seededFaults");
    expect(served!.item).not.toHaveProperty("requiredSlots");
    expect(served!.item).not.toHaveProperty("repairCheck");
    expect(payload).not.toContain(spec.keyNote);
    expect(payload).not.toContain("exemplarFix");
  });

  it("withholds elicitation items when no reader is configured", async () => {
    // An elicitation item cannot be completed without a live reader, so serving
    // one would dead-end at the reveal. Fewer items beats a broken one.
    const key = process.env.ANTHROPIC_API_KEY;
    const token = process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    try {
      const ctx = makeCtx(await createTestUser());
      for (let i = 0; i < 12; i++) {
        const served = await serve(ctx);
        if (!served) break;
        expect(served.item.type).not.toBe("elicitation");
      }
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });

  it("gives every module a servable offline item", async () => {
    // A fresh learner per module, so "already seen" can't hide a missing item.
    for (const moduleKey of ["c1-ask", "c2-deliverable", "c3-context", "c4-referents", "c5-done", "c6-economy"]) {
      const ctx = makeCtx(await createTestUser({ email: `${moduleKey}@example.com` }));
      const served = await serve(ctx, moduleKey);
      expect(served, `module ${moduleKey}`).not.toBeNull();
      expect(served!.item.moduleKey).toBe(moduleKey);
    }
  });

  it("never serves the same item to a learner twice", async () => {
    const ctx = makeCtx(await createTestUser());
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const served = await serve(ctx);
      if (!served) break;
      expect(seen.has(served.item.itemId)).toBe(false);
      seen.add(served.item.itemId);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("the diagnosis gate", () => {
  it("refuses to score a revision item before a diagnosis is committed", async () => {
    // The whole point of the diagnose step: tagging what failed *after* seeing
    // the levels is a recollection, not a diagnosis.
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "c1-ask");
    expect(served!.needsDiagnosis).toBe(true);

    await expect(
      mutationResolvers.submitClarityAttempt(
        null,
        { attemptId: served!.attemptId, text: "Pick a venue by Thursday; the deposit is due Friday." },
        ctx
      )
    ).rejects.toThrow(/Commit a diagnosis/);
  });

  it("scores once the diagnosis is locked, and reports it against what failed", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c1-ask");

    const result = await mutationResolvers.submitClarityAttempt(
      null,
      {
        attemptId: served.attemptId,
        text: "Pick between Riverside and the Old Mill by Thursday. The deposit is due Friday and the budget is 4000.",
      },
      ctx
    );

    expect(result.score.criteria).toHaveLength(6);
    expect(result.diagnosis).not.toBeNull();
    expect(result.reveal.length).toBeGreaterThan(0);
  });

  it("rejects a second diagnosis on the same attempt", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "c1-ask");
    const args = { attemptId: served!.attemptId, criteria: ["R1"] };
    await mutationResolvers.lockClarityDiagnosis(null, args, ctx);
    await expect(mutationResolvers.lockClarityDiagnosis(null, args, ctx)).rejects.toThrow(/already locked/);
  });

  it("has no diagnose step on a repair drill", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await serve(ctx, "c4-referents");
    expect(served!.needsDiagnosis).toBe(false);

    await expect(
      mutationResolvers.lockClarityDiagnosis(null, { attemptId: served!.attemptId, criteria: ["R4"] }, ctx)
    ).rejects.toThrow(/no diagnose step/);
  });
});

describe("scoring without a reader", () => {
  it("leaves judge-only criteria unscored rather than scoring them zero", async () => {
    // Averaging in a zero would tell a learner they failed at something nobody
    // assessed. Both numerator and denominator shrink instead.
    const key = process.env.ANTHROPIC_API_KEY;
    const token = process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    try {
      const ctx = makeCtx(await createTestUser());
      const served = await readyToSubmit(ctx, "c1-ask");
      const result = await mutationResolvers.submitClarityAttempt(
        null,
        { attemptId: served.attemptId, text: "Pick a venue by Thursday. The deposit is due Friday." },
        ctx
      );

      expect(result.score.unscored.sort()).toEqual(["R2", "R3", "R5"]);
      expect(result.score.scoredCount).toBe(3);
      expect(result.score.maxPossible).toBe(6);
      expect(result.score.isComplete).toBe(false);

      // Mastery must stay out of reach rather than being redefined down to
      // whatever happens to be measurable.
      expect(result.atCriterion).toBe(false);
      expect(result.masteryUnmet.length).toBeGreaterThan(0);
    } finally {
      if (key) process.env.ANTHROPIC_API_KEY = key;
      if (token) process.env.ANTHROPIC_AUTH_TOKEN = token;
    }
  });

  it("passes a repair drill whose fix clears the bar, and fails one that doesn't", async () => {
    const ctx = makeCtx(await createTestUser());
    const first = await serve(ctx, "c4-referents");
    const spec = ITEM_SPEC_BY_ID.get(first!.item.itemId)!;

    const good = await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: first!.attemptId, text: "Send me the signed lease when you've finished reading it." },
      ctx
    );
    expect(spec.repairCheck).toBeTruthy();
    expect(good.repairPassed).toBe(true);

    const second = await serve(ctx, "c4-referents");
    const bad = await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: second!.attemptId, text: "Send that over when you get a chance, a few of them are ready." },
      ctx
    );
    expect(bad.repairPassed).toBe(false);
  });

  it("treats an empty response as void rather than as a zero", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c1-ask");
    const result = await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "no" },
      ctx
    );
    expect(result.score.isVoid).toBe(true);
    expect(result.score.scoredCount).toBe(0);
  });
});

describe("the revision chain", () => {
  it("links a revision to its draft and reports the delta", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c6-economy");

    await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "I hope this makes sense. Just wondering if you had thoughts." },
      ctx
    );

    const revision = await mutationResolvers.startClarityRevision(
      null,
      { attemptId: served.attemptId },
      ctx
    );
    expect(revision.item.itemId).toBe(served.item.itemId);
    expect(revision.draftText).toContain("I hope this makes sense");
    // The diagnosis was committed on the draft; asking again would be busywork.
    expect(revision.needsDiagnosis).toBe(false);

    const result = await mutationResolvers.submitClarityAttempt(
      null,
      {
        attemptId: revision.attemptId,
        text: "The delivery didn't arrive on Tuesday as arranged — please redeliver by Friday 5pm or refund the order.",
      },
      ctx
    );
    expect(result.delta).not.toBeNull();
    expect(result.delta).toBeGreaterThan(0);
  });

  it("scores the rewrite of a diagnose-and-rewrite item", async () => {
    // The locks were satisfied on the draft and `startClarityRevision` stamps no
    // new ones, so gating the revision on them made step 5 of the five-step flow
    // unreachable for every item that has a diagnose step — which is all of them
    // except repair drills. The regression is silent: the UI just says "could
    // not score that", and retrying can never succeed.
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c1-ask");
    expect(served.needsDiagnosis).toBe(true);

    await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "I hope this makes sense, just wondering about the venue." },
      ctx
    );

    const revision = await mutationResolvers.startClarityRevision(
      null,
      { attemptId: served.attemptId },
      ctx
    );
    const result = await mutationResolvers.submitClarityAttempt(
      null,
      {
        attemptId: revision.attemptId,
        text: "Book Riverside for the 14th and send me the confirmation by Thursday 5pm.",
      },
      ctx
    );
    expect(result.score.criteria).toHaveLength(6);
    expect(result.delta).not.toBeNull();
  });

  it("refuses to revise an unscored draft, or to revise twice", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c6-economy");

    await expect(
      mutationResolvers.startClarityRevision(null, { attemptId: served.attemptId }, ctx)
    ).rejects.toThrow(/Score the draft/);

    await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "Redeliver the parcel by Friday 5pm or refund the order." },
      ctx
    );
    await mutationResolvers.startClarityRevision(null, { attemptId: served.attemptId }, ctx);
    await expect(
      mutationResolvers.startClarityRevision(null, { attemptId: served.attemptId }, ctx)
    ).rejects.toThrow(/already been revised/);
  });

  it("does not let a revision earn mastery", async () => {
    // A revision follows feedback that named exactly what failed, so counting it
    // would measure the feedback rather than the learner.
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c6-economy");
    await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "Redeliver the parcel by Friday 5pm or refund the order." },
      ctx
    );
    const revision = await mutationResolvers.startClarityRevision(
      null,
      { attemptId: served.attemptId },
      ctx
    );
    const result = await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: revision.attemptId, text: "Redeliver the parcel by Friday 5pm or refund the order." },
      ctx
    );
    expect(result.moduleState).not.toBe("mastered");
  });
});

describe("locale", () => {
  // The bug this guards: every session function read `SkillProfile.locale`, no
  // caller ever wrote anything but "en" to it, and there was no mutation that
  // could change it. A complete Persian pack shipped and could not be reached —
  // a Persian speaker got Persian chrome around English exercises, including
  // the English text they were asked to diagnose and rewrite.
  const isPersian = (s: string) => /[؀-ۿ]/.test(s);

  it("serves item and module text in the language the request arrived in", async () => {
    const user = await createTestUser();
    const fa = makeCtx(user, "fa");

    const modules = await queryResolvers.clarityModules(null, {}, fa);
    expect(modules).toHaveLength(6);
    for (const mod of modules) {
      expect(isPersian(mod.title), `module ${mod.moduleKey} title`).toBe(true);
      expect(isPersian(mod.concept), `module ${mod.moduleKey} concept`).toBe(true);
    }

    const served = await serve(fa, "c1-ask");
    expect(isPersian(served!.item.scenario)).toBe(true);
    expect(isPersian(served!.item.weakText ?? "")).toBe(true);
  });

  it("scores and reveals in that language too, not only the chrome", async () => {
    const fa = makeCtx(await createTestUser(), "fa");
    const served = await readyToSubmit(fa, "c1-ask");
    const result = await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "تا پنجشنبه یک سالن انتخاب کن و فهرست را برایم بفرست." },
      fa
    );
    expect(isPersian(result.reveal)).toBe(true);

    // The detectors tokenise through an [a-z] class, so Persian reduced to
    // nothing and R1 came back 0/2 "No identifiable request" — in English, on a
    // sentence that opens with an explicit imperative. Every criterion now
    // routes to the judge, and with no reader the honest report is that nothing
    // was assessed rather than that everything failed.
    const progress = await queryResolvers.clarityProgress(null, {}, fa);
    expect(progress.locale).toBe("fa");
    expect(progress.detectorCriteria).toEqual([]);

    expect(result.score.scoredCount).toBe(0);
    expect(result.score.criteria.every((c: any) => c.level === null)).toBe(true);

    // Nothing English may reach a Persian learner through a score. Detector
    // findings are composed in English in the service, so a detector that runs
    // where it should not shows up here.
    const findings = result.score.criteria.flatMap((c: any) => c.findings);
    expect(findings).toEqual([]);
  });

  it("keeps English English", async () => {
    const en = makeCtx(await createTestUser());
    const modules = await queryResolvers.clarityModules(null, {}, en);
    expect(modules.every((m: any) => !isPersian(m.title))).toBe(true);
  });
});

describe("clarity progress", () => {
  it("reports what this install can actually score", async () => {
    const ctx = makeCtx(await createTestUser());
    const progress = await queryResolvers.clarityProgress(null, {}, ctx);

    expect(progress.rubricVersion).toBe("clarity-rubric/v1");
    expect(progress.detectorCriteria).toEqual(["R1", "R4", "R6"]);
    // Nothing is calibrated, so no judge criterion may enter a probe total —
    // reported rather than scored around.
    expect(progress.anyCriterionCalibrated).toBe(false);
    expect(progress.totalAttempts).toBe(0);
  });

  it("returns six modules, each naming the criterion it trains", async () => {
    const ctx = makeCtx(await createTestUser());
    const modules = await queryResolvers.clarityModules(null, {}, ctx);
    expect(modules).toHaveLength(6);
    expect(modules.map((m: any) => m.criterion)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6"]);
  });

  it("tracks per-criterion means once attempts exist", async () => {
    const ctx = makeCtx(await createTestUser());
    const served = await readyToSubmit(ctx, "c1-ask");
    await mutationResolvers.submitClarityAttempt(
      null,
      { attemptId: served.attemptId, text: "Pick a venue by Thursday. The deposit is due Friday." },
      ctx
    );

    const progress = await queryResolvers.clarityProgress(null, {}, ctx);
    expect(progress.totalAttempts).toBe(1);
    const r1 = progress.criterionMeans.find((c: any) => c.criterion === "R1");
    expect(r1.count).toBe(1);
    const r3 = progress.criterionMeans.find((c: any) => c.criterion === "R3");
    expect(r3.count).toBe(0);
    expect(r3.mean).toBeNull();
  });
});
