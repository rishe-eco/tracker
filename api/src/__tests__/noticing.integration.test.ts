/**
 * Noticing — the loop, end to end (build plan §9.5, the parts that exist by
 * phase 3).
 *
 * Exercised through the resolvers, so the auth wrapper and the service are
 * both on the path — same reasoning as `feelingsNeeds.integration.test.ts`.
 * `getHistory` has no GraphQL query yet (phase 6b's log page is what needs
 * one), so that piece is exercised directly against the service.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { queryResolvers } from "../graphql/resolvers/query";
import { getHistory } from "../services/noticing/session";
import { DIALS } from "../content/noticing/dials";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const startSitting = (ctx: any) => mutationResolvers.startNoticingSitting(null, {}, ctx);
const patch = (ctx: any, entryId: string, fields: Record<string, unknown>) =>
  mutationResolvers.updateNoticingEntry(null, { entryId, ...fields }, ctx);
const finish = async (ctx: any, sittingId: string) =>
  (await mutationResolvers.finishNoticingSitting(null, { sittingId }, ctx)).sitting;

const setCapacity = (ctx: any, entryId: string, capacityTags: string) =>
  mutationResolvers.setNoticingCapacity(null, { entryId, capacityTags }, ctx);
const setMotive = (ctx: any, entryId: string, motiveNote: string) =>
  mutationResolvers.setNoticingMotive(null, { entryId, motiveNote }, ctx);

const patchFrame = (ctx: any, fields: Record<string, unknown>) =>
  mutationResolvers.updateNoticingFrame(null, fields, ctx);
const completeFrame = (ctx: any) => mutationResolvers.completeNoticingFrame(null, {}, ctx);

describe("a sitting", () => {
  it("opens for a brand-new user with no frame done at all — deliberately, unlike Feelings & Needs", async () => {
    // The frame is a rehearsal of the loop's own inference, not a
    // precondition for it (spec §4.1, build plan §5 ordering notes). No
    // frame-completion call anywhere in this test, and it still opens.
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    expect(sitting.entries).toHaveLength(1);
    expect(await prisma.noticingFrame.count()).toBe(0);
  });

  it("commits each step on its own, so nothing is buffered to a final submit", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;

    await patch(ctx, entryId, { place: "home" });
    const midway = await prisma.noticingEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(midway.place).toBe("home");
    expect(midway.person).toBeNull();

    await patch(ctx, entryId, { person: "my neighbour" });
    await patch(ctx, entryId, { observation: "kept checking the mailbox" });
    const result = await patch(ctx, entryId, { need: "to_know_whats_going_on" });
    expect(result.sitting.entries[0].need).toBe("to_know_whats_going_on");
    // The result is already shaped for phase 5's catch field, always null now.
    expect(result.catch).toBeNull();
  });

  it("runs the loop end to end and closes with a one-line recap", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;

    await patch(ctx, entryId, { place: "work" });
    await patch(ctx, entryId, { person: "the new hire" });
    await patch(ctx, entryId, { observation: "ate lunch alone again" });
    await patch(ctx, entryId, { need: "connection" });
    await patch(ctx, entryId, { smallThing: "asked them to join us tomorrow" });

    const done = await finish(ctx, sitting.id);
    expect(done.completedAt).not.toBeNull();
    expect(done.entries[0].observation).toBe("ate lunch alone again");
    expect(done.entries[0].need).toBe("connection");
  });

  it("records a pass ending at 'not sure' as complete, not abandoned", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;

    await patch(ctx, entryId, { place: "commute" });
    await patch(ctx, entryId, { person: "the driver" });
    await patch(ctx, entryId, { observation: "sighed at every stop" });
    // Explicit null, not omission — this is how "not sure" is recorded
    // (spec §4.2: null is a complete pass, not a missing answer).
    await patch(ctx, entryId, { need: null });

    const done = await finish(ctx, sitting.id);
    expect(done.completedAt).not.toBeNull();
    expect(done.entries).toHaveLength(1);
    expect(done.entries[0].need).toBeNull();
    expect(done.entries[0].observation).toBe("sighed at every stop");
  });

  it("resumes today's open sitting instead of starting a second one", async () => {
    const ctx = makeCtx(await createTestUser());
    const first = await startSitting(ctx);
    const second = await startSitting(ctx);
    expect(second.id).toBe(first.id);
    expect(await prisma.noticingSitting.count()).toBe(1);
  });

  it("drops a trailing pass left completely blank on finish", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;
    await patch(ctx, entryId, { place: "home", person: "my sister", observation: "went quiet" });

    await mutationResolvers.addNoticingPass(null, { sittingId: sitting.id }, ctx);
    // The second pass is opened and then abandoned blank.
    const done = await finish(ctx, sitting.id);
    expect(done.entries).toHaveLength(1);
  });
});

describe("the repeat soft cap", () => {
  it("refuses another pass once the cap is reached", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    let current = sitting;
    // Already at 1 entry; add up to the cap.
    for (let i = current.entries.length; i < DIALS.repeat.softCap; i++) {
      current = await mutationResolvers.addNoticingPass(null, { sittingId: sitting.id }, ctx);
    }
    expect(current.entries).toHaveLength(DIALS.repeat.softCap);
    await expect(
      mutationResolvers.addNoticingPass(null, { sittingId: sitting.id }, ctx)
    ).rejects.toThrow(/plenty/);
    expect(await prisma.noticingEntry.count()).toBe(DIALS.repeat.softCap);
  });
});

describe("history", () => {
  it("returns only completed sittings, newest first, and computes nothing extra", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const s1 = await startSitting(ctx);
    await patch(ctx, s1.entries[0].id, { place: "home", person: "a", observation: "one" });
    await finish(ctx, s1.id);

    // A second, later sitting — advance the clock isn't available, but a
    // fresh sitting on the same day still only opens once the first is
    // closed, so this is naturally the later row.
    const s2 = await startSitting(ctx);
    await patch(ctx, s2.entries[0].id, { place: "work", person: "b", observation: "two" });
    await finish(ctx, s2.id);

    // An abandoned third sitting — opened, never finished.
    const s3 = await startSitting(ctx);
    await patch(ctx, s3.entries[0].id, { place: "commute", person: "c", observation: "three" });
    // Deliberately not finished.
    void s3;

    const history = await getHistory(prisma, user.id);
    expect(history).toHaveLength(2);
    // Newest first.
    expect(history[0].id).toBe(s2.id);
    expect(history[1].id).toBe(s1.id);
    expect(history.every((s) => s.completedAt !== null)).toBe(true);
  });

  it("does not count an abandoned sitting toward completed reps", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const s1 = await startSitting(ctx);
    await patch(ctx, s1.entries[0].id, { place: "home", person: "a", observation: "one" });
    await finish(ctx, s1.id);

    // Opened and abandoned — should not inflate the completed count that
    // feeds the fade level (build plan §6 delta 2).
    await startSitting(ctx);

    const state = await queryResolvers.noticingState(null, {}, ctx);
    // One completed sitting is nowhere near a fade step (DIALS.graduation
    // .sittingsPerFadeStep), so this is really asserting the abandoned
    // sitting didn't silently push the count to 2.
    const completed = await prisma.noticingSitting.count({ where: { completedAt: { not: null } } });
    expect(completed).toBe(1);
    expect(state.promptFadeLevel).toBe(0);
  });

  it("is reachable through the resolver too (phase 6b's noticingHistory query), same result as the service", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const s1 = await startSitting(ctx);
    await patch(ctx, s1.entries[0].id, { place: "home", person: "a", observation: "one", need: "rest" });
    await finish(ctx, s1.id);

    const viaResolver = await queryResolvers.noticingHistory(null, {}, ctx);
    expect(viaResolver).toHaveLength(1);
    expect(viaResolver[0].id).toBe(s1.id);
    expect(viaResolver[0].entries[0].observation).toBe("one");
    // The resolver honours a limit, same as the service it wraps.
    const limited = await queryResolvers.noticingHistory(null, { limit: 0 }, ctx);
    expect(limited.length).toBeGreaterThan(0); // getHistory clamps a non-positive limit up to 1, not down to 0
  });
});

describe("the day-one frame (build plan §5 phase 4)", () => {
  it("commits each beat-1 step on its own, and is not frameDone until completeNoticingFrame", async () => {
    const ctx = makeCtx(await createTestUser());

    await patchFrame(ctx, { moment: "my neighbour shoveled my walk without asking" });
    let state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.frameDone).toBe(false);

    await patchFrame(ctx, { unsaidNeed: "support" });
    await patchFrame(ctx, { visibleCues: JSON.stringify({ chips: ["stayed_late"], other: null }) });
    // Still not done — beat 2 hasn't run, and completeNoticingFrame hasn't
    // been called. A frame filled all the way to the last field but never
    // explicitly completed is exactly the phase-1 bug (row existence read as
    // done) that isFrameDone was fixed to avoid in phase 2.
    state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.frameDone).toBe(false);

    await patchFrame(ctx, { welcomeGuess: "somewhat" });
    state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.frameDone).toBe(false);

    const completed = await completeFrame(ctx);
    expect(completed.frameDone).toBe(true);

    const row = await prisma.noticingFrame.findUniqueOrThrow({ where: { userId: ctx.user.id } });
    expect(row.completedAt).not.toBeNull();
    expect(row.moment).toBe("my neighbour shoveled my walk without asking");
    expect(row.unsaidNeed).toBe("support");
    expect(row.welcomeGuess).toBe("somewhat");
  });

  it("completes once and stays idempotent on a second call", async () => {
    const ctx = makeCtx(await createTestUser());
    await patchFrame(ctx, { moment: "a", unsaidNeed: "rest", visibleCues: "{}", welcomeGuess: "very" });

    const first = await completeFrame(ctx);
    expect(first.frameDone).toBe(true);
    const rowAfterFirst = await prisma.noticingFrame.findUniqueOrThrow({ where: { userId: ctx.user.id } });

    // A double submit is a double-click, not a second frame — the second
    // call must not throw, and must not disagree with the first about when
    // the frame finished.
    const second = await completeFrame(ctx);
    expect(second.frameDone).toBe(true);
    const rowAfterSecond = await prisma.noticingFrame.findUniqueOrThrow({ where: { userId: ctx.user.id } });
    expect(rowAfterSecond.completedAt?.getTime()).toBe(rowAfterFirst.completedAt?.getTime());

    expect(await prisma.noticingFrame.count()).toBe(1);
  });

  it("refuses to reopen a frame that's already complete", async () => {
    const ctx = makeCtx(await createTestUser());
    await patchFrame(ctx, { moment: "a" });
    await completeFrame(ctx);

    await expect(patchFrame(ctx, { moment: "a different memory entirely" })).rejects.toThrow(/already complete/);
  });

  it("the can't-think-of-one reroute sets wishedInstead and still completes normally", async () => {
    const ctx = makeCtx(await createTestUser());

    // Steps 2–4 run unchanged on the reroute path (spec §4.1) — same fields,
    // just with wishedInstead carried alongside the moment text.
    await patchFrame(ctx, { moment: "a time I wished someone had noticed", wishedInstead: true });
    await patchFrame(ctx, { unsaidNeed: "to_be_seen" });
    await patchFrame(ctx, { visibleCues: JSON.stringify({ chips: ["went_quiet"], other: null }) });
    await patchFrame(ctx, { welcomeGuess: "not_very" });
    const completed = await completeFrame(ctx);

    expect(completed.frameDone).toBe(true);
    const row = await prisma.noticingFrame.findUniqueOrThrow({ where: { userId: ctx.user.id } });
    expect(row.wishedInstead).toBe(true);
    expect(row.completedAt).not.toBeNull();
  });

  it("does not gate the loop — the loop still opens with no frame ever started", async () => {
    // Restates the existing "opens for a brand-new user" case from the
    // caller's side of the frame mutations, so the two guarantees (frame
    // doesn't gate loop, loop doesn't gate frame) are both pinned here too.
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    expect(sitting.entries).toHaveLength(1);
    expect(await prisma.noticingFrame.count()).toBe(0);
  });

  it("makes sense for someone who already ran the loop before doing the frame", async () => {
    const ctx = makeCtx(await createTestUser());

    // Run a full loop sitting first — nothing about the frame is required
    // beforehand (spec §4.1, build plan §5 ordering notes).
    const sitting = await startSitting(ctx);
    await patch(ctx, sitting.entries[0].id, { place: "home", person: "my sister", observation: "went quiet" });
    await finish(ctx, sitting.id);

    // The frame still runs to completion afterwards, and the loop remains
    // usable for a second sitting once it has.
    await patchFrame(ctx, { moment: "a", unsaidNeed: "rest", visibleCues: "{}", welcomeGuess: "very" });
    const completed = await completeFrame(ctx);
    expect(completed.frameDone).toBe(true);

    const second = await startSitting(ctx);
    expect(second.id).not.toBe(sitting.id);
    expect(second.entries).toHaveLength(1);
  });

  it("a partially-filled frame is never reported done, even with every field but one set", async () => {
    const ctx = makeCtx(await createTestUser());
    await patchFrame(ctx, { moment: "a", unsaidNeed: "rest", visibleCues: "{}" });
    // welcomeGuess deliberately never set, and completeNoticingFrame never called.
    const state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.frameDone).toBe(false);
  });
});

describe("capacity and the Reflect handoff (build plan §5 phase 6)", () => {
  it("stores the capacity accretion, opaquely, only for the entry that offered it", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;
    await patch(ctx, entryId, {
      place: "work",
      person: "the new hire",
      observation: "ate lunch alone again",
      need: "connection",
      smallThing: "asked them to join us tomorrow",
    });

    const updated = await setCapacity(ctx, entryId, JSON.stringify({ category: "heart", tag: "wanted_to" }));
    const stored = updated.entries.find((e: any) => e.id === entryId)!;
    expect(JSON.parse(stored.capacityTags)).toEqual({ category: "heart", tag: "wanted_to" });
    // Opaque to the server — it's stored, not parsed or validated here.
    expect(stored.capacityTags).not.toContain("the new hire");
  });

  it("records the motive answer and computes nothing from it", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;
    await patch(ctx, entryId, { place: "home", person: "a friend", observation: "seemed low", smallThing: "checked in" });

    const updated = await setMotive(ctx, entryId, "capacity_and_care");
    const stored = updated.entries.find((e: any) => e.id === entryId)!;
    expect(stored.motiveNote).toBe("capacity_and_care");
    // Nothing in the returned state changes shape because of this answer —
    // no field anywhere reflects it back as a score or a flag.
    const state = await queryResolvers.noticingState(null, {}, ctx);
    expect(Object.keys(state)).toEqual([
      "contentVersion",
      "locale",
      "reviewStatus",
      "frameDone",
      "graduationSurfaced",
      "promptFadeLevel",
    ]);
  });

  it("neither mutation is gated on the other, or on capacity/motive being asked at all", async () => {
    // A pass can finish having answered neither — nothing in spec §4.6 makes
    // either one required, and finishing must not need them.
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    await patch(ctx, sitting.entries[0].id, { place: "home", person: "a", observation: "b" });
    const done = await finish(ctx, sitting.id);
    expect(done.completedAt).not.toBeNull();
    expect(done.entries[0].capacityTags).toBeNull();
    expect(done.entries[0].motiveNote).toBeNull();
  });

  it("both refuse a finished sitting, same as updateNoticingEntry", async () => {
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const entryId = sitting.entries[0].id;
    await patch(ctx, entryId, { place: "home", person: "a", observation: "b" });
    await finish(ctx, sitting.id);

    await expect(setCapacity(ctx, entryId, JSON.stringify({ category: "head", tag: "x" }))).rejects.toThrow(
      /already finished/
    );
    await expect(setMotive(ctx, entryId, "obligation")).rejects.toThrow(/already finished/);
  });

  it("refuses an entry that belongs to another user", async () => {
    const owner = await createTestUser({ email: "owner@example.com" });
    const intruder = await createTestUser({ email: "intruder@example.com" });
    const ownerCtx = makeCtx(owner);
    const intruderCtx = makeCtx(intruder);

    const sitting = await startSitting(ownerCtx);
    const entryId = sitting.entries[0].id;

    await expect(setCapacity(intruderCtx, entryId, JSON.stringify({ category: "head", tag: "x" }))).rejects.toThrow(
      /Not found/
    );
    await expect(setMotive(intruderCtx, entryId, "obligation")).rejects.toThrow(/Not found/);
  });

  it("a motive answer never surfaces a catch — the mutation has nowhere to put one", async () => {
    // motiveNote only ever holds one of the two fixed tokens the closed pick
    // offers, so the protective lexicon can never actually match it, and
    // setNoticingMotive's own return shape (NtcSitting, no wrapper) has no
    // slot for one regardless.
    const ctx = makeCtx(await createTestUser());
    const sitting = await startSitting(ctx);
    const updated = await setMotive(ctx, sitting.entries[0].id, "obligation");
    expect((updated as any).catch).toBeUndefined();
  });
});

describe("self-initiation and the graduation door (build plan §5 phase 7)", () => {
  const reps = DIALS.graduation.sittingsPerFadeStep * DIALS.graduation.graduationFadeLevel;

  /**
   * Complete `n` sittings quickly, each a real single pass with a real
   * place/person/observation and, unless `withoutNeed` is set, a real need —
   * enough genuine rows to drive both halves of `graduationDue`: the
   * completed-sittings count `computeFadeLevel` reads, and the entries
   * `recentEntriesStillNotice` reads back out afterward.
   *
   * Returns every `finishNoticingSitting` result in order. This matters:
   * the door is decided the moment the cap is reached, which is very often
   * partway THROUGH a batch built by this helper, not on some later, separate
   * close — an early draft of these tests assumed the latter and every one
   * of them failed the same way (asserting graduation on a sitting AFTER the
   * one that actually already earned it, by which point graduationSurfaced
   * was already true and every subsequent close was correctly null).
   */
  async function completeSittings(ctx: any, n: number, opts: { withoutNeed?: boolean } = {}) {
    const results: any[] = [];
    for (let i = 0; i < n; i++) {
      const s = await startSitting(ctx);
      await patch(ctx, s.entries[0].id, {
        place: "home",
        person: `person ${i}`,
        observation: `noticed something ${i}`,
        ...(opts.withoutNeed ? {} : { need: "rest" }),
      });
      results.push(await mutationResolvers.finishNoticingSitting(null, { sittingId: s.id }, ctx));
    }
    return results;
  }

  const finishOne = async (ctx: any, opts: { need?: string | null } = {}) => {
    const s = await startSitting(ctx);
    await patch(ctx, s.entries[0].id, {
      place: "home",
      person: "a",
      observation: "b",
      ...(opts.need !== undefined ? { need: opts.need } : { need: "rest" }),
    });
    return mutationResolvers.finishNoticingSitting(null, { sittingId: s.id }, ctx);
  };

  it("does not fire for a brand-new user", async () => {
    const ctx = makeCtx(await createTestUser());
    const result = await finishOne(ctx);
    expect(result.graduation).toBeNull();
  });

  it("stays shut one sitting short of the fade cap, even with good entries throughout", async () => {
    const ctx = makeCtx(await createTestUser());
    // reps - 2 completed here, plus the one finishOne below closes = reps - 1
    // total completed sittings — one short of the cap, not at it.
    await completeSittings(ctx, reps - 2);
    const result = await finishOne(ctx);
    expect(result.graduation).toBeNull();

    const state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.promptFadeLevel).toBeLessThan(DIALS.graduation.graduationFadeLevel);
  });

  it("opens exactly on the sitting that reaches the fade cap, with good entries throughout, and not before", async () => {
    const ctx = makeCtx(await createTestUser());
    const results = await completeSittings(ctx, reps);

    // Every sitting before the cap-reaching one stays shut...
    expect(results.slice(0, -1).every((r) => r.graduation === null)).toBe(true);
    // ...and the one that reaches it is the one that earns it — not a
    // separate, later close.
    const last = results[results.length - 1];
    expect(last.graduation).not.toBeNull();
    expect(last.graduation.line).toBeTruthy();

    const state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.promptFadeLevel).toBe(DIALS.graduation.graduationFadeLevel);
  });

  it("does not open when the fade cap is reached but the recent entries have stopped naming a need", async () => {
    const ctx = makeCtx(await createTestUser());
    // Good entries build up short of the window that will close out the
    // cap, so the door has never had a chance to open on good history
    // alone — then the practice runs dry for exactly the recent window,
    // reaching the cap on a stretch that no longer "still" (spec §4.5)
    // contains a need.
    await completeSittings(ctx, reps - DIALS.graduation.qualityWindowEntries);
    const results = await completeSittings(ctx, DIALS.graduation.qualityWindowEntries, { withoutNeed: true });

    const state = await queryResolvers.noticingState(null, {}, ctx);
    expect(state.promptFadeLevel).toBe(DIALS.graduation.graduationFadeLevel);
    expect(results.every((r) => r.graduation === null)).toBe(true);
  });

  it("requires ALL of the quality window to qualify, not merely some of it", async () => {
    const ctx = makeCtx(await createTestUser());
    // 14 good, then the 15th (the one that reaches the fade cap) has no
    // need — a MAJORITY of the recent window still holds the shape (5 of 6),
    // but not all of it. The dial's own docblock (content/noticing/dials.ts)
    // claims this is checked strictly; this test is what actually pins that,
    // rather than leaving it a claim nothing verifies.
    await completeSittings(ctx, reps - 1);
    const result = await finishOne(ctx, { need: null });
    expect(result.graduation).toBeNull();
  });

  it("fires exactly once, once it has actually been acknowledged", async () => {
    const ctx = makeCtx(await createTestUser());
    const results = await completeSittings(ctx, reps);
    expect(results[results.length - 1].graduation).not.toBeNull();

    // The door is retired by the client saying it showed it, not by the
    // server saying it decided to. Once acknowledged, a second otherwise-
    // identical close must not open it again — a door you have walked
    // through cannot be taken back, and it also cannot be re-issued.
    await mutationResolvers.acknowledgeNoticingGraduation(null, {}, ctx);

    const again = await finishOne(ctx);
    expect(again.graduation).toBeNull();
  });

  it("re-offers a door that was never acknowledged, rather than spending it unseen", async () => {
    const ctx = makeCtx(await createTestUser());
    const results = await completeSittings(ctx, reps);
    expect(results[results.length - 1].graduation).not.toBeNull();

    // The response carrying the door was dropped — a refresh, a crash, a
    // flaky connection — so no acknowledge ever arrived. This is the whole
    // reason the flag is not written at surface time: the person has not
    // seen it, so they are still owed it.
    //
    // This test exists to stop a later "fix" collapsing the two steps back
    // into one on the reasoning that a door should fire once. It should
    // fire once SEEN. Showing it twice is a shrug; showing it zero times
    // loses the only moment the mechanism exists to deliver, silently and
    // with no way for anyone to find out.
    const again = await finishOne(ctx);
    expect(again.graduation).not.toBeNull();
    expect(again.graduation.line).toBe(results[results.length - 1].graduation.line);
  });

  it("does not spend graduationSurfaced merely by deciding the door is due", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const results = await completeSittings(ctx, reps);
    expect(results[results.length - 1].graduation).not.toBeNull();

    // Surfacing is not spending. finishNoticingSitting decided the door was
    // due and returned it; until something says it was actually shown, the
    // flag stays false and the door stays owed.
    const beforeAck = await prisma.noticingState.findUniqueOrThrow({ where: { userId: user.id } });
    expect(beforeAck.graduationSurfaced).toBe(false);

    await mutationResolvers.acknowledgeNoticingGraduation(null, {}, ctx);

    const afterAck = await prisma.noticingState.findUniqueOrThrow({ where: { userId: user.id } });
    expect(afterAck.graduationSurfaced).toBe(true);
  });

  it("acknowledging is idempotent, and has nothing behind it to increment", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await completeSittings(ctx, reps);

    await mutationResolvers.acknowledgeNoticingGraduation(null, {}, ctx);
    await mutationResolvers.acknowledgeNoticingGraduation(null, {}, ctx);

    const state = await prisma.noticingState.findUniqueOrThrow({ where: { userId: user.id } });
    expect(state.graduationSurfaced).toBe(true);
  });

  it("pins what 'unprompted' means here: wasPrompted has no effect, because it is always false in this build", async () => {
    // NoticingLoopPage.tsx hardcodes wasPrompted: false on every open, the
    // same as FeelingsNeedsLoopPage.tsx — there is no cue mechanism anywhere
    // in the product yet, so the field is a constant, not a signal.
    // graduationDue (services/noticing/session.ts) reads the prompt-fade
    // level instead, and this test pins that: a history built entirely out
    // of wasPrompted: true sittings graduates exactly the same as one built
    // out of wasPrompted: false sittings, because the door never looks at
    // this field. If a future phase adds a real cue mechanism and wires
    // detection to wasPrompted instead, this test should start failing —
    // that failure is the point, not a regression to silence.
    const ctx = makeCtx(await createTestUser());
    const results: any[] = [];
    for (let i = 0; i < reps; i++) {
      const s = await mutationResolvers.startNoticingSitting(null, { wasPrompted: true }, ctx);
      await patch(ctx, s.entries[0].id, {
        place: "home",
        person: `person ${i}`,
        observation: `noticed something ${i}`,
        need: "rest",
      });
      results.push(await mutationResolvers.finishNoticingSitting(null, { sittingId: s.id }, ctx));
    }
    expect(results[results.length - 1].graduation).not.toBeNull();
  });
});
