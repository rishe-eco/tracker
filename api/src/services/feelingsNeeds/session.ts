/**
 * Feelings & Needs — the daily loop (the spine).
 *
 * Plan §4.2. The ~3-minute practice: settle → notice the body (P2) → name the
 * feeling (P3) → the need underneath (P4) → an optional small step. Plus the
 * optional bounded repeat for plural feelings, and the side-by-side recap.
 *
 * Three structural rules are enforced here rather than left to the UI, because
 * a guardrail the client owns is a guardrait one refactor from gone:
 *
 * 1. **Every step commits as it goes** (convention #8). There is no "submit the
 *    loop" call. Partial state is valid state, which is what makes a sitting
 *    resumable and what stops a person losing a pass by closing a tab.
 * 2. **The repeat is soft-capped.** `addPass` refuses past the dial. The bound
 *    is what keeps a plural sitting from becoming an open-ended emotional
 *    inventory — the rumination the "keep moving" guard exists to prevent.
 * 3. **Passes are never related to one another.** Nothing in this file reads one
 *    pass while writing another, and the recap returns them as a flat list.
 *    Relating them is storytelling (P6, tier 4) and is deferred.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CURRENT_VERSION,
  DIALS,
  getFeelingsNeedsPack,
  toPublicPack,
  type FeelingsNeedsPack,
  type Locale,
} from "../../content/feelings-needs";
import { computeFadeLevel, ensureLoopState, isFrameDone } from "./state";
import { maybeCatch, type SurfacedCatch } from "./distinctions";

/**
 * The pack for this person, in the language they are reading the app in.
 *
 * Two axes, and they answer to different things. The *version* is pinned per
 * user at `LoopState.contentVersion` — the words you have been building
 * familiarity with should not change under you mid-practice (P3). The *locale*
 * is not pinned: it is whatever language the request arrived in, because the
 * authority on that is the app the person is looking at, not a column
 * (`graphql/requestLocale.ts`).
 */
async function packFor(
  prisma: PrismaClient,
  userId: string,
  locale: Locale
): Promise<FeelingsNeedsPack> {
  const state = await ensureLoopState(prisma, userId);
  return getFeelingsNeedsPack(state.contentVersion, locale);
}

/**
 * Sittings the person actually finished.
 *
 * Only completed ones count. An opened-and-abandoned sitting is not a rep, and
 * letting it count would drift both things that read this number: the palette
 * would broaden before the person has had their early wins (P1), and later the
 * prompt-fade inference (P7) would read abandonment as practice. Not a metric
 * either way — this number is never shown to anyone.
 */
export function countCompletedSittings(prisma: PrismaClient, userId: string) {
  return prisma.loopSitting.count({ where: { userId, completedAt: { not: null } } });
}

// ─── Content + the display selection ─────────────────────────────────────────

/**
 * Choose which palette words to put on screen.
 *
 * The pool is authored wide enough to name anger and shame; the screen stays
 * small so it reads as a handful of words rather than a menu to browse. Early
 * sittings draw only from the `early` (pleasant / met-need) tier — the first
 * loops need to land a word and produce a felt win, because that win is what
 * installs the malleability belief (P1). After `earlyWinLoops`, the broaden tier
 * mixes in.
 *
 * Deterministic, not random: a palette that reshuffles every sitting would stop
 * the person building familiarity with their own words, which is the thing P3 is
 * actually training.
 */
function selectFeelingIds(pack: FeelingsNeedsPack, sittingCount: number): string[] {
  const count = DIALS.palette.feelingDisplayCount;
  const early = pack.feelings.filter((f) => f.tier === "early");
  const broaden = pack.feelings.filter((f) => f.tier === "broaden");

  if (sittingCount < DIALS.palette.earlyWinLoops) {
    return early.slice(0, count).map((f) => f.id);
  }

  // Past the early window, weight toward the broaden tier — that is where the
  // material of a hard day lives — while keeping a couple of pleasant words so
  // the palette can still name a good moment.
  const keepEarly = 2;
  const rotate = sittingCount - DIALS.palette.earlyWinLoops;
  const pick = <T,>(xs: T[], n: number, offset: number) =>
    Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(offset + i) % xs.length]);

  return [
    ...pick(early, keepEarly, rotate).map((f) => f.id),
    ...pick(broaden, count - keepEarly, rotate).map((f) => f.id),
  ];
}

/**
 * The body-location chips.
 *
 * `hard_to_place` is always among them, and that is not a display preference.
 * P2's third failure mode is going blank at "where do you feel it", and the
 * mechanism requires that be handled as **information, not failure** — for a
 * high-alexithymia person the sensation may genuinely be faint. Taking the first
 * N of the pool quietly dropped it off the end, which left the one person who
 * most needed an answer with none.
 */
export function selectLocationIds(pack: FeelingsNeedsPack): string[] {
  const escape = "hard_to_place";
  const count = DIALS.palette.locationDisplayCount;
  const rest = pack.locations.filter((l) => l.id !== escape).slice(0, count - 1);
  return [...rest.map((l) => l.id), escape];
}

/**
 * Serve the loop copy at the person's current fade level.
 *
 * Done server-side so the client never implements the withdrawal itself — the
 * fade is the mechanism, and a client that decided when to stop explaining
 * would be a second, silent copy of the dial.
 *
 * Level 0 is the copy as authored. Level 1 stops sending the helper lines.
 * Level 2 and up switch to the terse prompts as well. Nothing announces any of
 * this; the app simply says less, which is the whole idea.
 */
function fadeLoopCopy(loop: FeelingsNeedsPack["loop"], level: number): FeelingsNeedsPack["loop"] {
  if (level <= 0) return loop;

  const faded = {
    ...loop,
    placeHelper: null,
    textureHelper: null,
    breatheHint: level >= 2 ? null : loop.breatheHint,
  };
  if (level < 2) return faded;

  return {
    ...faded,
    placePrompt: loop.placePromptTerse,
    texturePrompt: loop.texturePromptTerse,
    namePrompt: loop.namePromptTerse,
    needPrompt: loop.needPromptTerse,
  };
}

export async function getContent(prisma: PrismaClient, userId: string, locale: Locale) {
  const pack = await packFor(prisma, userId, locale);
  const sittingCount = await countCompletedSittings(prisma, userId);
  const fadeLevel = computeFadeLevel(sittingCount);

  return {
    ...toPublicPack(pack),
    loop: fadeLoopCopy(pack.loop, fadeLevel),
    display: {
      locationIds: selectLocationIds(pack),
      textureIds: pack.textures.slice(0, DIALS.palette.textureDisplayCount).map((t) => t.id),
      feelingIds: selectFeelingIds(pack, sittingCount),
      needIds: pack.needs.slice(0, DIALS.palette.needDisplayCount).map((n) => n.id),
    },
    /** The soft cap, so the UI can retire "add another" rather than fail on it. */
    repeatSoftCap: DIALS.repeat.softCap,
    breathSkippable: DIALS.breath.skippable,
  };
}

// ─── Sittings and passes ─────────────────────────────────────────────────────

const SITTING_WITH_ENTRIES = {
  entries: { orderBy: { passIndex: "asc" } },
} as const;

/**
 * The sitting still open, if there is one.
 *
 * Only today's counts as resumable. A sitting abandoned days ago is not a thing
 * to drop someone back into mid-sentence — the felt moment it was about is gone,
 * and reopening it would ask them to report a feeling they are no longer having.
 * Older open sittings are simply left as they are; nothing cleans them up,
 * because an abandoned pass is honest data about how the loop is used.
 */
export async function getActiveSitting(prisma: PrismaClient, userId: string) {
  return prisma.loopSitting.findFirst({
    where: { userId, completedAt: null, createdAt: { gte: startOfToday() } },
    // Oldest first, matching how `startSitting` picks a winner when opens race,
    // so the two never disagree about which sitting is the live one.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: SITTING_WITH_ENTRIES,
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** A pass with nothing in it — the shape a just-opened sitting starts in. */
function isBlankEntry(e: {
  bodyLocation: string | null;
  bodyTexture: string | null;
  feelingWord: string | null;
  need: string | null;
  smallAction: string | null;
}) {
  return !e.bodyLocation && !e.bodyTexture && !e.feelingWord && !e.need && !e.smallAction;
}

/**
 * The person's own record of their own sittings.
 *
 * A record, and deliberately nothing more. Plan §2 puts **pattern-recognition
 * across entries** out of scope for this build, and the line between "here is
 * what you wrote" and "here is what we noticed about you" is the line this
 * function stays on the near side of: it returns finished sittings in reverse
 * chronological order and computes nothing. No totals, no gaps highlighted, no
 * "you tend to…", no comparison between days. Grouping into days is the
 * client's job because a day is a local-timezone concept and the server does
 * not know the person's offset.
 *
 * Only completed sittings appear. A sitting someone abandoned halfway is not
 * something to show them back as though it were an entry.
 */
export async function getHistory(prisma: PrismaClient, userId: string, limit = 50) {
  return prisma.loopSitting.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: SITTING_WITH_ENTRIES,
  });
}

/**
 * Open a sitting and its first pass.
 *
 * A sitting always has at least one pass, so the wizard never has to handle an
 * empty one. `wasPrompted` records whether the app cued this — the input to
 * prompt-fade inference (P7), not a metric.
 */
export async function startSitting(
  prisma: PrismaClient,
  userId: string,
  opts: { wasPrompted?: boolean } = {}
) {
  await ensureLoopState(prisma, userId);

  // The Day-1 frame gates the loop (plan §4.1; required-once and not skippable,
  // §11.4). Enforced here rather than by hiding a button, for the same reason
  // the soft cap is: the guardrail should survive a client that forgets it.
  //
  // The gate is about sequence, not permission — the frame is what makes the
  // loop legible, so running the loop first would spend the person's first
  // reps on a practice whose point hasn't landed yet.
  if (!(await isFrameDone(prisma, userId))) {
    throw new Error("Start with the Day-1 frame — it's the on-ramp to this loop.");
  }

  // Resuming beats starting over: a second sitting opened while one is still
  // open would split one practice across two rows.
  //
  const existing = await getActiveSitting(prisma, userId);
  if (existing) return existing;

  // Two concurrent opens both reach here having found nothing, and both insert.
  // A double-invoked mount effect does exactly that, leaving an empty sitting
  // nobody ever fills.
  //
  // Neither obvious defence works. `LoopSitting` has no unique constraint that
  // could arbitrate — a user may legitimately have many sittings — so there is
  // nothing to recover from the way `ensureLoopState` recovers from P2002. And
  // an interactive transaction is worse than useless on this stack: Prisma
  // holds SQLite's single connection for the life of the transaction, so
  // concurrent callers cannot even begin one and simply time out.
  //
  // So converge instead of lock. Everyone inserts, then everyone independently
  // agrees on the same winner — the oldest open sitting — and clears the blank
  // duplicates. The rule is deterministic, so racers reach the same answer
  // without coordinating, and `deleteMany` makes doing it twice harmless.
  const created = await prisma.loopSitting.create({
    data: {
      userId,
      wasPrompted: opts.wasPrompted ?? false,
      entries: { create: { passIndex: 0 } },
    },
    include: SITTING_WITH_ENTRIES,
  });

  const open = await prisma.loopSitting.findMany({
    where: { userId, completedAt: null, createdAt: { gte: startOfToday() } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: SITTING_WITH_ENTRIES,
  });
  if (open.length <= 1) return created;

  const [winner, ...rest] = open;
  // Only ever discard sittings that hold nothing. A duplicate with content in
  // it is not a duplicate — it is someone's practice, and losing it would be
  // far worse than the stray row this is cleaning up.
  const discardable = rest.filter(
    (s) => !s.breathTaken && s.entries.every(isBlankEntry)
  );
  if (discardable.length) {
    await prisma.loopSitting.deleteMany({ where: { id: { in: discardable.map((s) => s.id) } } });
  }

  return winner;
}

/** Load a sitting the caller owns, or throw the indistinguishable "Not found". */
async function ownedSitting(prisma: PrismaClient, userId: string, sittingId: string) {
  const sitting = await prisma.loopSitting.findUnique({
    where: { id: sittingId },
    include: SITTING_WITH_ENTRIES,
  });
  if (!sitting || sitting.userId !== userId) throw new Error("Not found");
  return sitting;
}

/**
 * Mark the settling breath taken.
 *
 * There is deliberately no duration and no way to fail it. The breath is a
 * threshold into the practice, not a timer — if it starts reading as something
 * to complete, it has become the meditation feature this module is not.
 */
export async function setBreath(prisma: PrismaClient, userId: string, sittingId: string) {
  await ownedSitting(prisma, userId, sittingId);
  return prisma.loopSitting.update({
    where: { id: sittingId },
    data: { breathTaken: true },
    include: SITTING_WITH_ENTRIES,
  });
}

export type EntryPatch = {
  bodyLocation?: string | null;
  bodyTexture?: string | null;
  feelingWord?: string | null;
  feelingSource?: string | null;
  need?: string | null;
  needSource?: string | null;
  smallAction?: string | null;
};

/**
 * `catch` is not decoration. P5's observable signal is that the person catches
 * *some of their own* faux-feelings, so a word that arrived through the catch
 * has to stay distinguishable from one they reached for unaided — otherwise the
 * only evidence that the mechanism worked is indistinguishable from evidence
 * that it was never needed.
 */
const SOURCES = new Set(["palette", "own", "catch"]);

/**
 * Commit one step of one pass.
 *
 * Ownership is inherited from the sitting — `LoopEntry` carries no `userId` of
 * its own, the same arrangement `SkillCheckEvent` has with its attempt — so the
 * check has to walk up to the sitting rather than trust the entry.
 */
export async function updateEntry(
  prisma: PrismaClient,
  userId: string,
  entryId: string,
  patch: EntryPatch,
  locale: Locale
) {
  const entry = await prisma.loopEntry.findUnique({
    where: { id: entryId },
    include: { sitting: { select: { userId: true, completedAt: true } } },
  });
  if (!entry || entry.sitting.userId !== userId) throw new Error("Not found");
  if (entry.sitting.completedAt) {
    throw new Error("This sitting is already finished.");
  }

  for (const [field, value] of [
    ["feelingSource", patch.feelingSource],
    ["needSource", patch.needSource],
  ] as const) {
    if (value != null && !SOURCES.has(value)) {
      throw new Error(`${field} must be one of: ${[...SOURCES].join(", ")}.`);
    }
  }

  const trim = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null;

  await prisma.loopEntry.update({
    where: { id: entryId },
    data: {
      bodyLocation: trim(patch.bodyLocation),
      bodyTexture: trim(patch.bodyTexture),
      feelingWord: trim(patch.feelingWord),
      feelingSource: patch.feelingSource ?? undefined,
      need: trim(patch.need),
      needSource: patch.needSource ?? undefined,
      smallAction: trim(patch.smallAction),
    },
  });

  // The catch (P5) fires on the feeling, at the moment it is named — that
  // timing is the mechanism, not a UX preference. Only on a *fresh* naming:
  // a word arriving from the catch itself, or the person re-committing the
  // same pass, must not re-trigger it. And never on a palette pick, which by
  // construction cannot be a faux-feeling.
  let surfaced: SurfacedCatch | null = null;
  const namingAfresh =
    patch.feelingWord !== undefined &&
    patch.feelingSource !== "catch" &&
    !entry.distinctionCaught;

  if (namingAfresh) {
    // The person's own language: a faux-feeling is detected in the words they
    // actually typed, so the detector has to be the one for that language.
    const pack = await packFor(prisma, userId, locale);
    surfaced = await maybeCatch(prisma, userId, pack, trim(patch.feelingWord));
    if (surfaced) {
      await prisma.loopEntry.update({
        where: { id: entryId },
        data: { distinctionCaught: true },
      });
    }
  }

  const sitting = await prisma.loopSitting.findUniqueOrThrow({
    where: { id: entry.sittingId },
    include: SITTING_WITH_ENTRIES,
  });

  return { sitting, catch: surfaced };
}

/**
 * Add another pass, for a second distinct feeling.
 *
 * Refuses past the soft cap. The cap is the whole reason the repeat is safe to
 * offer: without it, "add another" turns a three-minute practice into an
 * inventory of everything wrong today, which is the shape the module exists to
 * avoid. The new pass carries nothing over from the previous one.
 */
export async function addPass(prisma: PrismaClient, userId: string, sittingId: string) {
  const sitting = await ownedSitting(prisma, userId, sittingId);
  if (sitting.completedAt) throw new Error("This sitting is already finished.");

  if (sitting.entries.length >= DIALS.repeat.softCap) {
    throw new Error("That's plenty for one sitting.");
  }

  const nextIndex = Math.max(...sitting.entries.map((e) => e.passIndex)) + 1;
  await prisma.loopEntry.create({ data: { sittingId, passIndex: nextIndex } });

  return prisma.loopSitting.findUniqueOrThrow({
    where: { id: sittingId },
    include: SITTING_WITH_ENTRIES,
  });
}

/**
 * Close the sitting.
 *
 * Drops any trailing pass the person opened and left completely blank, so
 * tapping "add another" and changing your mind doesn't leave an empty row in
 * what the recap shows back.
 */
/**
 * Whether the one-time capability moment is due (P7).
 *
 * Inferred from prompt-withdrawal plus continued engagement — the person is
 * still running the loop while the app has been saying steadily less — and
 * never from a tally of unprompted runs. Counting self-initiation is the single
 * worst place in the product to hang a metric: extrinsic markers corrode
 * intrinsic motivation worst for the already-motivated, and a run you tally in
 * the app is no longer an unprompted run (decision-log 2026-08-01).
 *
 * Note the honest limit. Without any cue mechanism — no notifications, nothing
 * that nudges — the demo cannot observe the other half of P7, the loop firing
 * from a life context rather than the app. That unobservability is accepted by
 * design rather than manufactured away, which is exactly what a streak would be.
 */
async function graduationDue(prisma: PrismaClient, userId: string): Promise<boolean> {
  const state = await ensureLoopState(prisma, userId);
  if (state.graduationSurfaced) return false;
  const completed = await countCompletedSittings(prisma, userId);
  return computeFadeLevel(completed) >= DIALS.graduation.graduationFadeLevel;
}

/**
 * Mark the door walked through.
 *
 * Acknowledged explicitly rather than marked on display, so someone who closes
 * the tab mid-moment does not silently lose the only time it was ever going to
 * be offered. Idempotent, and there is nothing behind it to increment.
 */
export async function acknowledgeGraduation(prisma: PrismaClient, userId: string) {
  await ensureLoopState(prisma, userId);
  await prisma.loopState.update({
    where: { userId },
    data: { graduationSurfaced: true },
  });
  return true;
}

export async function finishSitting(
  prisma: PrismaClient,
  userId: string,
  sittingId: string,
  locale: Locale
) {
  const sitting = await ownedSitting(prisma, userId, sittingId);
  if (sitting.completedAt) return { sitting, graduation: null };

  const trailing = sitting.entries[sitting.entries.length - 1];
  if (sitting.entries.length > 1 && trailing && isBlankEntry(trailing)) {
    await prisma.loopEntry.delete({ where: { id: trailing.id } });
  }

  const completed = await prisma.loopSitting.update({
    where: { id: sittingId },
    data: { completedAt: new Date() },
    include: SITTING_WITH_ENTRIES,
  });

  // Checked after the sitting closes, so this one counts toward it — the moment
  // lands on the run that earned it rather than the one after.
  const pack = await packFor(prisma, userId, locale);
  const due = await graduationDue(prisma, userId);

  return { sitting: completed, graduation: due ? pack.graduation : null };
}
