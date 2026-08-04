/**
 * Feelings & Needs — the frame gate and the daily loop.
 *
 * Exercised through the resolvers, so the auth wrapper and the service are both
 * on the path. The guardrails this file protects are not UI polish: each one is
 * a mechanism requirement from the plan, and each is enforced server-side
 * precisely so it survives a client that forgets it.
 *
 * Two of these are regressions. The start-sitting race and the sitting count
 * including abandoned sittings were both found by clicking through the browser
 * after the types compiled cleanly — which is the argument for this file.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";
import { typeResolvers } from "../graphql/resolvers/typeResolvers";
import { DIALS } from "../content/feelings-needs/dials";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A user who has done the Day-1 frame, i.e. one the loop is open for. */
async function framedUser(email = "framed@example.com") {
  const ctx = makeCtx(await createTestUser({ email }));
  await mutationResolvers.completeFeelingsNeedsFrame(null, {}, ctx);
  return ctx;
}

const startSitting = (ctx: any) => mutationResolvers.startLoopSitting(null, {}, ctx);
const patch = (ctx: any, entryId: string, fields: Record<string, unknown>) =>
  mutationResolvers.updateLoopEntry(null, { entryId, ...fields }, ctx);
/** finishLoopSitting answers with { sitting, graduation }; most tests want the sitting. */
const finish = async (ctx: any, sittingId: string) =>
  (await mutationResolvers.finishLoopSitting(null, { sittingId }, ctx)).sitting;

describe("the Day-1 frame", () => {
  it("gates the loop until it has been done", async () => {
    // Sequence, not permission: running the loop first spends the person's
    // first reps on a practice whose point has not landed yet (plan §4.1).
    const ctx = makeCtx(await createTestUser());
    await expect(startSitting(ctx)).rejects.toThrow(/Day-1 frame/);
    expect(await prisma.loopSitting.count()).toBe(0);
  });

  it("opens the loop once completed", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    expect(sitting.entries).toHaveLength(1);
  });

  it("is idempotent — a double submit is a double-click, not a second frame", async () => {
    const ctx = makeCtx(await createTestUser());
    await mutationResolvers.completeFeelingsNeedsFrame(null, {}, ctx);
    const state = await mutationResolvers.completeFeelingsNeedsFrame(null, {}, ctx);
    expect(state.frameDone).toBe(true);
    expect(await prisma.frameCompletion.count()).toBe(1);
  });

  it("reports completion as derived state, not a stored mirror", async () => {
    const ctx = makeCtx(await createTestUser());
    expect((await queryResolvers.feelingsNeedsState(null, {}, ctx)).frameDone).toBe(false);
    await mutationResolvers.completeFeelingsNeedsFrame(null, {}, ctx);
    expect((await queryResolvers.feelingsNeedsState(null, {}, ctx)).frameDone).toBe(true);
  });
});

describe("a sitting", () => {
  it("commits each step on its own, so nothing is buffered to a final submit", async () => {
    // Convention #8. Partial state is valid state — that is what makes the
    // wizard resumable and what stops a closed tab losing the pass.
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;

    await patch(ctx, entryId, { bodyLocation: "chest", bodyTexture: "tight" });
    expect((await prisma.loopEntry.findUniqueOrThrow({ where: { id: entryId } })).bodyTexture).toBe(
      "tight"
    );

    await patch(ctx, entryId, { feelingWord: "uneasy", feelingSource: "palette" });
    const after = await prisma.loopEntry.findUniqueOrThrow({ where: { id: entryId } });
    // The earlier step survives the later one.
    expect(after.bodyTexture).toBe("tight");
    expect(after.feelingWord).toBe("uneasy");
  });

  it("records a typed word as the person's own, not a palette pick", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await patch(ctx, sitting.entries[0].id, { feelingWord: "  ignored  ", feelingSource: "own" });

    const entry = await prisma.loopEntry.findUniqueOrThrow({
      where: { id: sitting.entries[0].id },
    });
    expect(entry.feelingWord).toBe("ignored");
    expect(entry.feelingSource).toBe("own");
  });

  it("rejects a source that is neither palette nor own", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await expect(
      patch(ctx, sitting.entries[0].id, { feelingWord: "uneasy", feelingSource: "guessed" })
    ).rejects.toThrow(/palette/);
  });

  it("leaves a skipped need null rather than inventing one", async () => {
    // P4: offered, never forced.
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await patch(ctx, sitting.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
    const done = await finish(ctx, sitting.id);
    expect(done.entries[0].need).toBeNull();
  });

  it("resumes today's open sitting instead of opening a second one", async () => {
    const ctx = await framedUser();
    const first = await startSitting(ctx);
    const second = await startSitting(ctx);
    expect(second.id).toBe(first.id);
    expect(await prisma.loopSitting.count()).toBe(1);
  });

  it("survives concurrent opens — the race that left an empty sitting behind", async () => {
    // Regression. A double-invoked mount effect fired two opens; both found no
    // active sitting and both inserted. LoopSitting has no unique constraint to
    // arbitrate that, so the check and the create had to become atomic.
    const ctx = await framedUser();
    const results = await Promise.all(Array.from({ length: 5 }, () => startSitting(ctx)));

    expect(await prisma.loopSitting.count()).toBe(1);
    expect(new Set(results.map((r: any) => r.id)).size).toBe(1);
  });

  it("is no longer resumable once finished", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await mutationResolvers.finishLoopSitting(null, { sittingId: sitting.id }, ctx);
    expect(await queryResolvers.activeLoopSitting(null, {}, ctx)).toBeNull();
  });

  it("refuses writes after it is finished", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await mutationResolvers.finishLoopSitting(null, { sittingId: sitting.id }, ctx);

    await expect(patch(ctx, sitting.entries[0].id, { need: "rest" })).rejects.toThrow(/finished/);
    await expect(
      mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx)
    ).rejects.toThrow(/finished/);
  });

  it("records the breath without turning it into something to complete", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    expect(sitting.breathTaken).toBe(false);
    const after = await mutationResolvers.setLoopBreath(null, { sittingId: sitting.id }, ctx);
    expect(after.breathTaken).toBe(true);
  });
});

describe("the optional repeat", () => {
  it("adds a parallel pass that carries nothing over from the last one", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await patch(ctx, sitting.entries[0].id, {
      bodyLocation: "chest", bodyTexture: "tight",
      feelingWord: "uneasy",
      feelingSource: "palette",
      need: "space",
    });

    const two = await mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx);
    expect(two.entries).toHaveLength(2);
    expect(two.entries[1].passIndex).toBe(1);
    // Parallel, not related — the second pass starts blank.
    expect(two.entries[1].bodyLocation).toBeNull();
    expect(two.entries[1].bodyTexture).toBeNull();
    expect(two.entries[1].feelingWord).toBeNull();
  });

  it("refuses past the soft cap, so a sitting can't become an inventory", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    for (let i = 1; i < DIALS.repeat.softCap; i++) {
      await mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx);
    }
    await expect(
      mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx)
    ).rejects.toThrow();
    expect(await prisma.loopEntry.count()).toBe(DIALS.repeat.softCap);
  });

  it("drops a trailing pass the person opened and left blank", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await patch(ctx, sitting.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
    await mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx);

    const done = await finish(ctx, sitting.id);
    expect(done.entries).toHaveLength(1);
  });

  it("keeps a trailing pass that has anything in it", async () => {
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    const two = await mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx);
    await patch(ctx, two.entries[1].id, { bodyTexture: "warm" });

    const done = await finish(ctx, sitting.id);
    expect(done.entries).toHaveLength(2);
  });

  it("never exposes a link between two passes", async () => {
    // Relating them is storytelling (P6, tier 4) and is deferred. The recap is a
    // flat list by construction: if a field ever appears here pointing at
    // another pass, tier 4 has leaked into the demo.
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    await mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, ctx);
    const done = await finish(ctx, sitting.id);

    const fields = Object.keys(done.entries[0]);
    expect(fields.filter((f) => /relat|link|parent|prev|next/i.test(f))).toEqual([]);
  });
});

describe("counting", () => {
  it("counts only finished sittings, never abandoned ones", async () => {
    // Regression. An abandoned sitting used to count, which would broaden the
    // palette before the person had their early wins (P1) and would later read
    // as practice to the prompt-fade inference (P7).
    const ctx = await framedUser();
    const sitting = await startSitting(ctx);
    expect((await queryResolvers.feelingsNeedsState(null, {}, ctx)).sittingCount).toBe(0);

    await mutationResolvers.finishLoopSitting(null, { sittingId: sitting.id }, ctx);
    expect((await queryResolvers.feelingsNeedsState(null, {}, ctx)).sittingCount).toBe(1);
  });

  it("shows no streak-shaped state anywhere on the tool home", async () => {
    const ctx = await framedUser();
    const state = await queryResolvers.feelingsNeedsState(null, {}, ctx);
    expect(Object.keys(state).filter((k) => /streak|consecutive|day/i.test(k))).toEqual([]);
  });
});

describe("the palette the person is shown", () => {
  it("draws only from the early tier while the early-win window is open", async () => {
    // P1's precondition: the first loops have to land a word and produce a felt
    // win, so the palette is weighted pleasant/met-need first.
    const ctx = await framedUser();
    const content = await queryResolvers.feelingsNeedsContent(null, {}, ctx);
    const tierOf = new Map(content.feelings.map((f: any) => [f.id, f.tier]));

    expect(content.display.feelingIds).toHaveLength(DIALS.palette.feelingDisplayCount);
    expect(content.display.feelingIds.every((id: string) => tierOf.get(id) === "early")).toBe(true);
  });

  it("broadens once the early-win window has passed", async () => {
    const ctx = await framedUser();
    for (let i = 0; i < DIALS.palette.earlyWinLoops; i++) {
      const s = await startSitting(ctx);
      await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);
    }

    const content = await queryResolvers.feelingsNeedsContent(null, {}, ctx);
    const tierOf = new Map(content.feelings.map((f: any) => [f.id, f.tier]));
    const broadened = content.display.feelingIds.filter(
      (id: string) => tierOf.get(id) === "broaden"
    );
    expect(broadened.length).toBeGreaterThan(0);
  });

  it("always shows a way to answer where-it-sits without pinning a spot", async () => {
    // P2 failure mode (c): blankness is information, not failure. Taking the
    // first N locations quietly dropped this off the end of the list, leaving
    // the person who most needed an answer without one.
    const ctx = await framedUser();
    const content = await queryResolvers.feelingsNeedsContent(null, {}, ctx);
    expect(content.display.locationIds).toContain("hard_to_place");
    expect(content.display.locationIds).toHaveLength(DIALS.palette.locationDisplayCount);
  });

  it("keeps the screen small even though the pool is wide", async () => {
    const ctx = await framedUser();
    const content = await queryResolvers.feelingsNeedsContent(null, {}, ctx);
    expect(content.display.textureIds).toHaveLength(DIALS.palette.textureDisplayCount);
    expect(content.display.needIds).toHaveLength(DIALS.palette.needDisplayCount);
    // The full pool still ships, so a stored id can always be resolved to a label.
    expect(content.feelings.length).toBeGreaterThan(content.display.feelingIds.length);
  });
});

describe("the distinction catch", () => {
  /**
   * Give the user enough finished practice that a catch is allowed to fire.
   * Seeded directly: going through the resolvers would be a dozen sittings of
   * setup for a test about what happens on the thirteenth.
   */
  async function seedCompletedPasses(userId: string, count: number) {
    const sitting = await prisma.loopSitting.create({
      data: { userId, completedAt: new Date("2026-01-01T10:00:00Z") },
    });
    for (let i = 0; i < count; i++) {
      await prisma.loopEntry.create({
        data: {
          sittingId: sitting.id,
          passIndex: i,
          feelingWord: "calm",
          feelingSource: "palette",
          createdAt: new Date(Date.UTC(2026, 0, 1, 10, 0, i)),
        },
      });
    }
  }

  const nameFauxFeeling = async (ctx: any, word = "ignored") => {
    const sitting = await startSitting(ctx);
    return patch(ctx, sitting.entries[0].id, { feelingWord: word, feelingSource: "own" });
  };

  it("stays silent until the loop is established", async () => {
    // B is a refinement on top of A, never the opening move. Catching a
    // faux-feeling in week one refines something the person has not started
    // doing, and reads as correction.
    const ctx = await framedUser();
    const result = await nameFauxFeeling(ctx);
    expect(result.catch).toBeNull();
    expect(result.sitting.entries[0].distinctionCaught).toBe(false);
  });

  it("fires once the loop is established", async () => {
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const result = await nameFauxFeeling(ctx);
    expect(result.catch).not.toBeNull();
    expect(result.catch.conceptId).toBe("ignored");
    expect(result.catch.line).toContain("ignored");
    expect(result.sitting.entries[0].distinctionCaught).toBe(true);
  });

  it("never fires on a palette word", async () => {
    // The palette holds real feelings by construction, so this should be
    // impossible — which is exactly why it is worth pinning.
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const sitting = await startSitting(ctx);
    const result = await patch(ctx, sitting.entries[0].id, {
      feelingWord: "uneasy",
      feelingSource: "palette",
    });
    expect(result.catch).toBeNull();
  });

  it("does not fire twice on the same pass", async () => {
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;
    const first = await patch(ctx, entryId, { feelingWord: "ignored", feelingSource: "own" });
    expect(first.catch).not.toBeNull();

    // Re-committing the same step — a back-and-forward in the wizard — must not
    // re-present the card.
    const again = await patch(ctx, entryId, { feelingWord: "ignored", feelingSource: "own" });
    expect(again.catch).toBeNull();
  });

  it("does not re-fire on the word the catch itself offered", async () => {
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;
    await patch(ctx, entryId, { feelingWord: "ignored", feelingSource: "own" });

    const taken = await patch(ctx, entryId, { feelingWord: "hurt", feelingSource: "catch" });
    expect(taken.catch).toBeNull();
    expect(taken.sitting.entries[0].feelingWord).toBe("hurt");
    // The source is what makes the catch's effect visible later — P5's
    // observable signal is that the person catches *some of their own*.
    expect(taken.sitting.entries[0].feelingSource).toBe("catch");
  });

  it("spaces the touches out instead of firing on every instance", async () => {
    // Someone who habitually reaches for "ignored" would otherwise meet the
    // same card daily, which is the drill this is defined against.
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const first = await nameFauxFeeling(ctx);
    expect(first.catch).not.toBeNull();
    await mutationResolvers.finishLoopSitting(null, { sittingId: first.sitting.id }, ctx);

    // The very next pass is inside the cooldown.
    const second = await nameFauxFeeling(ctx);
    expect(second.catch).toBeNull();
  });

  it("comes back once enough passes have gone by", async () => {
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const first = await nameFauxFeeling(ctx);
    expect(first.catch).not.toBeNull();
    await mutationResolvers.finishLoopSitting(null, { sittingId: first.sitting.id }, ctx);

    // Serve out the cooldown.
    for (let i = 0; i < DIALS.distinctions.catchCooldownPasses; i++) {
      const s = await startSitting(ctx);
      await patch(ctx, s.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
      await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);
    }

    const later = await nameFauxFeeling(ctx);
    expect(later.catch).not.toBeNull();
  });

  it("never blocks the loop — a caught pass still finishes normally", async () => {
    const ctx = await framedUser();
    await seedCompletedPasses(ctx.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    const caught = await nameFauxFeeling(ctx);
    expect(caught.catch).not.toBeNull();

    // Declining the catch keeps the person's own word and carries on.
    const done = await finish(ctx, caught.sitting.id);
    expect(done.completedAt).not.toBeNull();
    expect(done.entries[0].feelingWord).toBe("ignored");
    expect(done.entries[0].feelingSource).toBe("own");
  });

  it("keeps one user's catch history out of another's cooldown", async () => {
    const a = await framedUser("a@example.com");
    const b = await framedUser("b@example.com");
    await seedCompletedPasses(a.user.id, DIALS.distinctions.minLoopsBeforeCatch);
    await seedCompletedPasses(b.user.id, DIALS.distinctions.minLoopsBeforeCatch);

    expect((await nameFauxFeeling(a)).catch).not.toBeNull();
    // B is not inside A's cooldown.
    expect((await nameFauxFeeling(b)).catch).not.toBeNull();
  });
});

describe("self-initiation (P7)", () => {
  /** Complete `n` sittings the ordinary way, through the resolvers. */
  async function completeSittings(ctx: any, n: number) {
    for (let i = 0; i < n; i++) {
      const s = await startSitting(ctx);
      await patch(ctx, s.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
      await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);
    }
  }

  const loopCopy = async (ctx: any) =>
    (await queryResolvers.feelingsNeedsContent(null, {}, ctx)).loop;

  it("starts with the scaffold fully in place", async () => {
    const ctx = await framedUser();
    const loop = await loopCopy(ctx);
    expect(loop.placeHelper).toBeTruthy();
    expect(loop.placePrompt).toBe("Where is it sitting?");
  });

  it("withdraws the helper lines at the first fade step", async () => {
    // Withdrawing the scaffolding is the intervention. Nothing announces it —
    // the app just stops explaining.
    const ctx = await framedUser();
    await completeSittings(ctx, DIALS.graduation.sittingsPerFadeStep);

    const loop = await loopCopy(ctx);
    expect(loop.placeHelper).toBeNull();
    // The prompt itself is still the full one at this step.
    expect(loop.placePrompt).toBe("Where is it sitting?");
  });

  it("switches to the terse prompts at the second step", async () => {
    const ctx = await framedUser();
    await completeSittings(ctx, DIALS.graduation.sittingsPerFadeStep * 2);

    const loop = await loopCopy(ctx);
    expect(loop.placePrompt).toBe("where?");
    expect(loop.texturePrompt).toBe("what texture?");
    expect(loop.namePrompt).toBe("a word for it?");
    // The need keeps its conditional even when terse — the "if" is the
    // guardrail (offered, never forced), not scaffolding to withdraw.
    expect(loop.needPrompt).toContain("if");
  });

  it("stops fading at the cap instead of climbing forever", async () => {
    // A level that kept rising would be a score in everything but name.
    const ctx = await framedUser();
    await completeSittings(ctx, DIALS.graduation.sittingsPerFadeStep * 8);

    const state = await queryResolvers.feelingsNeedsState(null, {}, ctx);
    expect(state.promptFadeLevel).toBe(DIALS.graduation.graduationFadeLevel);
  });

  it("opens the door when the fade reaches the dial", async () => {
    const ctx = await framedUser();
    const upToLast =
      DIALS.graduation.sittingsPerFadeStep * DIALS.graduation.graduationFadeLevel - 1;
    await completeSittings(ctx, upToLast);

    // Not yet.
    const s = await startSitting(ctx);
    await patch(ctx, s.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
    const earning = await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);

    // The moment lands on the run that earned it, not the one after.
    expect(earning.graduation).not.toBeNull();
    expect(earning.graduation.line).toBeTruthy();
  });

  it("stays shut before then", async () => {
    const ctx = await framedUser();
    await completeSittings(ctx, DIALS.graduation.sittingsPerFadeStep);

    const s = await startSitting(ctx);
    const result = await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);
    expect(result.graduation).toBeNull();
  });

  it("is offered once and only once", async () => {
    // A door you have walked through cannot be walked through again — which is
    // also what sidesteps the streak-cliff a counter would have created.
    const ctx = await framedUser();
    await completeSittings(
      ctx,
      DIALS.graduation.sittingsPerFadeStep * DIALS.graduation.graduationFadeLevel
    );

    const first = await startSitting(ctx);
    const opened = await mutationResolvers.finishLoopSitting(null, { sittingId: first.id }, ctx);
    expect(opened.graduation).not.toBeNull();

    await mutationResolvers.acknowledgeGraduation(null, {}, ctx);

    const second = await startSitting(ctx);
    const again = await mutationResolvers.finishLoopSitting(null, { sittingId: second.id }, ctx);
    expect(again.graduation).toBeNull();
  });

  it("keeps offering it until it is acknowledged", async () => {
    // Closing the tab mid-moment must not silently spend the only time it is
    // ever shown.
    const ctx = await framedUser();
    await completeSittings(
      ctx,
      DIALS.graduation.sittingsPerFadeStep * DIALS.graduation.graduationFadeLevel
    );

    const first = await startSitting(ctx);
    expect(
      (await mutationResolvers.finishLoopSitting(null, { sittingId: first.id }, ctx)).graduation
    ).not.toBeNull();

    // No acknowledgement — the next sitting still finds the door open.
    const second = await startSitting(ctx);
    expect(
      (await mutationResolvers.finishLoopSitting(null, { sittingId: second.id }, ctx)).graduation
    ).not.toBeNull();
  });

  it("acknowledging twice is harmless", async () => {
    const ctx = await framedUser();
    await mutationResolvers.acknowledgeGraduation(null, {}, ctx);
    await expect(mutationResolvers.acknowledgeGraduation(null, {}, ctx)).resolves.toBe(true);
  });

  it("never sends a count or a streak to the client", async () => {
    // The whole P7 resolution in one assertion: the app may know how much
    // practice has happened, but nothing shaped like a score reaches the person.
    const ctx = await framedUser();
    await completeSittings(ctx, DIALS.graduation.sittingsPerFadeStep * 2);

    const content = await queryResolvers.feelingsNeedsContent(null, {}, ctx);
    const serialized = JSON.stringify(content);
    expect(serialized).not.toMatch(/streak/i);
    // The served content carries copy and palettes — no progress numbers at all.
    expect(content).not.toHaveProperty("sittingCount");
    expect(content).not.toHaveProperty("promptFadeLevel");
  });
});

describe("the entry record", () => {
  const history = (ctx: any, limit?: number) =>
    queryResolvers.loopHistory(null, { limit }, ctx);

  it("is empty before anything is finished", async () => {
    const ctx = await framedUser();
    await startSitting(ctx);
    expect(await history(ctx)).toEqual([]);
  });

  it("shows finished sittings, newest first", async () => {
    const ctx = await framedUser();
    for (const word of ["calm", "uneasy", "glad"]) {
      const s = await startSitting(ctx);
      await patch(ctx, s.entries[0].id, { feelingWord: word, feelingSource: "palette" });
      await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);
    }

    const rows = await history(ctx);
    expect(rows).toHaveLength(3);
    expect(rows[0].entries[0].feelingWord).toBe("glad");
    const times = rows.map((r: any) => new Date(r.completedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("never shows an abandoned sitting back as an entry", async () => {
    const ctx = await framedUser();
    const done = await startSitting(ctx);
    await patch(ctx, done.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
    await mutationResolvers.finishLoopSitting(null, { sittingId: done.id }, ctx);
    await startSitting(ctx); // left open

    expect(await history(ctx)).toHaveLength(1);
  });

  it("carries every field the person actually filled in", async () => {
    const ctx = await framedUser();
    const s = await startSitting(ctx);
    await patch(ctx, s.entries[0].id, {
      bodyLocation: "chest",
      bodyTexture: "tight",
      feelingWord: "uneasy",
      feelingSource: "palette",
      need: "space",
      needSource: "palette",
      smallAction: "ask for ten minutes",
    });
    await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);

    const [row] = await history(ctx);
    expect(row.entries[0]).toMatchObject({
      bodyLocation: "chest",
      bodyTexture: "tight",
      feelingWord: "uneasy",
      need: "space",
      smallAction: "ask for ten minutes",
    });
  });

  it("returns a record and computes nothing about it", async () => {
    // The line this feature stays on the near side of. Plan §2 puts
    // pattern-recognition across entries out of scope, and "no streaks" rules
    // out totals — so history is allowed to be the person's own material and
    // nothing else. Any aggregate appearing here is a scoreboard arriving by
    // the back door.
    const ctx = await framedUser();
    const s = await startSitting(ctx);
    await patch(ctx, s.entries[0].id, { feelingWord: "calm", feelingSource: "palette" });
    await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);

    const rows = await history(ctx);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toMatch(/streak|total|count|average|trend|pattern/i);
    // Only sitting/entry shape — nothing derived hitched onto the rows.
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["breathTaken", "completedAt", "createdAt", "entries", "id", "userId", "wasPrompted"].sort()
    );
  });

  it("dates a sitting with something the client can actually parse", async () => {
    // A Prisma Date on a GraphQL String field serializes as epoch milliseconds,
    // and `new Date("1785738600000")` is an Invalid Date. Everything type-checked
    // and the history view still rendered a column of "Invalid Date".
    const ctx = await framedUser();
    const s = await startSitting(ctx);
    await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, ctx);

    const [row] = await history(ctx);
    const resolved = typeResolvers.FnLoopSitting.completedAt(row);
    expect(resolved).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(new Date(resolved as string).getTime())).toBe(false);
    expect(typeResolvers.FnLoopSitting.completedAt({ completedAt: null })).toBeNull();
  });

  it("caps how much it returns, and clamps a silly limit", async () => {
    const ctx = await framedUser();
    expect(await history(ctx, 0)).toEqual([]);
    expect(await history(ctx, 99999)).toEqual([]);
  });

  it("shows one person nothing of another's", async () => {
    const a = await framedUser("a@example.com");
    const b = await framedUser("b@example.com");
    const s = await startSitting(a);
    await mutationResolvers.finishLoopSitting(null, { sittingId: s.id }, a);

    expect(await history(a)).toHaveLength(1);
    expect(await history(b)).toEqual([]);
  });
});

describe("ownership", () => {
  it("hides another user's sitting behind the same Not found as a missing one", async () => {
    const owner = await framedUser("owner@example.com");
    const other = await framedUser("other@example.com");
    const sitting = await startSitting(owner);

    for (const attempt of [
      () => mutationResolvers.setLoopBreath(null, { sittingId: sitting.id }, other),
      () => mutationResolvers.addLoopPass(null, { sittingId: sitting.id }, other),
      () => mutationResolvers.finishLoopSitting(null, { sittingId: sitting.id }, other),
      () => patch(other, sitting.entries[0].id, { need: "rest" }),
    ]) {
      await expect(attempt()).rejects.toThrow("Not found");
    }
  });

  it("does not leak another user's open sitting into activeLoopSitting", async () => {
    const owner = await framedUser("owner@example.com");
    const other = await framedUser("other@example.com");
    await startSitting(owner);
    expect(await queryResolvers.activeLoopSitting(null, {}, other)).toBeNull();
  });

  it("keeps one user's frame from opening another's loop", async () => {
    await framedUser("owner@example.com");
    const stranger = makeCtx(await createTestUser({ email: "stranger@example.com" }));
    await expect(startSitting(stranger)).rejects.toThrow(/Day-1 frame/);
  });
});

describe("the locale the request arrived in", () => {
  /**
   * The Persian path, end to end through the resolvers.
   *
   * These are here rather than in a unit test because the interesting part is
   * the *wiring*: the locale is not stored anywhere, so every one of these
   * resolvers has to carry it from the context down to the pack, and any one of
   * them forgetting would produce English content in a Persian session — which
   * is precisely the failure the pack's split was built to prevent, and one that
   * no English test run can see.
   */
  const faCtx = async (email = "fa@example.com") => {
    const ctx = makeCtx(await createTestUser({ email }), "fa");
    await mutationResolvers.completeFeelingsNeedsFrame(null, {}, ctx);
    return ctx;
  };

  it("serves the content pack in Persian", async () => {
    const ctx = await faCtx();
    const content = await queryResolvers.feelingsNeedsContent(null, {}, ctx);

    expect(content.locale).toBe("fa");
    expect(content.locations.find((l: any) => l.id === "chest").label).toBe("سینه");
    expect(content.loop.placePrompt).toBe("کجا نشسته؟");
    expect(content.frame.payoff.line).toBeTruthy();
  });

  it("serves English to an English request against the same data", async () => {
    // Same user, two languages, no migration and nothing to switch: the locale
    // is a property of the request, not of the account.
    const ctx = await faCtx();
    const fa = await queryResolvers.feelingsNeedsContent(null, {}, ctx);
    const en = await queryResolvers.feelingsNeedsContent(null, {}, { ...ctx, locale: "en" });

    expect(fa.loop.placePrompt).not.toBe(en.loop.placePrompt);
    expect(en.locations.find((l: any) => l.id === "chest").label).toBe("chest");
  });

  it("reports the locale and its review status on the tool-home state", async () => {
    // The client shows a banner off the back of both. A draft locale is a known
    // state, surfaced rather than hidden.
    const ctx = await faCtx();
    const state = await queryResolvers.feelingsNeedsState(null, {}, ctx);
    expect(state.locale).toBe("fa");
    expect(state.reviewStatus).toBe("draft");
  });

  it("fires the catch on a Persian faux-feeling", async () => {
    // The one that could not have worked before this: the matcher bounded
    // triggers with \b, which is ASCII-only, so no Persian trigger could match
    // and the catch would simply never fire in Persian.
    const ctx = await faCtx();
    const sitting = await mutationResolvers.startLoopSitting(null, {}, ctx);
    await prisma.loopSitting.update({
      where: { id: sitting.id },
      data: { completedAt: new Date() },
    });
    for (let i = 0; i < DIALS.distinctions.minLoopsBeforeCatch; i++) {
      await prisma.loopEntry.create({
        data: { sittingId: sitting.id, passIndex: i + 1, feelingWord: "آرام" },
      });
    }

    const fresh = await mutationResolvers.startLoopSitting(null, {}, ctx);
    const result = await mutationResolvers.updateLoopEntry(
      null,
      { entryId: fresh.entries[0].id, feelingWord: "نادیده گرفته شدم", feelingSource: "own" },
      ctx
    );

    expect(result.catch).not.toBeNull();
    expect(result.catch.line).toContain("نادیده گرفته شدن");
    expect(result.catch.dismiss.trim()).not.toBe("");
    // Every hint a question, in Persian too — «؟» is U+061F.
    expect(result.catch.feelingHints.every((h: string) => h.endsWith("؟"))).toBe(true);
  });

  it("keeps what the person typed exactly as they typed it", async () => {
    // Normalisation is for matching only. The stored word is the person's own —
    // folding it would quietly rewrite their vocabulary, which is the one thing
    // a tool about naming your own states must not do.
    const ctx = await faCtx();
    const sitting = await mutationResolvers.startLoopSitting(null, {}, ctx);
    const typed = "بی‌احترامی";
    await mutationResolvers.updateLoopEntry(
      null,
      { entryId: sitting.entries[0].id, feelingWord: typed, feelingSource: "own" },
      ctx
    );

    const stored = await prisma.loopEntry.findUniqueOrThrow({
      where: { id: sitting.entries[0].id },
    });
    expect(stored.feelingWord).toBe(typed);
  });
});

describe("a Persian-only faux-feeling, end to end", () => {
  /**
   * The path a `fa`-scoped concept takes through the resolvers.
   *
   * Worth an integration test rather than only a unit one because the locale
   * scoping crosses three layers: the spec declares which locales claim the
   * concept, the pack builder refuses to realize it in a locale that does not,
   * and the request's `Accept-Language` decides which pack the catch is composed
   * from. A unit test on the matcher would pass with any of those wired wrong.
   */
  it("fires for a Persian request and does not exist for an English one", async () => {
    const ctx = makeCtx(await createTestUser({ email: "menat@example.com" }), "fa");
    await mutationResolvers.completeFeelingsNeedsFrame(null, {}, ctx);

    // Enough finished practice that a catch is allowed (P5 is a refinement, never
    // the opening move).
    const seed = await mutationResolvers.startLoopSitting(null, {}, ctx);
    await prisma.loopSitting.update({
      where: { id: seed.id },
      data: { completedAt: new Date() },
    });
    for (let i = 0; i < DIALS.distinctions.minLoopsBeforeCatch; i++) {
      await prisma.loopEntry.create({
        data: { sittingId: seed.id, passIndex: i + 1, feelingWord: "آرام" },
      });
    }

    const sitting = await mutationResolvers.startLoopSitting(null, {}, ctx);
    const result = await mutationResolvers.updateLoopEntry(
      null,
      { entryId: sitting.entries[0].id, feelingWord: "منت گذاشت", feelingSource: "own" },
      ctx
    );

    // «منت گذاشتن» — a kindness weighed back at you. The family is `pressured`,
    // so what it opens onto is wanting the generosity to have been free.
    expect(result.catch).not.toBeNull();
    expect(result.catch.line).toContain("منت");
    expect(result.catch.needHints.some((h: string) => h.includes("اختیار"))).toBe(true);

    // The same words in an English session catch nothing — there is no English
    // detector for a judgment English has no word for.
    const enCtx = { ...ctx, locale: "en" as const };
    const enSitting = await mutationResolvers.startLoopSitting(null, {}, enCtx);
    const enResult = await mutationResolvers.updateLoopEntry(
      null,
      { entryId: enSitting.entries[0].id, feelingWord: "منت گذاشت", feelingSource: "own" },
      enCtx
    );
    expect(enResult.catch).toBeNull();
  });
});
