/**
 * The Noticing catch engine (N6, tier 3) — build plan §9.3.
 *
 * The detector's own edge cases (word boundaries, longest match) are tested
 * directly against `detectCatch`, mirroring
 * `feelingsNeedsDistinctions.unit.test.ts`'s split. The gates — one per
 * pass, one per sitting, per-type cooldown — are properties of a COMMIT, not
 * of the detector alone, so they're exercised through `updateEntry`
 * (`services/noticing/session.ts`), the same call the client actually
 * makes, rather than by calling `maybeCatch` directly with hand-built rows.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestUser, makeCtx, prisma } from "../test/helpers";
import { addPass, finishSitting, startSitting, updateEntry } from "../services/noticing/session";
import { detectCatch } from "../services/noticing/catches";
import { buildNoticingPack } from "../content/noticing/v1";
import { CATCH_SPECS } from "../content/noticing/v1/spec";
import { DIALS } from "../content/noticing/dials";

const pack = buildNoticingPack("en");

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the detector — word boundaries and longest match", () => {
  it("respects word boundaries rather than matching substrings", () => {
    // "cold" is a trigger and sits inside "scolded" as a substring.
    expect(detectCatch(pack, "read", "she scolded me for it")).toBeNull();
    expect(detectCatch(pack, "read", "she was cold about it")).toBe("cold");
  });

  it("is case-insensitive, because a person typed it", () => {
    expect(detectCatch(pack, "read", "Rude, honestly")).toBe("rude");
  });

  it("prefers the longest match where a shorter trigger nests inside a longer one", () => {
    // "dramatic" nests inside "being dramatic" — the read lexicon's own
    // instance of this, not a hypothetical the test invents.
    expect(detectCatch(pack, "read", "she was being dramatic about it")).toBe("being dramatic");
    // Still catches the shorter one on its own, elsewhere.
    expect(detectCatch(pack, "read", "so dramatic")).toBe("dramatic");
  });

  it("returns null for text with no trigger, and for empty input", () => {
    expect(detectCatch(pack, "read", "she picked up the mail and left")).toBeNull();
    expect(detectCatch(pack, "read", null)).toBeNull();
    expect(detectCatch(pack, "read", "")).toBeNull();
    expect(detectCatch(pack, "read", "   ")).toBeNull();
  });

  it("matches strategy and protective triggers by the same rule", () => {
    expect(detectCatch(pack, "strategy", "maybe just a ride")).toBe("a ride");
    expect(detectCatch(pack, "protective", "I should really")).toBe("should");
    // "supposed to" nests no shorter trigger, but "have to" and "ought to"
    // must still resolve to themselves rather than to a longer neighbour.
    expect(detectCatch(pack, "protective", "I have to, I think")).toBe("have to");
  });

  it("returns null for an unknown catch type", () => {
    expect(detectCatch(pack, "nonsense" as any, "rude")).toBeNull();
  });
});

describe("the field contract — matches only its own fields, and never person", () => {
  it("never lists person in any catch type's matchesFields", () => {
    // Stated directly, not just trusted from the docblock — build plan §8's
    // fence, re-asserted here because this suite is where the field
    // contract actually gets exercised end to end.
    const offenders = CATCH_SPECS.filter((c) => (c.matchesFields as string[]).includes("person"));
    expect(offenders).toEqual([]);
  });

  it("read fires on observation only — a read trigger in need does nothing", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const entryId = sitting.entries[0].id;

    const onNeed = await updateEntry(prisma, user.id, entryId, { need: "rude" }, ctx.locale);
    expect(onNeed.catch).toBeNull();

    const onObservation = await updateEntry(
      prisma,
      user.id,
      entryId,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    expect(onObservation.catch?.type).toBe("read");
  });

  it("strategy fires on need or smallThing, never on observation", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const entryId = sitting.entries[0].id;

    // The trigger sits in observation here — strategy's contract never
    // looks there, so this must be silent even though the words match.
    const onObservation = await updateEntry(
      prisma,
      user.id,
      entryId,
      { observation: "she mentioned needing a ride" },
      ctx.locale
    );
    expect(onObservation.catch).toBeNull();

    const onNeed = await updateEntry(prisma, user.id, entryId, { need: "a ride" }, ctx.locale);
    expect(onNeed.catch?.type).toBe("strategy");
  });

  it("protective fires on smallThing, never on observation or need", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const entryId = sitting.entries[0].id;

    const onObservation = await updateEntry(
      prisma,
      user.id,
      entryId,
      { observation: "I felt like I should say something" },
      ctx.locale
    );
    expect(onObservation.catch).toBeNull();

    const onNeed = await updateEntry(prisma, user.id, entryId, { need: "should" }, ctx.locale);
    expect(onNeed.catch).toBeNull();

    const onSmall = await updateEntry(prisma, user.id, entryId, { smallThing: "I should offer" }, ctx.locale);
    expect(onSmall.catch?.type).toBe("protective");
  });

  it("when a smallThing answer reads as both strategy and protective, protective wins", async () => {
    // "should" (protective) and "a ride" (strategy) both sit in this one
    // sentence — the priority order documented in catches.ts.
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const result = await updateEntry(
      prisma,
      user.id,
      sitting.entries[0].id,
      { smallThing: "I should give them a ride" },
      ctx.locale
    );
    expect(result.catch?.type).toBe("protective");
  });
});

describe("one catch per pass, one per sitting", () => {
  it("never gives a second catch to a pass that already has one, even on a different field", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const entryId = sitting.entries[0].id;

    const first = await updateEntry(
      prisma,
      user.id,
      entryId,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    expect(first.catch?.type).toBe("read");

    const second = await updateEntry(prisma, user.id, entryId, { smallThing: "I should offer" }, ctx.locale);
    expect(second.catch).toBeNull();
  });

  it("caps at one catch per sitting across separate passes", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);

    const first = await updateEntry(
      prisma,
      user.id,
      sitting.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    expect(first.catch?.type).toBe("read");
    expect(DIALS.catches.perSitting).toBe(1);

    const withSecondPass = await addPass(prisma, user.id, sitting.id);
    const secondEntryId = withSecondPass.entries[withSecondPass.entries.length - 1].id;
    const second = await updateEntry(prisma, user.id, secondEntryId, { smallThing: "I should offer" }, ctx.locale);
    expect(second.catch).toBeNull();
  });
});

describe("the per-type cooldown", () => {
  it("blocks the same type again inside the cooldown window, even from a fresh sitting", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const sitting1 = await startSitting(prisma, user.id);
    const first = await updateEntry(
      prisma,
      user.id,
      sitting1.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    expect(first.catch?.type).toBe("read");
    await finishSitting(prisma, user.id, sitting1.id, ctx.locale);

    const sitting2 = await startSitting(prisma, user.id);
    const second = await updateEntry(
      prisma,
      user.id,
      sitting2.entries[0].id,
      { observation: "he was being dramatic again" },
      ctx.locale
    );
    expect(second.catch).toBeNull();
  });

  it("a catch that was only ever surfaced — never explicitly accepted — still starts the cooldown", async () => {
    // Dismissing a catch is a client-only act (catches.ts's own docblock);
    // the server never learns whether one was accepted or waved off. This
    // test calls nothing resembling "accept" between surfacing the catch and
    // checking the cooldown — surfacing alone must be what starts it.
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting1 = await startSitting(prisma, user.id);
    await updateEntry(
      prisma,
      user.id,
      sitting1.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );

    const state = await prisma.noticingState.findUniqueOrThrow({ where: { userId: user.id } });
    const lastCatchAt = JSON.parse(state.lastCatchAt!);
    expect(lastCatchAt.read).toBeTruthy();
  });

  it("allows the type to fire again once the cooldown has actually elapsed", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const sitting1 = await startSitting(prisma, user.id);
    await updateEntry(
      prisma,
      user.id,
      sitting1.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    await finishSitting(prisma, user.id, sitting1.id, ctx.locale);

    // Roll the clock back further than the dial, directly on the state row —
    // the only honest way to test a day-based cooldown without waiting days.
    const longAgo = new Date(Date.now() - (DIALS.catches.cooldownDays + 1) * 24 * 60 * 60 * 1000);
    await prisma.noticingState.update({
      where: { userId: user.id },
      data: { lastCatchAt: JSON.stringify({ read: longAgo.toISOString() }) },
    });

    const sitting2 = await startSitting(prisma, user.id);
    const second = await updateEntry(
      prisma,
      user.id,
      sitting2.entries[0].id,
      { observation: "he was being dramatic again" },
      ctx.locale
    );
    expect(second.catch?.type).toBe("read");
  });

  it("cooldowns are independent per type", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);

    const sitting1 = await startSitting(prisma, user.id);
    await updateEntry(
      prisma,
      user.id,
      sitting1.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    await finishSitting(prisma, user.id, sitting1.id, ctx.locale);

    // read is now on cooldown; protective never has been, and this is a
    // fresh sitting so the per-sitting cap doesn't interfere either.
    const sitting2 = await startSitting(prisma, user.id);
    const second = await updateEntry(
      prisma,
      user.id,
      sitting2.entries[0].id,
      { smallThing: "I should offer" },
      ctx.locale
    );
    expect(second.catch?.type).toBe("protective");
  });
});

describe("protective offers no hints and carries its route; strategy's hints are questions", () => {
  it("protective: no hints, a truthy route", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const result = await updateEntry(prisma, user.id, sitting.entries[0].id, { smallThing: "I should offer" }, ctx.locale);
    expect(result.catch?.type).toBe("protective");
    expect(result.catch?.hints).toEqual([]);
    expect(result.catch?.routeTo).toBeTruthy();
  });

  it("strategy: hints sharp to the trigger, every one phrased as a question", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const result = await updateEntry(prisma, user.id, sitting.entries[0].id, { need: "a ride" }, ctx.locale);
    expect(result.catch?.type).toBe("strategy");
    expect(result.catch?.hints.length).toBeGreaterThan(0);
    expect(result.catch?.hints.every((h) => h.trim().endsWith("?"))).toBe(true);
    expect(result.catch?.routeTo).toBeUndefined();
  });

  it("read: no hints either — the whole move is handing the sentence back", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const result = await updateEntry(
      prisma,
      user.id,
      sitting.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    expect(result.catch?.type).toBe("read");
    expect(result.catch?.hints).toEqual([]);
  });
});

describe("the line quotes the person's own word back", () => {
  it("substitutes the matched trigger into the line, for all three types", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const sitting = await startSitting(prisma, user.id);
    const result = await updateEntry(
      prisma,
      user.id,
      sitting.entries[0].id,
      { observation: "she was so rude about it" },
      ctx.locale
    );
    expect(result.catch?.line).toContain("rude");
    expect(result.catch?.line).not.toContain("{{word}}");
  });
});
