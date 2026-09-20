/**
 * Noticing — per-user state.
 *
 * Its own module (mirroring `services/feelingsNeeds/state.ts`), because the
 * session runner (phase 3), the frame (phase 4) and the graduation logic
 * (phase 7) all need it and importing it between them would cycle. Shares no
 * code with `services/feelingsNeeds/` (build plan §3).
 *
 * The prototype is English-only. Locale is fixed to "en" here rather than
 * stored per-user, same reasoning as Feelings & Needs: the `fa` surface is a
 * declared draft, so there is nothing yet to choose between.
 *
 * Unlike `FeelingsNeedsState`, `NoticingState` (the GraphQL type) carries no
 * sitting count — build plan §7's sketch omits it deliberately, and the
 * house rule for this tool is stricter than Module 1's: no counter, streak,
 * total or tally field in any Noticing model, type or resolver. Completed
 * sittings are still read here to derive the fade level, but that number is
 * never returned to the caller.
 */

import type { PrismaClient } from "@prisma/client";
import { CURRENT_VERSION, DIALS, getNoticingPack, type Locale } from "../../content/noticing";

/**
 * How far the app has withdrawn its own prompts (build plan §6 delta 2,
 * mirroring Feelings & Needs' P7 exactly).
 *
 * Derived from finished sittings, never stored — a cached number beside the
 * sittings is a number that can disagree with them. Capped at the graduation
 * dial: past that point there is nothing left to withdraw, and a number that
 * kept climbing would be a score in everything but name.
 */
export function computeFadeLevel(completedSittings: number): number {
  const raw = Math.floor(completedSittings / DIALS.graduation.sittingsPerFadeStep);
  return Math.min(raw, DIALS.graduation.graduationFadeLevel);
}

/**
 * Look the NoticingState up, creating it on first contact.
 *
 * Create-then-recover rather than `upsert`: the tool home may fire more than
 * one query in parallel on a brand-new account, both find nothing, both
 * insert, and the loser hits the `userId` unique constraint. Losing that race
 * is the ordinary outcome, not an error — re-read the winner's row.
 */
export async function ensureNoticingState(prisma: PrismaClient, userId: string) {
  const existing = await prisma.noticingState.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.noticingState.create({
      data: { userId, contentVersion: CURRENT_VERSION },
    });
  } catch (e: any) {
    if (e?.code !== "P2002") throw e;
    const created = await prisma.noticingState.findUnique({ where: { userId } });
    if (!created) throw e;
    return created;
  }
}

/**
 * Whether the day-one frame has been done.
 *
 * Checks `completedAt`, not row existence. The frame's five steps commit as
 * they go (same convention as `NoticingSitting`), so the row exists from
 * beat 1 step 1 onward — a row-existence check would report "done" the
 * moment someone typed a first line and walked away. `completedAt` is the
 * event; nothing mirrors it elsewhere, so there is nothing else to keep in
 * sync. (This was wrong in phase 1 — `completedAt` defaulted on create,
 * which made it indistinguishable from row existence. Fixed in phase 2 with
 * a migration; see notes/noticing-build-log.md.)
 *
 * Informational only: per spec §4.1 and build plan §5 phase 4, this does
 * **not** gate the loop. Someone can run the loop having never done the
 * frame; the frame is a rehearsal of the loop's own inference, not a
 * precondition for it (build plan §5, ordering notes).
 */
export async function isFrameDone(prisma: PrismaClient, userId: string): Promise<boolean> {
  const frame = await prisma.noticingFrame.findUnique({
    where: { userId },
    select: { completedAt: true },
  });
  return frame?.completedAt != null;
}

// ─── The day-one frame (tier 1, once) ────────────────────────────────────────

export type FrameStepPatch = {
  moment?: string | null;
  unsaidNeed?: string | null;
  visibleCues?: string | null;
  wishedInstead?: boolean;
  welcomeGuess?: string | null;
};

/**
 * The frame's own progress row, for resuming mid-frame. Null means the
 * frame has never been started — a different fact from `isFrameDone`
 * returning false, which also covers "started but not finished."
 */
export function getFrameProgress(prisma: PrismaClient, userId: string) {
  return prisma.noticingFrame.findUnique({ where: { userId } });
}

/**
 * Commit one step of the day-one frame. Creates the row on first call (beat
 * 1 step 1), the same commit-as-you-go convention as `NoticingSitting` /
 * `NoticingEntry` — there is no "submit the frame" mutation, so a closed tab
 * loses at most the step in progress.
 *
 * Refuses to touch a completed frame rather than silently reopening it. The
 * client should never route a finished frame back into the wizard, but the
 * guard holds even if it does — same reasoning as `updateEntry`'s guard on a
 * finished sitting.
 */
export async function updateFrameStep(prisma: PrismaClient, userId: string, patch: FrameStepPatch) {
  const existing = await prisma.noticingFrame.findUnique({ where: { userId } });
  if (existing?.completedAt) {
    throw new Error("The day-one frame is already complete.");
  }

  const trim = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null;

  const data = {
    moment: trim(patch.moment),
    unsaidNeed: trim(patch.unsaidNeed),
    visibleCues: trim(patch.visibleCues),
    wishedInstead: patch.wishedInstead,
    welcomeGuess: trim(patch.welcomeGuess),
  };

  if (existing) {
    return prisma.noticingFrame.update({ where: { userId }, data });
  }

  try {
    return await prisma.noticingFrame.create({ data: { userId, ...data } });
  } catch (e: any) {
    if (e?.code !== "P2002") throw e;
    // Same create-then-recover race as `ensureNoticingState`: two step-1
    // commits fired in parallel both find nothing and both insert.
    return prisma.noticingFrame.update({ where: { userId }, data });
  }
}

/**
 * Mark the day-one frame complete. Idempotent — a double submit is a
 * double-click, not a second frame. Sets `completedAt` only if it isn't
 * already set, so a second call can never disagree with the first about
 * when the frame actually finished.
 */
export async function completeNoticingFrame(prisma: PrismaClient, userId: string, locale: Locale) {
  const frame = await prisma.noticingFrame.findUnique({ where: { userId } });
  // The frame commits as it goes — a row that doesn't exist yet means beat 1
  // step 1 never ran, and there is nothing to mark complete.
  if (!frame) throw new Error("Not found");
  if (!frame.completedAt) {
    await prisma.noticingFrame.update({ where: { userId }, data: { completedAt: new Date() } });
  }
  return getNoticingState(prisma, userId, locale);
}

export type NoticingState = {
  contentVersion: string;
  /** The language the *content* came back in — see the note on `reviewStatus`. */
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  frameDone: boolean;
  graduationSurfaced: boolean;
  /**
   * How far the app has withdrawn its own prompts. Derived, not stored, and
   * capped — a dial the app reads, never a level the person is shown.
   */
  promptFadeLevel: number;
};

/** The tool home's state: enough to route into the frame or the loop, no more. */
export async function getNoticingState(
  prisma: PrismaClient,
  userId: string,
  locale: Locale
): Promise<NoticingState> {
  const state = await ensureNoticingState(prisma, userId);
  const pack = getNoticingPack(state.contentVersion, locale);
  // Completed only — an abandoned sitting is not a rep (build plan §9.5).
  // Read here to derive the fade level; never returned as its own field.
  const completedSittings = await prisma.noticingSitting.count({
    where: { userId, completedAt: { not: null } },
  });

  return {
    contentVersion: state.contentVersion,
    locale,
    reviewStatus: pack.reviewStatus,
    frameDone: await isFrameDone(prisma, userId),
    graduationSurfaced: state.graduationSurfaced,
    promptFadeLevel: computeFadeLevel(completedSittings),
  };
}
