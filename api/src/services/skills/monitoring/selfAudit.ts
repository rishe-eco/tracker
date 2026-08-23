/**
 * Session self-audit: the retention feature (spec §8, item type 6; build
 * plan Phase 6). The learner reviews one of their own real AI conversations
 * against the four influence types this tool's transcripts are built from —
 * flattery, an anchor, a smuggled premise, an agreement reversal — and
 * writes a short note on each. `mode: open_practice`, excluded from every
 * mastery/progress total the same way every other tool's real-work mode is.
 *
 * Unlike Delegation's real-work record (D-42), this is a single sitting, not
 * two — spec §8 describes one pass over one conversation, not a
 * before/after pair spanning an outcome that hasn't happened yet. It still
 * follows the engine's own start/submit convention rather than one combined
 * call, for the same reason every other mode does: `SkillAttempt` rows are
 * created once and updated once, never assembled client-side and posted in
 * a single shot.
 *
 * The four questions are the four `PlantedInfluenceType` values from
 * `content/skills/monitoring/types.ts` (this file's own resolution: spec §8
 * names "the four influence types" without listing them, and s4/s5's own
 * planted-influence taxonomy is the only four-item list in this tool that
 * fits). Nothing here is scored — there is no key for a learner's own real
 * conversation — and it writes nothing new into Tracker directly, saved
 * through the existing `addQuickEntry`/`addNote` mutations exactly like
 * Delegation's and Verification's real-work records.
 *
 * Spec: 06-monitoring-lab.md §5, §8; build plan Phase 6.
 */

import type { PrismaClient } from "@prisma/client";
import { ensureProfile } from "../profile";
import type { Locale } from "../../../content/skills/monitoring/types";

const SKILL = "monitoring" as const;
const ITEM_ID = "open-practice:monitoring-self-audit";

export const SELF_AUDIT_QUESTION_KEYS = ["flattery", "anchor", "smuggled_premise", "agreement_reversal"] as const;
export type SelfAuditQuestionKey = (typeof SELF_AUDIT_QUESTION_KEYS)[number];

export class MonitoringSelfAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitoringSelfAuditError";
  }
}

export type MonitoringSelfAuditServedItem = { attemptId: string; questionKeys: readonly SelfAuditQuestionKey[] };

export async function startMonitoringSelfAudit(prisma: PrismaClient, userId: string, locale: Locale): Promise<MonitoringSelfAuditServedItem> {
  const profile = await ensureProfile(prisma, userId, locale, SKILL);

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: null,
      itemId: ITEM_ID,
      mode: "open_practice",
      responseStructure: "{}",
      scores: "{}",
      contentVersion: profile.contentVersion,
      scoredBy: "unscored",
    },
  });

  return { attemptId: attempt.id, questionKeys: SELF_AUDIT_QUESTION_KEYS };
}

export type MonitoringSelfAuditRecord = Record<SelfAuditQuestionKey, string>;

export async function submitMonitoringSelfAudit(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  answers: MonitoringSelfAuditRecord
): Promise<{ attemptId: string; record: MonitoringSelfAuditRecord }> {
  const attempt = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL || attempt.mode !== "open_practice") {
    throw new MonitoringSelfAuditError("Not found");
  }

  const existing = JSON.parse(attempt.responseStructure || "{}");
  if (Object.keys(existing).length > 0) {
    throw new MonitoringSelfAuditError("This record is already complete.");
  }
  for (const key of SELF_AUDIT_QUESTION_KEYS) {
    if (!answers[key]?.trim()) throw new MonitoringSelfAuditError(`An answer for "${key}" cannot be empty.`);
  }

  const record: MonitoringSelfAuditRecord = {
    flattery: answers.flattery,
    anchor: answers.anchor,
    smuggled_premise: answers.smuggled_premise,
    agreement_reversal: answers.agreement_reversal,
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
