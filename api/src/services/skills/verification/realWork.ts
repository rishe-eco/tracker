/**
 * Real-work verification: the learner brings an actual AI output, states an
 * oracle in free text (no bench — the whole point is inventing one, not
 * picking from six), checks it *outside* the app, and pastes back what they
 * found. The result is a verification record — claim · oracle · result ·
 * verdict · residual risk — saveable as an ordinary `JournalEntry` or `Note`
 * through the existing generic mutations (`addQuickEntry`, `addNote`).
 *
 * Unlike Decomposition's real-work export, this mode writes nothing new into
 * Tracker itself and scores nothing: spec §5 item 6 and §8 are explicit that
 * the record is captured for the learner's own record and "never scored into
 * mastery or probes" — there is no partial credit here the way Decomposition's
 * D1/D2/D4 still apply to real material, because nothing here has a bench or
 * a rung to score against. `mode: open_practice` keeps it out of every trend
 * `getVerificationProgress` computes, the same guarantee Decomposition's own
 * real-work relies on.
 *
 * Tracker never runs the check (spec §8): no sandbox, no calculator, no
 * search proxy. The "result" field is always the learner's own paste-back.
 *
 * Spec: 04-verification-lab.md §5, §8; build plan §3 Phase 7.
 */

import type { PrismaClient } from "@prisma/client";
import { ensureProfile } from "../profile";
import type { Locale, Verdict } from "../../../content/skills/verification/types";

const SKILL = "verification" as const;
const ITEM_ID = "open-practice:verification";

export class VerificationRealWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationRealWorkError";
  }
}

export type VerificationRealWorkServedItem = { attemptId: string; claim: string };

export async function startVerificationRealWork(
  prisma: PrismaClient,
  userId: string,
  claim: string,
  locale: Locale
): Promise<VerificationRealWorkServedItem> {
  if (!claim.trim()) throw new VerificationRealWorkError("A claim cannot be empty.");
  const profile = await ensureProfile(prisma, userId, locale, SKILL);

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: null,
      itemId: ITEM_ID,
      mode: "open_practice",
      responseStructure: JSON.stringify({ claim }),
      scores: "{}",
      contentVersion: profile.contentVersion,
      scoredBy: "unscored",
    },
  });

  return { attemptId: attempt.id, claim };
}

export type VerificationRealWorkRecord = {
  claim: string;
  oracle: string;
  result: string;
  verdict: Verdict;
  residualRisk: string;
};

export type VerificationRealWorkInput = {
  oracle: string;
  result: string;
  verdict: Verdict;
  confidence: number;
  residualRisk: string;
};

export async function submitVerificationRealWork(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  input: VerificationRealWorkInput
): Promise<{ attemptId: string; record: VerificationRealWorkRecord }> {
  const attempt = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL || attempt.mode !== "open_practice") {
    throw new VerificationRealWorkError("Not found");
  }

  const existing = JSON.parse(attempt.responseStructure || "{}");
  if (existing.oracle) {
    throw new VerificationRealWorkError("This record is already complete.");
  }
  if (!input.oracle.trim()) throw new VerificationRealWorkError("An oracle cannot be empty.");
  if (!input.result.trim()) throw new VerificationRealWorkError("Paste back what you found before saving the record.");

  const record: VerificationRealWorkRecord = {
    claim: existing.claim,
    oracle: input.oracle,
    result: input.result,
    verdict: input.verdict,
    residualRisk: input.residualRisk,
  };

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseStructure: JSON.stringify(record),
      confidence: input.confidence,
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
    },
  });

  return { attemptId, record };
}
