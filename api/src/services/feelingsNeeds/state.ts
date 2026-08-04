/**
 * Feelings & Needs — per-user state.
 *
 * Its own module (mirroring `services/skills/profile.ts`) because the loop
 * runner, the frame, and the graduation logic all need the state and importing
 * it between them would cycle.
 *
 * The demo is English-only (plan §2). Locale is fixed to "en" here rather than
 * stored per-user: the `fa` surface is deferred, so there is nothing yet to
 * choose between. When Persian lands, a `locale` column joins LoopState — the
 * content already splits spec/surface so that is the only change needed.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CURRENT_VERSION,
  DIALS,
  getFeelingsNeedsPack,
  type Locale,
} from "../../content/feelings-needs";

/**
 * How far the app has withdrawn its own prompts (P7).
 *
 * Derived from finished practice, never stored — see the note on `LoopState`.
 * Capped at the graduation dial: past that point there is nothing left to
 * withdraw, and a number that kept climbing would be a score in everything but
 * name.
 *
 * Lives here rather than beside the loop because both the session runner and
 * the tool-home state need it, and importing one into the other would cycle.
 */
export function computeFadeLevel(completedSittings: number): number {
  const raw = Math.floor(completedSittings / DIALS.graduation.sittingsPerFadeStep);
  return Math.min(raw, DIALS.graduation.graduationFadeLevel);
}

/**
 * Look the LoopState up, creating it on first contact.
 *
 * Create-then-recover rather than `upsert`, for the same reason `ensureProfile`
 * does it: the tool home may fire more than one query in parallel on a brand-new
 * account, both find nothing, both insert, and the loser hits the `userId`
 * unique constraint. Losing the race is the ordinary outcome, not an error —
 * re-read the winner's row.
 */
export async function ensureLoopState(prisma: PrismaClient, userId: string) {
  const existing = await prisma.loopState.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.loopState.create({
      data: { userId, contentVersion: CURRENT_VERSION },
    });
  } catch (e: any) {
    if (e?.code !== "P2002") throw e;
    const created = await prisma.loopState.findUnique({ where: { userId } });
    if (!created) throw e;
    return created;
  }
}

export type FeelingsNeedsState = {
  contentVersion: string;
  /** The language the *content* came back in — see the note on `reviewStatus`. */
  locale: Locale;
  reviewStatus: "draft" | "reviewed";
  frameDone: boolean;
  graduationSurfaced: boolean;
  /**
   * How far the app has withdrawn its own prompts. Derived, not stored, and
   * capped — it is a dial the app reads, never a level the person is shown.
   */
  promptFadeLevel: number;
  /** Total sittings so far. A count for routing, never surfaced as a streak. */
  sittingCount: number;
};

/** The tool home's state: enough to route into the frame or the loop, no more. */
export async function getFeelingsNeedsState(
  prisma: PrismaClient,
  userId: string,
  locale: Locale
): Promise<FeelingsNeedsState> {
  const state = await ensureLoopState(prisma, userId);
  const pack = getFeelingsNeedsPack(state.contentVersion, locale);
  // Completed only — see countCompletedSittings. An abandoned sitting is not a rep.
  const sittingCount = await prisma.loopSitting.count({
    where: { userId, completedAt: { not: null } },
  });

  return {
    contentVersion: state.contentVersion,
    locale,
    reviewStatus: pack.reviewStatus,
    frameDone: await isFrameDone(prisma, userId),
    graduationSurfaced: state.graduationSurfaced,
    promptFadeLevel: computeFadeLevel(sittingCount),
    sittingCount,
  };
}

/**
 * Whether the Day-1 frame has been done.
 *
 * Derived from the FrameCompletion row rather than a flag kept beside it. The
 * row is the event — it carries the fact and the timestamp — and a boolean
 * mirroring it would only ever be a second thing to forget to write.
 */
export async function isFrameDone(prisma: PrismaClient, userId: string): Promise<boolean> {
  const done = await prisma.frameCompletion.findUnique({
    where: { userId },
    select: { userId: true },
  });
  return done !== null;
}

/**
 * Record the Day-1 frame as done. Idempotent — the frame happens once, and a
 * double submit is a double-click, not a second frame.
 */
export async function completeFrame(prisma: PrismaClient, userId: string, locale: Locale) {
  await ensureLoopState(prisma, userId);
  await prisma.frameCompletion.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return getFeelingsNeedsState(prisma, userId, locale);
}
