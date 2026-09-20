/**
 * Noticing — the noticing loop (the spine).
 *
 * Spec §4.2, build plan §5 phase 3. The ~3-minute practice: place → person →
 * observation → need → an optional small thing. Plus the optional bounded
 * repeat, and the side-by-side recap. This is the phase that matters — if
 * the loop doesn't feel like noticing, no later phase rescues it (build plan
 * §9, §10).
 *
 * Modeled closely on `feelingsNeeds/session.ts`, including the three
 * structural rules it enforces here rather than in the UI, because a
 * guardrail the client owns is one refactor from gone. Shares no code with
 * it (build plan §3, §4) — everything below is written fresh against
 * Noticing's own model and content.
 *
 * 1. **Every step commits as it goes.** There is no "submit the loop" call.
 *    Partial state is valid state, which is what makes a sitting resumable
 *    and what stops a person losing a pass by closing a tab.
 * 2. **The repeat is soft-capped.** `addPass` refuses past `DIALS.repeat.softCap`.
 *    The bound is what keeps a plural sitting from becoming an inventory of
 *    people, not a distributed noticing practice.
 * 3. **Passes are never related to one another.** Nothing in this file reads
 *    one pass while writing another, and the recap returns them as a flat
 *    list. Relating them is a later act's job, not this one's.
 *
 * One deliberate divergence from the Feelings & Needs precedent:
 * `startSitting` does **not** gate on the day-one frame. `isFrameDone` is
 * informational only (`state.ts`) — the frame is a rehearsal of the loop's
 * own inference, not a precondition for it (spec §4.1, build plan §5
 * ordering notes). Module 1 gates; this deliberately does not.
 */

import type { PrismaClient } from "@prisma/client";
import {
  DIALS,
  getNoticingPack,
  toPublicPack,
  type Locale,
  type NoticingPack,
} from "../../content/noticing";
import { computeFadeLevel, ensureNoticingState } from "./state";
import { withUserLock } from "../userLock";

/**
 * The pack for this person, in the language they are reading the app in.
 *
 * The *version* is pinned per user at `NoticingState.contentVersion` — the
 * place/cue/need vocabulary someone is building familiarity with should not
 * change under them mid-practice (build plan §3). The *locale* is not
 * pinned: it is whatever language the request arrived in
 * (`graphql/requestLocale.ts`), the same reasoning as Feelings & Needs.
 */
async function packFor(prisma: PrismaClient, userId: string, locale: Locale): Promise<NoticingPack> {
  const state = await ensureNoticingState(prisma, userId);
  return getNoticingPack(state.contentVersion, locale);
}

/**
 * Sittings the person actually finished.
 *
 * Only completed ones count — an opened-and-abandoned sitting is not a rep.
 * Feeds the fade level (build plan §6 delta 2) and the need rotation below.
 * Never shown to anyone; this number is a routing input, not a metric.
 */
export function countCompletedSittings(prisma: PrismaClient, userId: string) {
  return prisma.noticingSitting.count({ where: { userId, completedAt: { not: null } } });
}

// ─── Content + the display selection ─────────────────────────────────────────

/**
 * Choose which `DIALS.needs.displayCount` of the pool to put on screen.
 *
 * Places and cues are shown whole — the pool equals the display count for
 * both (build plan §4 leaves them small on purpose). Needs are not: the pool
 * is 20, wide specifically to cover the three directions build plan §4
 * requires, and the screen shows 6. A static "always the first six" would
 * mean fourteen of the twenty authored needs — including some of the
 * invite-no-offer ones the pool exists to carry — never appear at all, which
 * would quietly defeat the reason the pool is that wide.
 *
 * So: a plain round-robin, keyed on completed sittings. Deterministic, not
 * random — the point (as with Module 1's palette) is that a reshuffle on
 * every screen would stop someone building familiarity with their own
 * words. Not tier-weighted like Module 1's feelings, because none of
 * Noticing's needs are "advanced" (build plan §4) — there is no early/
 * broaden split to honor, just even coverage of the pool over time. Stable
 * for the whole sitting (keyed on *completed* sittings, which doesn't change
 * mid-sitting) and NOT narrowed by the chosen place (spec §4.2 — pruning the
 * answer is worse than pre-seeding the question).
 */
export function selectNeedIds(pack: NoticingPack, completedSittings: number): string[] {
  const count = DIALS.needs.displayCount;
  const pool = pack.needs;
  if (pool.length <= count) return pool.map((n) => n.id);
  return Array.from({ length: count }, (_, i) => pool[(completedSittings + i) % pool.length].id);
}

/**
 * Serve the loop copy at the person's current fade level (build plan §6
 * delta 2, mirroring Feelings & Needs' P7 mechanism). Done server-side so
 * the client never implements the withdrawal itself.
 *
 * One threshold, not two — a deliberate simplification against the Feelings
 * & Needs precedent, not an oversight: Module 1's loop carries a helper line
 * under several prompts, and its fade withdraws that first, then switches to
 * terse prompts at a second, later level. Noticing's loop has no helper line
 * to withdraw — every step is one line by design (spec §4.2's table; "if a
 * step needs a paragraph of explanation, the step is wrong"). So there is
 * nothing to drop before the terse swap, and `level <= 0` is the only
 * distinction that means anything here.
 */
function serveLoopCopy(loop: NoticingPack["loop"], level: number): NoticingPack["loop"] {
  if (level <= 0) return loop;
  return {
    ...loop,
    placePrompt: loop.placePromptTerse,
    personPrompt: loop.personPromptTerse,
    observationPrompt: loop.observationPromptTerse,
    needPrompt: loop.needPromptTerse,
  };
}

export async function getContent(prisma: PrismaClient, userId: string, locale: Locale) {
  const pack = await packFor(prisma, userId, locale);
  const completedSittings = await countCompletedSittings(prisma, userId);
  const fadeLevel = computeFadeLevel(completedSittings);
  const publicPack = toPublicPack(pack);

  return {
    ...publicPack,
    loop: serveLoopCopy(pack.loop, fadeLevel),
    display: { needIds: selectNeedIds(pack, completedSittings) },
    /** So the UI can retire "see someone else today?" rather than fail on it. */
    repeatSoftCap: DIALS.repeat.softCap,
    // Reshaped for the GraphQL surface (NtcCapacityCopy): the content module
    // keeps `chips` as a Record for authoring convenience, but SDL has no
    // arbitrary-key map type, so this is three named lists instead.
    capacity: {
      prompt: publicPack.capacity.prompt,
      headChips: publicPack.capacity.chips.head,
      handsChips: publicPack.capacity.chips.hands,
      heartChips: publicPack.capacity.chips.heart,
      otherLabel: publicPack.capacity.otherLabel,
    },
    // Same reason: GraphQL field names can't be snake_case-and-camelCase at
    // once, so `lineByGuess.not_very` becomes `notVery` at this boundary.
    frame: {
      ...publicPack.frame,
      beatTwo: {
        ...publicPack.frame.beatTwo,
        correction: {
          ...publicPack.frame.beatTwo.correction,
          lineByGuess: {
            notVery: publicPack.frame.beatTwo.correction.lineByGuess.not_very,
            somewhat: publicPack.frame.beatTwo.correction.lineByGuess.somewhat,
            very: publicPack.frame.beatTwo.correction.lineByGuess.very,
          },
        },
      },
    },
  };
}

// ─── Sittings and passes ─────────────────────────────────────────────────────

const SITTING_WITH_ENTRIES = {
  entries: { orderBy: { passIndex: "asc" } },
} as const;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The sitting still open, if there is one.
 *
 * Only today's counts as resumable. A sitting abandoned days ago is not a
 * thing to drop someone back into — the moment it was about is gone, and
 * reopening it would ask them to describe a place and person from memory of
 * a memory. Older open sittings are left exactly as they are; nothing
 * cleans them up, because an abandoned pass is honest data about how the
 * loop is used.
 */
export async function getActiveSitting(prisma: PrismaClient, userId: string) {
  return prisma.noticingSitting.findFirst({
    where: { userId, completedAt: null, createdAt: { gte: startOfToday() } },
    // Oldest first, matching how `startSitting` picks a winner when opens
    // race, so the two never disagree about which sitting is the live one.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: SITTING_WITH_ENTRIES,
  });
}

/** A pass with nothing in it — the shape a just-opened sitting starts in. */
function isBlankEntry(e: {
  place: string | null;
  person: string | null;
  observation: string | null;
  need: string | null;
  smallThing: string | null;
}) {
  return !e.place && !e.person && !e.observation && !e.need && !e.smallThing;
}

/**
 * The person's own record of their own sittings.
 *
 * A record, and deliberately nothing more — this is the dossier fence
 * (spec §4.3): no grouping or filtering by person, no search, no computed
 * pattern across entries. Returns finished sittings in reverse chronological
 * order and computes nothing; grouping into days is the client's job
 * because a day is a local-timezone concept the server does not know.
 *
 * Only completed sittings appear. A sitting someone abandoned halfway is not
 * something to show back as though it were a finished entry.
 */
export async function getHistory(prisma: PrismaClient, userId: string, limit = 50) {
  return prisma.noticingSitting.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: SITTING_WITH_ENTRIES,
  });
}

/**
 * Open a sitting and its first pass. Not gated on the day-one frame — see
 * the file docblock. `wasPrompted` records whether the app cued this, input
 * to the fade-level inference (phase 7), never a metric.
 */
export async function startSitting(
  prisma: PrismaClient,
  userId: string,
  opts: { wasPrompted?: boolean } = {}
) {
  await ensureNoticingState(prisma, userId);

  // Serialize opens per user with the shared in-process lock (userLock.ts,
  // the same guard the gather race and Feelings & Needs' sitting-open use —
  // D-57). Makes the check-then-insert below atomic within the process, so
  // two concurrent opens can't both read "nothing active" and both insert.
  return withUserLock(`ntc-sitting:${userId}`, async () => {
    // Resuming beats starting over: a second sitting opened while one is
    // still open would split one practice across two rows.
    const existing = await getActiveSitting(prisma, userId);
    if (existing) return existing;

    // No unique constraint could arbitrate a duplicate — a user may
    // legitimately have many sittings — so if two ever do land (only
    // possible across processes now the lock is in place), converge:
    // everyone inserts, then everyone independently agrees on the same
    // winner (the oldest open sitting) and clears the blank duplicates.
    const created = await prisma.noticingSitting.create({
      data: {
        userId,
        wasPrompted: opts.wasPrompted ?? false,
        entries: { create: { passIndex: 0 } },
      },
      include: SITTING_WITH_ENTRIES,
    });

    const open = await prisma.noticingSitting.findMany({
      where: { userId, completedAt: null, createdAt: { gte: startOfToday() } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: SITTING_WITH_ENTRIES,
    });
    if (open.length <= 1) return created;

    const [winner, ...rest] = open;
    // Only ever discard sittings that hold nothing. A duplicate with content
    // in it is not a duplicate — it is someone's practice, and losing it
    // would be far worse than the stray row this is cleaning up.
    const discardable = rest.filter((s) => s.entries.every(isBlankEntry));
    if (discardable.length) {
      await prisma.noticingSitting.deleteMany({ where: { id: { in: discardable.map((s) => s.id) } } });
    }

    return winner;
  });
}

/** Load a sitting the caller owns, or throw the indistinguishable "Not found". */
async function ownedSitting(prisma: PrismaClient, userId: string, sittingId: string) {
  const sitting = await prisma.noticingSitting.findUnique({
    where: { id: sittingId },
    include: SITTING_WITH_ENTRIES,
  });
  if (!sitting || sitting.userId !== userId) throw new Error("Not found");
  return sitting;
}

export type EntryPatch = {
  place?: string | null;
  person?: string | null;
  observation?: string | null;
  need?: string | null;
  smallThing?: string | null;
};

/**
 * Commit one step of one pass.
 *
 * Ownership is inherited from the sitting — `NoticingEntry` carries no
 * `userId` of its own — so the check has to walk up to the sitting rather
 * than trust the entry.
 *
 * Returns a result object (`{ sitting, catch }`) rather than the sitting
 * directly, on purpose: phase 5 adds catch detection here (the field
 * contract already lives on the content spec as `matchesFields`, so the
 * matcher reads it rather than reimplements it), and shaping the return as
 * a result now means that lands as an additive change, not a breaking one.
 * `catch` is always `null` until then.
 */
export async function updateEntry(
  prisma: PrismaClient,
  userId: string,
  entryId: string,
  patch: EntryPatch
) {
  const entry = await prisma.noticingEntry.findUnique({
    where: { id: entryId },
    include: { sitting: { select: { userId: true, completedAt: true } } },
  });
  if (!entry || entry.sitting.userId !== userId) throw new Error("Not found");
  if (entry.sitting.completedAt) {
    throw new Error("This sitting is already finished.");
  }

  const trim = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null;

  await prisma.noticingEntry.update({
    where: { id: entryId },
    data: {
      place: trim(patch.place),
      person: trim(patch.person),
      observation: trim(patch.observation),
      need: trim(patch.need),
      smallThing: trim(patch.smallThing),
    },
  });

  const sitting = await prisma.noticingSitting.findUniqueOrThrow({
    where: { id: entry.sittingId },
    include: SITTING_WITH_ENTRIES,
  });

  return { sitting, catch: null as null };
}

/**
 * Add another pass, for a second distinct person.
 *
 * Refuses past the soft cap. The cap is the whole reason the repeat is safe
 * to offer: without it, "see someone else today?" turns a three-minute
 * practice into an inventory of everyone around the person, which is
 * exactly the dossier shape the tool exists to avoid. The new pass carries
 * nothing over from the previous one.
 */
export async function addPass(prisma: PrismaClient, userId: string, sittingId: string) {
  const sitting = await ownedSitting(prisma, userId, sittingId);
  if (sitting.completedAt) throw new Error("This sitting is already finished.");

  if (sitting.entries.length >= DIALS.repeat.softCap) {
    throw new Error("That's plenty for one sitting.");
  }

  const nextIndex = Math.max(...sitting.entries.map((e) => e.passIndex)) + 1;
  await prisma.noticingEntry.create({ data: { sittingId, passIndex: nextIndex } });

  return prisma.noticingSitting.findUniqueOrThrow({
    where: { id: sittingId },
    include: SITTING_WITH_ENTRIES,
  });
}

/**
 * Close the sitting.
 *
 * Drops any trailing pass the person opened and left completely blank, so
 * tapping "see someone else today?" and changing your mind doesn't leave an
 * empty row in what the recap shows back.
 *
 * The one-time graduation door (phase 7) is deliberately not checked here —
 * `finishSitting` returns only `{ sitting }` for now, and phase 7 adds a
 * `graduation` field the same additive way phase 5 adds `catch` above.
 */
export async function finishSitting(prisma: PrismaClient, userId: string, sittingId: string) {
  const sitting = await ownedSitting(prisma, userId, sittingId);
  if (sitting.completedAt) return { sitting };

  const trailing = sitting.entries[sitting.entries.length - 1];
  if (sitting.entries.length > 1 && trailing && isBlankEntry(trailing)) {
    await prisma.noticingEntry.delete({ where: { id: trailing.id } });
  }

  const completed = await prisma.noticingSitting.update({
    where: { id: sittingId },
    data: { completedAt: new Date() },
    include: SITTING_WITH_ENTRIES,
  });

  return { sitting: completed };
}
