/**
 * Reflect's two catches (B3): AC-21, AC-25's server half, AC-28, AC-29, AC-32.
 *
 * Fixed clock, `Date` only: the services write their own times from
 * `new Date()`, and the cooldown reads `Date.now()`. No test reads real time.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDb, createTestUser, prisma } from "../test/helpers";
import { mutationResolvers as M } from "../graphql/resolvers/mutations";

const T0 = new Date("2031-03-01T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => vi.setSystemTime(new Date(T0.getTime() + ms));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  await clearDb();
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const sessionCtx = (userId: string) => ({ prisma, user: { id: userId }, auth: { kind: "session" } });
async function user(email = "a@example.com") {
  const u = await createTestUser({ email });
  return { u, ctx: sessionCtx(u.id) };
}

const start = (ctx: any, replacing?: string) => (M.startReflectEntry as any)(null, { replacing }, ctx);
const save = (ctx: any, entryId: string, patch: object = {}) =>
  (M.saveReflectEntry as any)(null, { entryId, ...patch }, ctx);
const moment = (ctx: any, entryId: string, position: number, patch: object = {}) =>
  (M.saveReflectMoment as any)(null, { entryId, position, ...patch }, ctx);
const reading = (ctx: any, entryId: string, position: number, patch: object = {}) =>
  (M.saveReflectReading as any)(null, { entryId, position, ...patch }, ctx);
const move = (ctx: any, entryId: string, to: string) => (M.moveReflectEntry as any)(null, { entryId, to }, ctx);
const stop = (ctx: any, entryId: string) => (M.stopReflectEntry as any)(null, { entryId }, ctx);

const STORY = "We sat down to eat. She always leaves before I finish. I said nothing.";

/** An entry at the feelings step, holding `story`. */
async function atFeelings(ctx: any, story: string | null = STORY, replacing?: string) {
  const e = await start(ctx, replacing);
  if (story != null) await save(ctx, e.id, { story });
  await move(ctx, e.id, "story");
  await move(ctx, e.id, "feelings");
  return e.id as string;
}

const entryRow = (id: string) => prisma.reflectEntry.findUniqueOrThrow({ where: { id } });
const stateRow = (userId: string) => prisma.reflectState.findUniqueOrThrow({ where: { userId } });
const lastCatch = async (userId: string) => JSON.parse((await stateRow(userId)).lastCatchAt ?? "{}");

describe("the interpretation offer (AC-29, AC-21)", () => {
  it("surfaces on the forward move into the reality check, with the word and the person's sentence only", async () => {
    const { ctx } = await user();
    const id = await atFeelings(ctx);
    const r = await move(ctx, id, "reality");
    expect(r.interpretationOffer).toEqual({ word: "always", sentence: "She always leaves before I finish" });
    expect(Object.keys(r.interpretationOffer).sort()).toEqual(["sentence", "word"]);
    expect((await entryRow(id)).interpretationSurfacedAt).toEqual(T0);
  });

  it("one offer per entry across two forward moves and a Back", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx);
    expect((await move(ctx, id, "reality")).interpretationOffer).not.toBeNull();
    await move(ctx, id, "feelings"); // Back
    at(5 * DAY); // well past the cooldown: the entry's own gate holds
    expect((await move(ctx, id, "reality")).interpretationOffer).toBeNull();
    await move(ctx, id, "close");
    await move(ctx, id, "reality"); // Back again
    expect((await move(ctx, id, "close")).interpretationOffer).toBeNull();
    expect((await entryRow(id)).interpretationSurfacedAt).toEqual(T0);
    expect((await lastCatch(u.id)).interpretation).toBe(T0.toISOString());
  });

  it("writes the cooldown when surfaced, and it holds for a second entry within the window", async () => {
    const { u, ctx } = await user();
    const first = await atFeelings(ctx);
    expect((await move(ctx, first, "reality")).interpretationOffer).not.toBeNull();
    expect(await lastCatch(u.id)).toEqual({ interpretation: T0.toISOString() });
    await stop(ctx, first);

    at(DAY); // one day on: inside the two-day window
    const second = await atFeelings(ctx);
    expect((await move(ctx, second, "reality")).interpretationOffer).toBeNull();
    expect((await entryRow(second)).interpretationSurfacedAt).toBeNull();
    expect((await lastCatch(u.id)).interpretation).toBe(T0.toISOString());
    await stop(ctx, second);

    at(2 * DAY); // exactly the window: off cooldown
    const third = await atFeelings(ctx);
    expect((await move(ctx, third, "reality")).interpretationOffer).not.toBeNull();
    expect((await lastCatch(u.id)).interpretation).toBe(new Date(T0.getTime() + 2 * DAY).toISOString());
  });

  it("a corrupt cooldown value means off cooldown", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx);
    await prisma.reflectState.update({ where: { userId: u.id }, data: { lastCatchAt: "{not json" } });
    expect((await move(ctx, id, "reality")).interpretationOffer).not.toBeNull();
    expect(await lastCatch(u.id)).toEqual({ interpretation: T0.toISOString() });

    await stop(ctx, id);
    const next = await atFeelings(ctx);
    await prisma.reflectState.update({
      where: { userId: u.id },
      data: { lastCatchAt: JSON.stringify({ interpretation: "never", faux: 7 }) },
    });
    expect((await move(ctx, next, "reality")).interpretationOffer).not.toBeNull();
  });

  it("no save surfaces it, at any step, and no other move does (AC-21)", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx, null);
    const saved = await save(ctx, id, { story: STORY });
    expect(saved.interpretationOffer).toBeUndefined();
    expect((await entryRow(id)).interpretationSurfacedAt).toBeNull();
    // Saving the story while the reality check is open surfaces nothing either.
    await move(ctx, id, "reality"); // the offer is spent here, by the move
    await prisma.reflectEntry.update({ where: { id }, data: { interpretationSurfacedAt: null } });
    await prisma.reflectState.update({ where: { userId: u.id }, data: { lastCatchAt: null } });
    const again = await save(ctx, id, { story: STORY + " He never asks." });
    expect(again.interpretationOffer).toBeUndefined();
    expect((await entryRow(id)).interpretationSurfacedAt).toBeNull();
    expect((await stateRow(u.id)).lastCatchAt).toBeNull();
  });

  it("a move to the story or the close, and a move to the current step, surface nothing", async () => {
    const { ctx } = await user();
    const e = await start(ctx);
    await save(ctx, e.id, { story: STORY });
    expect((await move(ctx, e.id, "story")).interpretationOffer).toBeNull();
    expect((await move(ctx, e.id, "story")).interpretationOffer).toBeNull(); // double tap
    await move(ctx, e.id, "feelings");
    expect((await move(ctx, e.id, "feelings")).interpretationOffer).toBeNull();
    expect((await entryRow(e.id)).interpretationSurfacedAt).toBeNull();
  });

  it("an entry with no story, or a clean one, surfaces nothing and writes nothing", async () => {
    const { u, ctx } = await user();
    const none = await atFeelings(ctx, null);
    expect((await move(ctx, none, "reality")).interpretationOffer).toBeNull();
    await stop(ctx, none);
    const clean = await atFeelings(ctx, "We sat down to eat. It was a quiet evening.");
    expect((await move(ctx, clean, "reality")).interpretationOffer).toBeNull();
    expect((await entryRow(clean)).interpretationSurfacedAt).toBeNull();
    expect((await stateRow(u.id)).lastCatchAt).toBeNull();
  });

  it("a Persian story surfaces nothing: the practice locale decides, not the story (PD-7)", async () => {
    const { ctx } = await user();
    const id = await atFeelings(ctx, "او همیشه دیر می‌آید. هیچ‌وقت خبر نمی‌دهد.");
    expect((await move(ctx, id, "reality")).interpretationOffer).toBeNull();
  });
});

describe("only the story is read (AC-32)", () => {
  it("a trigger in the scene, a moment or a reading surfaces nothing", async () => {
    const { u, ctx } = await user();
    const e = await start(ctx);
    await save(ctx, e.id, { scene: "He is so selfish and always late", story: "We sat down to eat." });
    await move(ctx, e.id, "story");
    await move(ctx, e.id, "feelings");
    await moment(ctx, e.id, 0, { whenText: "she never listens", feeling: "sad", need: "nobody cares" });
    await reading(ctx, e.id, 0, { reading: "she did it on purpose", camera: "she ignored me" });
    const r = await move(ctx, e.id, "reality");
    expect(r.interpretationOffer).toBeNull();
    await save(ctx, e.id, { close: "he is lazy and rude" });
    expect((await entryRow(e.id)).interpretationSurfacedAt).toBeNull();
    expect((await stateRow(u.id)).lastCatchAt).toBeNull();
  });
});

describe("the faux-feeling offer (D-7)", () => {
  it("surfaces once on a committed faux feeling, with its position, and records it", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx, null);
    const r = await moment(ctx, id, 0, { feeling: "betrayed" });
    expect(r.fauxOffer).toMatchObject({ position: 0, conceptId: "betrayed" });
    expect(r.fauxOffer.line).toContain("betrayed");
    expect((await entryRow(id)).fauxSurfacedAt).toEqual(T0);
    expect(await lastCatch(u.id)).toEqual({ faux: T0.toISOString() });
  });

  it("a second faux feeling in the same entry surfaces nothing", async () => {
    const { ctx } = await user();
    const id = await atFeelings(ctx, null);
    expect((await moment(ctx, id, 0, { feeling: "betrayed" })).fauxOffer).not.toBeNull();
    at(30 * DAY); // off cooldown: the entry's own gate holds
    const r = await moment(ctx, id, 1, { feeling: "ignored" });
    expect(r.fauxOffer).toBeNull();
    expect(r.moment.position).toBe(1);
  });

  it("a feeling that is not a faux one, or an unchanged one, surfaces nothing and writes nothing", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx, null);
    expect((await moment(ctx, id, 0, { feeling: "tired" })).fauxOffer).toBeNull();
    expect((await moment(ctx, id, 0, { whenText: "no feeling in this patch" })).fauxOffer).toBeNull();
    expect((await moment(ctx, id, 0, { feeling: "" })).fauxOffer).toBeNull();
    expect((await stateRow(u.id)).lastCatchAt).toBeNull();
    expect((await entryRow(id)).fauxSurfacedAt).toBeNull();
  });

  it("only a feeling that differs from the stored one is read", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx, null);
    // Stored as a faux feeling with the cooldown running, then saved again unchanged.
    await prisma.reflectMoment.create({ data: { entryId: id, position: 0, feeling: "ignored" } });
    const same = await moment(ctx, id, 0, { feeling: "ignored", need: "to be seen" });
    expect(same.fauxOffer).toBeNull();
    expect((await entryRow(id)).fauxSurfacedAt).toBeNull();
    expect((await stateRow(u.id)).lastCatchAt).toBeNull();
    // Changed to another faux feeling: offered.
    expect((await moment(ctx, id, 0, { feeling: "betrayed" })).fauxOffer).toMatchObject({ position: 0 });
  });

  it("the cooldown holds for a second entry within seven days, and lifts at seven", async () => {
    const { u, ctx } = await user();
    const first = await atFeelings(ctx, null);
    expect((await moment(ctx, first, 0, { feeling: "betrayed" })).fauxOffer).not.toBeNull();
    await stop(ctx, first);

    at(6 * DAY);
    const second = await atFeelings(ctx, null);
    expect((await moment(ctx, second, 0, { feeling: "betrayed" })).fauxOffer).toBeNull();
    expect((await entryRow(second)).fauxSurfacedAt).toBeNull();
    expect((await lastCatch(u.id)).faux).toBe(T0.toISOString());
    await stop(ctx, second);

    at(7 * DAY);
    const third = await atFeelings(ctx, null);
    expect((await moment(ctx, third, 0, { feeling: "betrayed" })).fauxOffer).not.toBeNull();
    expect((await lastCatch(u.id)).faux).toBe(new Date(T0.getTime() + 7 * DAY).toISOString());
  });

  it("the two cooldowns are kept apart in one value", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx);
    await moment(ctx, id, 0, { feeling: "betrayed" });
    await move(ctx, id, "reality");
    expect(await lastCatch(u.id)).toEqual({ faux: T0.toISOString(), interpretation: T0.toISOString() });
  });

  it("*Use one*'s follow-up save writes only the moment (AC-25's server half)", async () => {
    const { u, ctx } = await user();
    const id = await atFeelings(ctx, null);
    const offered = await moment(ctx, id, 0, { feeling: "betrayed" });
    const hint = offered.fauxOffer.feelingHints[0];
    expect(typeof hint).toBe("string");
    const before = { entry: await entryRow(id), state: await stateRow(u.id) };

    at(60 * 1000);
    const r = await moment(ctx, id, 0, { feeling: hint, feelingSource: "palette" });
    expect(r.fauxOffer).toBeNull();
    expect(r.moment).toMatchObject({ feeling: hint, feelingSource: "palette" });
    const after = { entry: await entryRow(id), state: await stateRow(u.id) };
    expect(after.entry).toEqual(before.entry);
    expect(after.state).toEqual(before.state);
  });
});

describe("the two catches are independent", () => {
  it("a surfaced faux offer does not spend the interpretation offer", async () => {
    const { ctx } = await user();
    const id = await atFeelings(ctx);
    expect((await moment(ctx, id, 0, { feeling: "betrayed" })).fauxOffer).not.toBeNull();
    expect((await move(ctx, id, "reality")).interpretationOffer).not.toBeNull();
  });
});
