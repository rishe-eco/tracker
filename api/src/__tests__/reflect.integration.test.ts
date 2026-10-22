/**
 * Reflect's entry API (B2): AC-1 to AC-7, AC-9, AC-14's list half, AC-36, AC-46.
 *
 * Resolvers are called directly, with session and token contexts built here
 * (`makeCtx` sets no `auth`, so a Reflect call made with it would be refused).
 * The clock is fixed and only `Date` is faked: Prisma's `@default(now())` is
 * set in the engine, out of reach of a fake, so the services write their own
 * times and the tests below set the system time around each call.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApolloServer } from "apollo-server-express";
import { clearDb, createTestUser, prisma } from "../test/helpers";
import { mutationResolvers as M } from "../graphql/resolvers/mutations";
import { queryResolvers as Q } from "../graphql/resolvers/query";
import { typeDefs } from "../graphql/schema/typeDefs";
import { resolvers } from "../graphql/resolvers";

const T0 = new Date("2031-03-01T09:00:00.000Z");

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
const tokenCtx = (userId: string, scope: "read" | "write") => ({
  prisma,
  user: { id: userId },
  auth: { kind: "apiToken", tokenId: "t", scope },
});

const SESSION_ONLY = "Reflect is only available in the app, not to API tokens.";

async function twoUsers() {
  const a = await createTestUser({ email: "a@example.com" });
  const b = await createTestUser({ email: "b@example.com" });
  return { a, b, ca: sessionCtx(a.id), cb: sessionCtx(b.id) };
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
const finish = (ctx: any, entryId: string) => (M.finishReflectEntry as any)(null, { entryId }, ctx);
const answer = (ctx: any, entryId: string, a: string) =>
  (M.answerReflectEntry as any)(null, { entryId, answer: a }, ctx);
const del = (ctx: any, entryId: string) => (M.deleteReflectEntry as any)(null, { entryId }, ctx);
const past = (ctx: any, before?: string) => (Q.reflectPastEntries as any)(null, { before }, ctx);

/** Walk an open entry to the close step. */
async function toClose(ctx: any, entryId: string) {
  for (const to of ["story", "feelings", "reality", "close"]) await move(ctx, entryId, to);
}

/** A closed entry with story text. */
async function closedWithStory(ctx: any, story = "It happened.", scene?: string) {
  const e = await start(ctx);
  await save(ctx, e.id, { story, scene });
  await stop(ctx, e.id);
  return e.id as string;
}

describe("one open entry per person (AC-9, D-8, D-14)", () => {
  it("two concurrent starts give one entry", async () => {
    const { a, ca } = await twoUsers();
    const [x, y] = await Promise.all([start(ca), start(ca)]);
    expect(x.id).toBe(y.id);
    expect(await prisma.reflectEntry.count({ where: { userId: a.id } })).toBe(1);
  });

  it("returns the open entry when one is open", async () => {
    const { ca } = await twoUsers();
    const x = await start(ca);
    expect((await start(ca)).id).toBe(x.id);
    expect((await start(ca, "some-other-id")).id).toBe(x.id);
  });

  it("finds an open entry of any age (D-8)", async () => {
    const { ca } = await twoUsers();
    const x = await start(ca);
    vi.setSystemTime(new Date(T0.getTime() + 25 * 24 * 3600 * 1000));
    expect((await start(ca)).id).toBe(x.id);
    expect((await (Q.reflectEntry as any)(null, {}, ca)).id).toBe(x.id);
  });

  it("`replacing` closes only its own id, with the step kept", async () => {
    const { a, ca } = await twoUsers();
    const first = await start(ca);
    await move(ca, first.id, "story");
    const second = await start(ca, first.id);
    expect(second.id).not.toBe(first.id);
    const closed = await prisma.reflectEntry.findUnique({ where: { id: first.id } });
    expect(closed?.outcome).toBe("stopped");
    expect(closed?.closedAt).toEqual(T0);
    expect(closed?.step).toBe("story");
    // A double tap on "Start a new one" repeats `replacing: first`: it must not close the new one.
    const again = await start(ca, first.id);
    expect(again.id).toBe(second.id);
    expect(await prisma.reflectEntry.count({ where: { userId: a.id, closedAt: null } })).toBe(1);
  });
});

describe("saves", () => {
  it("leaves omitted arguments, stores an empty string as null, trims nothing (decisions 5, 8)", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    const saved = await save(ca, e.id, { scene: "  at the door ", story: "x" });
    expect(saved.scene).toBe("  at the door ");
    const again = await save(ca, e.id, { close: "later" });
    expect(again.scene).toBe("  at the door ");
    expect(again.story).toBe("x");
    const cleared = await save(ca, e.id, { story: "" });
    expect(cleared.story).toBeNull();
    expect(cleared.scene).toBe("  at the door ");
  });

  it("orders moments and readings by position", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    for (const p of [0, 1, 2]) {
      await moment(ca, e.id, p, { whenText: `w${p}` });
      await reading(ca, e.id, p, { reading: `r${p}` });
    }
    const open = await (Q.reflectEntry as any)(null, {}, ca);
    expect(open.moments.map((m: any) => m.position)).toEqual([0, 1, 2]);
    expect(open.readings.map((r: any) => r.position)).toEqual([0, 1, 2]);
    // Saving at an existing position updates it rather than adding one.
    await moment(ca, e.id, 1, { feeling: "tired", feelingSource: "own", met: "unmet" });
    const rows = await prisma.reflectMoment.findMany({ where: { entryId: e.id }, orderBy: { position: "asc" } });
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ whenText: "w1", feeling: "tired", feelingSource: "own", met: "unmet" });
  });

  it("returns a moment result carrying the faux offer, and a move result with no interpretation offer", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    const r = await moment(ca, e.id, 0, { feeling: "betrayed" });
    expect(r.fauxOffer).toMatchObject({ position: 0, conceptId: "betrayed" });
    expect(r.moment.position).toBe(0);
    const moved = await move(ca, e.id, "story");
    expect(moved.interpretationOffer).toBeNull();
  });
});

describe("bounds (AC-6)", () => {
  const over = "That is longer than a Reflect entry keeps.";
  const many = "An entry holds at most three of those.";

  it("accepts each field at its bound and refuses one over", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    const cases: Array<[string, (v: string) => Promise<any>, number]> = [
      ["scene", (v) => save(ca, e.id, { scene: v }), 140],
      ["story", (v) => save(ca, e.id, { story: v }), 5000],
      ["close", (v) => save(ca, e.id, { close: v }), 1000],
      ["whenText", (v) => moment(ca, e.id, 0, { whenText: v }), 280],
      ["feeling", (v) => moment(ca, e.id, 0, { feeling: v }), 60],
      ["need", (v) => moment(ca, e.id, 0, { need: v }), 60],
      ["reading", (v) => reading(ca, e.id, 0, { reading: v }), 280],
      ["camera", (v) => reading(ca, e.id, 0, { camera: v }), 280],
    ];
    for (const [, call, max] of cases) {
      await expect(call("x".repeat(max))).resolves.toBeTruthy();
      await expect(call("x".repeat(max + 1))).rejects.toThrow(over);
    }
  });

  it("counts UTF-16 units, as the browser's maxLength does (decision 5)", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await expect(save(ca, e.id, { scene: "😀".repeat(70) })).resolves.toBeTruthy();
    await expect(save(ca, e.id, { scene: "😀".repeat(71) })).rejects.toThrow(over);
  });

  it("refuses a fourth moment and reading, and a gap, and never echoes the text", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await expect(moment(ca, e.id, 1)).rejects.toThrow(many); // past the next free position
    await expect(reading(ca, e.id, 1)).rejects.toThrow(many);
    for (const p of [0, 1, 2]) {
      await moment(ca, e.id, p);
      await reading(ca, e.id, p);
    }
    await expect(moment(ca, e.id, 3)).rejects.toThrow(many);
    await expect(reading(ca, e.id, 3)).rejects.toThrow(many);
    await expect(moment(ca, e.id, -1)).rejects.toThrow(many);
    expect(await prisma.reflectMoment.count({ where: { entryId: e.id } })).toBe(3);
    expect(await prisma.reflectReading.count({ where: { entryId: e.id } })).toBe(3);

    const secret = "a private sentence " + "x".repeat(200);
    await expect(save(ca, e.id, { scene: secret })).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("private") })
    );
  });
});

describe("steps", () => {
  const stepMsg = "That step can't be reached from here.";

  it("moves precheck to story only, then one forward or back to any step from the story on", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await expect(move(ca, e.id, "feelings")).rejects.toThrow(stepMsg);
    expect((await move(ca, e.id, "story")).entry.step).toBe("story");
    await expect(move(ca, e.id, "reality")).rejects.toThrow(stepMsg); // skipping forward
    await expect(move(ca, e.id, "precheck")).rejects.toThrow(stepMsg);
    await move(ca, e.id, "feelings");
    await move(ca, e.id, "reality");
    await move(ca, e.id, "close");
    expect((await move(ca, e.id, "story")).entry.step).toBe("story"); // back to any step
    await expect(move(ca, e.id, "precheck")).rejects.toThrow(stepMsg);
  });

  it("a move to the current step returns the entry unchanged (decision 4)", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    expect((await move(ca, e.id, "story")).entry.step).toBe("story");
    expect((await move(ca, e.id, "story")).entry.step).toBe("story");
  });

  it("takes the pre-check arguments only on the pre-check step", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await save(ca, e.id, { precheckWhen: "days", precheckBefore: "no" });
    const row = await prisma.reflectEntry.findUnique({ where: { id: e.id } });
    expect([row?.precheckWhen, row?.precheckBefore]).toEqual(["days", "no"]);
    await move(ca, e.id, "story");
    await expect(save(ca, e.id, { precheckWhen: "weeks" })).rejects.toThrow(stepMsg);
  });

  it("refuses a save, move, stop or finish on a closed entry (D-15)", async () => {
    const { ca } = await twoUsers();
    const id = await closedWithStory(ca);
    const closed = "This entry is closed.";
    await expect(save(ca, id, { story: "more" })).rejects.toThrow(closed);
    await expect(moment(ca, id, 0)).rejects.toThrow(closed);
    await expect(reading(ca, id, 0)).rejects.toThrow(closed);
    await expect(move(ca, id, "story")).rejects.toThrow(closed);
    await expect(stop(ca, id)).rejects.toThrow(closed);
    await expect(finish(ca, id)).rejects.toThrow(closed);
  });

  it("finishes only from close, writing closedAt from the clock", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await move(ca, e.id, "story");
    await expect(finish(ca, e.id)).rejects.toThrow(stepMsg);
    await move(ca, e.id, "feelings");
    await move(ca, e.id, "reality");
    await move(ca, e.id, "close");
    vi.setSystemTime(new Date("2031-03-02T10:00:00.000Z"));
    await finish(ca, e.id);
    const row = await prisma.reflectEntry.findUnique({ where: { id: e.id } });
    expect(row?.outcome).toBe("finished");
    expect(row?.closedAt).toEqual(new Date("2031-03-02T10:00:00.000Z"));
  });
});

describe("another person's id (AC-2)", () => {
  it("gives Not found for a read, a write and a delete, and changes nothing", async () => {
    const { a, ca, cb } = await twoUsers();
    const id = await closedWithStory(ca, "mine");
    const open = await start(ca);

    // Reads
    await expect((Q.reflectPastEntry as any)(null, { id }, cb)).rejects.toThrow("Not found");
    await expect(past(cb, id)).rejects.toThrow("Not found");
    // Writes
    await expect(save(cb, open.id, { story: "theirs" })).rejects.toThrow("Not found");
    await expect(moment(cb, open.id, 0)).rejects.toThrow("Not found");
    await expect(reading(cb, open.id, 0)).rejects.toThrow("Not found");
    await expect(move(cb, open.id, "story")).rejects.toThrow("Not found");
    await expect(stop(cb, open.id)).rejects.toThrow("Not found");
    await expect(finish(cb, open.id)).rejects.toThrow("Not found");
    await expect(answer(cb, id, "same")).rejects.toThrow("Not found");
    // Delete
    await expect(del(cb, id)).rejects.toThrow("Not found");
    await expect(del(cb, "no-such-id")).rejects.toThrow("Not found");
    expect(await prisma.reflectEntry.count({ where: { userId: a.id } })).toBe(2);
    // B's own start never meets A's open entry.
    expect((await start(cb)).id).not.toBe(open.id);
  });
});

describe("tokens are refused (AC-4, D-12)", () => {
  it("refuses a read and a write token on a query and a mutation, never as Unauthorized", async () => {
    const { a } = await twoUsers();
    const e = await start(sessionCtx(a.id));
    for (const scope of ["read", "write"] as const) {
      const ctx = tokenCtx(a.id, scope);
      await expect((Q.reflectHome as any)(null, {}, ctx)).rejects.toThrow(SESSION_ONLY);
      await expect(save(ctx, e.id, { story: "x" })).rejects.toThrow(SESSION_ONLY);
    }
    expect(SESSION_ONLY).not.toBe("Unauthorized");
    expect((await prisma.reflectEntry.findUnique({ where: { id: e.id } }))?.story).toBeNull();
  });

  it("a caller with no user is still Unauthorized, and a context with no auth is refused", async () => {
    const { a } = await twoUsers();
    await expect((Q.reflectHome as any)(null, {}, { prisma, user: null })).rejects.toThrow("Unauthorized");
    await expect((Q.reflectHome as any)(null, {}, { prisma, user: { id: a.id } })).rejects.toThrow(SESSION_ONLY);
  });
});

describe("the rows land in Reflect's tables and no others (AC-1)", () => {
  it("writes nothing to the Journal, Loop, Noticing, Action or Goal tables", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await save(ca, e.id, { scene: "s", story: "t", precheckWhen: "days", precheckBefore: "yes" });
    await moment(ca, e.id, 0, { whenText: "w", feeling: "f", feelingSource: "own", need: "n", needSource: "palette", met: "not_sure" });
    await reading(ca, e.id, 0, { reading: "r", camera: "c" });
    await toClose(ca, e.id);
    await save(ca, e.id, { close: "c" });
    await finish(ca, e.id);
    await answer(ca, e.id, "differently");

    expect(await prisma.reflectEntry.count()).toBe(1);
    expect(await prisma.reflectMoment.count()).toBe(1);
    expect(await prisma.reflectReading.count()).toBe(1);
    expect(await prisma.reflectState.count()).toBe(1);
    const others = await Promise.all([
      prisma.journal.count(),
      prisma.journalEntry.count(),
      prisma.loopSitting.count(),
      prisma.loopEntry.count(),
      prisma.loopState.count(),
      prisma.frameCompletion.count(),
      prisma.noticingSitting.count(),
      prisma.noticingEntry.count(),
      prisma.noticingState.count(),
      prisma.action.count(),
      prisma.goal.count(),
      prisma.interval.count(),
      prisma.project.count(),
    ]);
    expect(others).toEqual(others.map(() => 0));
  });

  it("reads write nothing: ReflectState is created on the first start only (decision 2)", async () => {
    const { ca } = await twoUsers();
    await (Q.reflectHome as any)(null, {}, ca);
    await (Q.reflectContent as any)(null, {}, ca);
    await (Q.reflectEntry as any)(null, {}, ca);
    await past(ca);
    expect(await prisma.reflectState.count()).toBe(0);
    await start(ca);
    await start(ca);
    expect(await prisma.reflectState.count()).toBe(1);
  });
});

describe("the after-entry answer (AC-36)", () => {
  it("is refused before Finish, after a stop and a second time; set once", async () => {
    const { ca } = await twoUsers();
    const refused = "This entry's question can't be answered now.";
    const open = await start(ca);
    await expect(answer(ca, open.id, "same")).rejects.toThrow(refused);
    await toClose(ca, open.id);
    await finish(ca, open.id);
    expect(await answer(ca, open.id, "more_caught_up")).toBe(true);
    await expect(answer(ca, open.id, "same")).rejects.toThrow(refused);
    expect((await prisma.reflectEntry.findUnique({ where: { id: open.id } }))?.afterAnswer).toBe("more_caught_up");

    const stopped = await start(ca);
    await stop(ca, stopped.id);
    await expect(answer(ca, stopped.id, "same")).rejects.toThrow(refused);
  });
});

describe("Past entries (AC-46, AC-14's list half, D-5)", () => {
  it("lists closed entries with story text only, newest first, with four fields", async () => {
    const { ca } = await twoUsers();
    vi.setSystemTime(new Date("2031-03-01T09:00:00.000Z"));
    const older = await closedWithStory(ca, "older story", "older scene");
    // Stopped at the pre-check, no story: never listed (AC-14).
    vi.setSystemTime(new Date("2031-03-02T09:00:00.000Z"));
    const nothing = await start(ca);
    await stop(ca, nothing.id);
    vi.setSystemTime(new Date("2031-03-03T09:00:00.000Z"));
    const newer = await closedWithStory(ca, "n".repeat(200));
    // Open with a story: not listed.
    vi.setSystemTime(new Date("2031-03-04T09:00:00.000Z"));
    const open = await start(ca);
    await save(ca, open.id, { story: "still going" });

    const page = await past(ca);
    expect(page.hasOlder).toBe(false);
    expect(page.rows.map((r: any) => r.id)).toEqual([newer, older]);
    expect(Object.keys(page.rows[0]).sort()).toEqual(["createdAt", "id", "scene", "storyStart"]);
    expect(page.rows[0].storyStart).toBe("n".repeat(80));
    expect(page.rows[1].scene).toBe("older scene");
    expect((await (Q.reflectHome as any)(null, {}, ca)).hasPast).toBe(true);
  });

  it("serves a past entry only when it is closed and has a story", async () => {
    const { ca } = await twoUsers();
    const ok = await closedWithStory(ca, "kept");
    const got = await (Q.reflectPastEntry as any)(null, { id: ok }, ca);
    expect(got.story).toBe("kept");
    const open = await start(ca);
    await save(ca, open.id, { story: "open" });
    await expect((Q.reflectPastEntry as any)(null, { id: open.id }, ca)).rejects.toThrow("Not found");
    const empty = await start(ca, open.id);
    await stop(ca, empty.id);
    await expect((Q.reflectPastEntry as any)(null, { id: empty.id }, ca)).rejects.toThrow("Not found");
  });

  it("pages of 50 with a before cursor, ordered under equal timestamps (decision 7)", async () => {
    const { a, ca } = await twoUsers();
    const base = T0.getTime();
    await prisma.reflectEntry.createMany({
      data: Array.from({ length: 53 }, (_, i) => ({
        id: `e${String(i).padStart(2, "0")}`,
        userId: a.id,
        story: `s${i}`,
        outcome: "stopped",
        closedAt: new Date(base),
        // Pairs share a timestamp, so the id breaks the tie.
        createdAt: new Date(base + Math.floor(i / 2) * 1000),
      })),
    });
    const first = await past(ca);
    expect(first.rows).toHaveLength(50);
    expect(first.hasOlder).toBe(true);
    const second = await past(ca, first.rows[49].id);
    expect(second.rows).toHaveLength(3);
    expect(second.hasOlder).toBe(false);
    const ids = [...first.rows, ...second.rows].map((r: any) => r.id);
    expect(new Set(ids).size).toBe(53);
    // Newest first; within a shared timestamp, the larger id first.
    const expected = Array.from({ length: 53 }, (_, i) => ({ id: `e${String(i).padStart(2, "0")}`, k: Math.floor(i / 2) }))
      .sort((x, y) => y.k - x.k || (x.id < y.id ? 1 : -1))
      .map((x) => x.id);
    expect(ids).toEqual(expected);
    await expect(past(ca, "nope")).rejects.toThrow("Not found");
  });
});

describe("the content (§6.5)", () => {
  it("serves the practice locale, six feelings and five needs, the other label, limits, and no lexicon", async () => {
    const { ca } = await twoUsers();
    const fa = { ...ca, locale: "fa" };
    const c = await (Q.reflectContent as any)(null, {}, fa);
    expect(c.locale).toBe("en");
    expect(c.feelings).toHaveLength(6);
    expect(c.needs).toHaveLength(5);
    expect(c.otherLabel.length).toBeGreaterThan(0);
    expect(c.limits).toMatchObject({ scene: 140, story: 5000, momentsCap: 3, readingsCap: 3 });
    expect(Object.keys(c.prompts).sort()).toEqual(["close", "feelings", "interpretation", "reality", "story"]);
    expect(JSON.stringify(c)).not.toMatch(/lexicon|triggers/i);
    const home = await (Q.reflectHome as any)(null, {}, fa);
    expect(home.practiceLocale).toBe("en");
  });
});

describe("through the schema (AC-3 in practice)", () => {
  // Through the app's own server class, so the schema is built as it is in production.
  let current: any = null;
  const server = new ApolloServer({ typeDefs, resolvers, context: () => current });
  const run = async (userId: string, query: string, variables?: any) => {
    current = sessionCtx(userId);
    const r = await server.executeOperation({ query, variables });
    return { data: r.data, errors: r.errors };
  };

  it("round-trips the enums and cannot be asked for a hidden column", async () => {
    const { a } = await twoUsers();
    const s = await run(
      a.id,
      `mutation { startReflectEntry { id step createdAt moments { id } } }`
    );
    expect(s.errors).toBeUndefined();
    const entry = (s.data as any).startReflectEntry;
    expect(entry.step).toBe("PRECHECK");
    expect(entry.createdAt).toBe(T0.toISOString());

    const m = await run(
      a.id,
      `mutation($id: ID!) { saveReflectMoment(entryId: $id, position: 0, feeling: "tired", feelingSource: OWN, met: NOT_SURE) { moment { feelingSource met } fauxOffer { position } } }`,
      { id: entry.id }
    );
    expect(m.errors).toBeUndefined();
    expect((m.data as any).saveReflectMoment.moment).toEqual({ feelingSource: "OWN", met: "NOT_SURE" });

    const moved = await run(a.id, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: STORY) { entry { step } } }`, { id: entry.id });
    expect((moved.data as any).moveReflectEntry.entry.step).toBe("STORY");

    for (const field of ["precheckWhen", "precheckBefore", "afterAnswer", "outcome", "fauxSurfacedAt", "interpretationSurfacedAt", "lastCatchAt"]) {
      const r = await run(a.id, `query { reflectEntry { ${field} } }`);
      expect(r.errors?.[0]?.message).toMatch(/Cannot query field/);
    }
    const bad = await run(a.id, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: NOWHERE) { entry { step } } }`, { id: entry.id });
    expect(bad.errors).toBeDefined();
  });

  it("carries both offers, every field, through the transport (B3, verify)", async () => {
    const { a } = await twoUsers();
    const s = await run(a.id, `mutation { startReflectEntry { id } }`);
    const id = (s.data as any).startReflectEntry.id;
    await run(a.id, `mutation($id: ID!) { saveReflectEntry(entryId: $id, story: "We ate. She always leaves early.") { id } }`, { id });
    await run(a.id, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: STORY) { entry { step } } }`, { id });
    await run(a.id, `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: FEELINGS) { entry { step } } }`, { id });

    const m = await run(
      a.id,
      `mutation($id: ID!) { saveReflectMoment(entryId: $id, position: 0, feeling: "betrayed") { fauxOffer { position conceptId line feelingHints needHints feelingHintsLabel needHintsLabel dismiss note } } }`,
      { id }
    );
    expect(m.errors).toBeUndefined();
    const offer = (m.data as any).saveReflectMoment.fauxOffer;
    expect(offer).toMatchObject({ position: 0, conceptId: "betrayed" });
    for (const k of ["line", "feelingHintsLabel", "needHintsLabel", "dismiss", "note"]) expect(typeof offer[k]).toBe("string");
    expect(offer.feelingHints.length).toBeGreaterThan(0);

    const r = await run(
      a.id,
      `mutation($id: ID!) { moveReflectEntry(entryId: $id, to: REALITY) { entry { step } interpretationOffer { word sentence } } }`,
      { id }
    );
    expect(r.errors).toBeUndefined();
    expect((r.data as any).moveReflectEntry).toEqual({
      entry: { step: "REALITY" },
      interpretationOffer: { word: "always", sentence: "She always leaves early" },
    });
  });
});

describe("deleting (AC-7, D-1)", () => {
  it("removes an entry, open or closed, and its children", async () => {
    const { ca } = await twoUsers();
    const e = await start(ca);
    await moment(ca, e.id, 0);
    await reading(ca, e.id, 0);
    expect(await del(ca, e.id)).toBe(true);
    expect(await prisma.reflectEntry.count()).toBe(0);
    expect(await prisma.reflectMoment.count()).toBe(0);
    expect(await prisma.reflectReading.count()).toBe(0);

    const id = await closedWithStory(ca);
    expect(await del(ca, id)).toBe(true);
    expect(await prisma.reflectEntry.count()).toBe(0);
  });

  it("deleting the User removes every Reflect row (no deletion flow exists, D-1)", async () => {
    const { a, b, ca, cb } = await twoUsers();
    const e = await start(ca);
    await moment(ca, e.id, 0);
    await reading(ca, e.id, 0);
    const other = await start(cb);
    await moment(cb, other.id, 0);
    expect(await prisma.reflectState.count()).toBe(2);

    await prisma.user.delete({ where: { id: a.id } });
    expect(await prisma.reflectEntry.count({ where: { userId: a.id } })).toBe(0);
    expect(await prisma.reflectMoment.count({ where: { entryId: e.id } })).toBe(0);
    expect(await prisma.reflectReading.count({ where: { entryId: e.id } })).toBe(0);
    expect(await prisma.reflectState.count({ where: { userId: a.id } })).toBe(0);
    // The other person's rows stay.
    expect(await prisma.reflectEntry.count({ where: { userId: b.id } })).toBe(1);
    expect(await prisma.reflectMoment.count()).toBe(1);
    expect(await prisma.reflectState.count()).toBe(1);
  });
});
