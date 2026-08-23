/**
 * Real-work delegation: the only mode in this engine that spans two
 * sittings by design (spec §5 item 6, §8). Before a real decision, the
 * learner logs what they're about to hand over, what they're keeping, and
 * what would tell them the split was wrong. Later — after the outcome is
 * known — they come back and record what actually happened.
 *
 * Never scored: there is no key, no WOA, nothing to weigh — the whole point
 * is the prediction itself, made before the outcome exists. `mode:
 * open_practice` keeps it out of every trend `getDelegationProgress`
 * computes, the same guarantee every other tool's real-work mode relies on.
 * Saveable as an ordinary `JournalEntry` or `Note` through the existing
 * generic mutations (`addQuickEntry`, `addNote`) — this writes nothing new
 * into Tracker itself, the lighter Phase 6 pattern Verification's Phase 7
 * set (D-36), not Decomposition's (which creates real Projects/Actions).
 *
 * Spec: 05-delegation-lab.md §5, §8; build plan §3 Phase 6.
 */

import type { PrismaClient } from "@prisma/client";
import { ensureProfile } from "../profile";
import type { Locale } from "../../../content/skills/delegation/types";

const SKILL = "delegation" as const;
const ITEM_ID = "open-practice:delegation";

export class DelegationRealWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelegationRealWorkError";
  }
}

export type DelegationRealWorkServedItem = {
  attemptId: string;
  handingOver: string;
  keeping: string;
  wouldTellMeWrong: string;
};

export async function startDelegationRealWork(
  prisma: PrismaClient,
  userId: string,
  handingOver: string,
  keeping: string,
  wouldTellMeWrong: string,
  locale: Locale
): Promise<DelegationRealWorkServedItem> {
  if (!handingOver.trim()) throw new DelegationRealWorkError("What you're handing over cannot be empty.");
  if (!keeping.trim()) throw new DelegationRealWorkError("What you're keeping cannot be empty.");
  if (!wouldTellMeWrong.trim()) throw new DelegationRealWorkError("What would tell you the split was wrong cannot be empty.");

  const profile = await ensureProfile(prisma, userId, locale, SKILL);

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: null,
      itemId: ITEM_ID,
      mode: "open_practice",
      responseStructure: JSON.stringify({ handingOver, keeping, wouldTellMeWrong }),
      scores: "{}",
      contentVersion: profile.contentVersion,
      scoredBy: "unscored",
    },
  });

  return { attemptId: attempt.id, handingOver, keeping, wouldTellMeWrong };
}

export type DelegationRealWorkRecord = {
  handingOver: string;
  keeping: string;
  wouldTellMeWrong: string;
  whatActuallyHappened: string;
};

export async function submitDelegationRealWork(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  whatActuallyHappened: string
): Promise<{ attemptId: string; record: DelegationRealWorkRecord }> {
  const attempt = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL || attempt.mode !== "open_practice") {
    throw new DelegationRealWorkError("Not found");
  }

  const existing = JSON.parse(attempt.responseStructure || "{}");
  if (existing.whatActuallyHappened) {
    throw new DelegationRealWorkError("This record is already complete.");
  }
  if (!whatActuallyHappened.trim()) throw new DelegationRealWorkError("What actually happened cannot be empty.");

  const record: DelegationRealWorkRecord = {
    handingOver: existing.handingOver,
    keeping: existing.keeping,
    wouldTellMeWrong: existing.wouldTellMeWrong,
    whatActuallyHappened,
  };

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseStructure: JSON.stringify(record),
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
    },
  });

  return { attemptId, record };
}
