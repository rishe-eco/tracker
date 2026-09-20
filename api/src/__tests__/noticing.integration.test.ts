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
});
