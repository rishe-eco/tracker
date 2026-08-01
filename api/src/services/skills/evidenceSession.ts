/**
 * Evidence Lab session orchestration.
 *
 * Resolvers stay thin; the rules live here (convention #5). Two design points
 * worth knowing before changing anything:
 *
 * 1. **An attempt row is created when the item is served, not when it is
 *    submitted.** Check events are then timestamped by the server against that
 *    row. The ordering of "opened a check" versus "committed a verdict" *is* the
 *    measurement, so it must not be a number the client asserts at the end.
 *
 * 2. **Nothing that could reveal the answer leaves this file** — key, fault
 *    target, non-independent hosts and reveal text are all withheld until the
 *    verdict is committed.
 */

import type { PrismaClient } from "@prisma/client";
import { getEvidencePack, CURRENT_VERSION } from "../../content/skills";
import {
  isProbeReady,
  validateEvidenceContent,
  type ValidationIssue,
} from "../../content/skills/validate";
import {
  toPublicItem,
  type EvidenceModuleKey,
  type FaultTag,
  type Locale,
  type PublicEvidenceItem,
  type Verdict,
} from "../../content/skills/types";
import { scoreEvidenceItem, scoreSession, type CheckEventInput } from "./scoring";
import { evaluateMastery, type ScoredAttempt } from "./mastery";
import { nextReviewAt, onReviewFailed, onReviewPassed, toDayKey } from "./scheduler";
import { ensureProfile } from "./profile";
import { scheduleReviewAction } from "./planning";

export type SkillMode = "assessment" | "module" | "review" | "calibrated_practice" | "open_practice";

const SKILL: "evidence" = "evidence";

/** Frozen snapshots are an assessment property: probes must be reproducible. */
function usesFrozenSnapshot(mode: SkillMode): boolean {
  return mode === "assessment";
}

export { ensureProfile };

/**
 * Probe readiness, reported rather than assumed. An unverified key in a scored
 * probe does not fail loudly — it silently produces a wrong score and a wrong
 * conclusion — so the gate is explicit and the message says what to do about it.
 */
export function probeReadiness(): { ready: boolean; issues: ValidationIssue[]; blockers: string[] } {
  const issues = validateEvidenceContent();
  const blockers = issues
    .filter((i) => i.code === "key-unverified" || i.code === "snapshot-pending" || i.severity === "error")
    .map((i) => i.message);
  return { ready: isProbeReady(issues), issues, blockers };
}

export class ProbeNotReadyError extends Error {
  constructor(blockers: string[]) {
    super(
      "This content version cannot serve a scored assessment yet: " +
        `${blockers.length} item(s) still need a human to verify the answer key and freeze search results. ` +
        "Practice works today; the baseline unlocks when verification is done."
    );
    this.name = "ProbeNotReadyError";
  }
}

export type ServedItem = { attemptId: string; item: PublicEvidenceItem; isControlHidden: true };

/**
 * Pick the next item and open an attempt for it.
 *
 * Items already seen by this learner are excluded: an item is spent once it has
 * been revealed, and re-serving it measures memory rather than skill.
 */
export async function serveItem(
  prisma: PrismaClient,
  userId: string,
  mode: SkillMode,
  moduleKey?: EvidenceModuleKey | null
): Promise<ServedItem | null> {
  const profile = await ensureProfile(prisma, userId);
  const pack = getEvidencePack(profile.contentVersion, profile.locale as Locale);

  if (mode === "assessment") {
    const readiness = probeReadiness();
    if (!readiness.ready) throw new ProbeNotReadyError(readiness.blockers);
  }

  const seen = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL },
    select: { itemId: true },
  });
  const seenIds = new Set(seen.map((a) => a.itemId));

  const candidates = pack.items.filter((item) => {
    if (seenIds.has(item.itemId)) return false;
    if (mode === "assessment") return item.formId === "A";
    // Probe-pool items never appear in practice: an item seen in a drill is
    // spent for measurement.
    if (item.formId !== "pool") return false;
    return moduleKey ? item.moduleKey === moduleKey : true;
  });

  if (candidates.length === 0) return null;

  // Assessment follows the authored order so the form is administered
  // consistently; practice interleaves by difficulty.
  const chosen =
    mode === "assessment"
      ? candidates[0]
      : candidates.sort((a, b) => a.difficulty - b.difficulty)[0];

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: chosen.moduleKey,
      itemId: chosen.itemId,
      formId: chosen.formId,
      mode: mode as any,
      scores: "{}",
      contentVersion: profile.contentVersion,
      scoredBy: "behavior",
    },
  });

  return {
    attemptId: attempt.id,
    item: toPublicItem(chosen, { includeSnapshot: usesFrozenSnapshot(mode) }),
    isControlHidden: true,
  };
}

const VALID_EVENT_KINDS = new Set([
  "opened_sideways",
  "search_issued",
  "source_submitted",
  "verdict_set",
  "revealed",
]);

/**
 * Record a check event. The offset is measured server-side from when the item
 * was served — a client-supplied offset would make the primary outcome measure
 * self-reported.
 */
export async function logCheckEvent(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  kind: string,
  payload?: string | null
) {
  if (!VALID_EVENT_KINDS.has(kind)) throw new Error(`Unknown check event "${kind}".`);

  const attempt = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw new Error("Not found");

  const scores = JSON.parse(attempt.scores || "{}");
  if (scores.strict !== undefined) throw new Error("This attempt is already submitted.");

  await prisma.skillCheckEvent.create({
    data: {
      attemptId,
      kind,
      payload: payload ?? null,
      offsetMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
    },
  });
  return true;
}

export type SubmitInput = {
  verdict: Verdict;
  confidence: number;
  faultTag: FaultTag;
  sources: { url: string; snippet?: string | null }[];
  /** Learner's UTC offset in minutes, so "two calendar days" means two of theirs. */
  timeZoneOffsetMinutes?: number;
};

export type SubmitResult = {
  attemptId: string;
  lateral: number;
  independence: number;
  accuracy: number;
  traceQuality: number;
  strict: number;
  brier: number;
  timeToFirstCheckMs: number | null;
  falseAlarm: boolean;
  overTrust: boolean;
  correctVerdict: Verdict;
  reveal: string;
  moduleState: string;
  masteryUnmet: string[];
};

export async function submitAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  input: SubmitInput
): Promise<SubmitResult> {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: true },
  });
  if (!attempt || attempt.userId !== userId) throw new Error("Not found");

  const existing = JSON.parse(attempt.scores || "{}");
  if (existing.strict !== undefined) throw new Error("This attempt is already submitted.");

  const profile = await ensureProfile(prisma, userId);
  const pack = getEvidencePack(attempt.contentVersion, profile.locale as Locale);
  const spec = pack.items.find((i) => i.itemId === attempt.itemId);
  if (!spec) throw new Error(`Item "${attempt.itemId}" is not in content version ${attempt.contentVersion}.`);

  const events: CheckEventInput[] = attempt.checkEvents.map((e) => ({
    kind: e.kind,
    offsetMs: e.offsetMs,
  }));
  // The client tells us the verdict; the server decides when it was committed.
  if (!events.some((e) => e.kind === "verdict_set")) {
    events.push({ kind: "verdict_set", offsetMs: Math.max(0, Date.now() - attempt.createdAt.getTime()) });
  }

  const latencyMs = Math.max(0, Date.now() - attempt.createdAt.getTime());
  const score = scoreEvidenceItem(spec, { ...input, sources: input.sources ?? [], latencyMs }, events);

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseText: JSON.stringify({ verdict: input.verdict, faultTag: input.faultTag, sources: input.sources }),
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({ eventCount: events.length, latencyMs }),
      confidence: input.confidence,
      latencyMs,
    },
  });

  const moduleUpdate = await updateModuleProgress(
    prisma,
    userId,
    attempt.moduleKey as EvidenceModuleKey,
    input.timeZoneOffsetMinutes ?? 0
  );

  return {
    attemptId,
    ...score,
    correctVerdict: spec.key,
    reveal: spec.surface.reveal,
    moduleState: moduleUpdate.state,
    masteryUnmet: moduleUpdate.unmetCriteria,
  };
}

/** Recompute a module's state from its unscaffolded attempts. */
async function updateModuleProgress(
  prisma: PrismaClient,
  userId: string,
  moduleKey: EvidenceModuleKey,
  tzOffsetMinutes: number
) {
  const attempts = await prisma.skillAttempt.findMany({
    where: {
      userId,
      skillKey: SKILL,
      moduleKey,
      mode: { in: ["module", "review", "calibrated_practice"] as any },
    },
    orderBy: { createdAt: "asc" },
  });

  const scored: ScoredAttempt[] = attempts
    .map((a) => {
      const s = JSON.parse(a.scores || "{}");
      if (s.strict === undefined) return null;
      return { ...s, dayKey: toDayKey(a.createdAt, tzOffsetMinutes) } as ScoredAttempt;
    })
    .filter(Boolean) as ScoredAttempt[];

  const verdict = evaluateMastery(scored);
  const now = new Date();
  const seed = `${userId}:${moduleKey}`;

  const existing = await prisma.skillModuleProgress.findUnique({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
  });

  const state = verdict.mastered ? "mastered" : "in_progress";
  const data = {
    state: state as any,
    consecutiveAtCriterion: verdict.strictCount,
    lastCriterionDay: scored.length ? scored[scored.length - 1].dayKey : null,
    ...(verdict.mastered && {
      masteredAt: existing?.masteredAt ?? now,
      nextReviewAt: nextReviewAt(existing?.reviewIntervalIndex ?? 0, now, seed),
    }),
  };

  await prisma.skillModuleProgress.upsert({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
    create: { userId, skillKey: SKILL, moduleKey, ...data },
    update: data,
  });

  // Once a module is mastered its next review has a date. If the learner opted
  // into calendar planning, put it where they will actually see it — the review
  // queue is the part most likely to be quietly ignored otherwise. No-ops when
  // planning is off, and idempotent per module per day.
  if (verdict.mastered && data.nextReviewAt) {
    await scheduleReviewAction(prisma, userId, SKILL, moduleKey, data.nextReviewAt);
  }

  return { state, unmetCriteria: verdict.unmetCriteria };
}

export async function getModules(prisma: PrismaClient, userId: string) {
  const profile = await ensureProfile(prisma, userId);
  const pack = getEvidencePack(profile.contentVersion, profile.locale as Locale);
  const progress = await prisma.skillModuleProgress.findMany({
    where: { userId, skillKey: SKILL },
  });
  const byKey = new Map(progress.map((p) => [p.moduleKey, p]));
  const now = Date.now();

  return pack.modules.map((mod) => {
    const p = byKey.get(mod.moduleKey);
    const due = p?.nextReviewAt != null && p.nextReviewAt.getTime() <= now;
    return {
      moduleKey: mod.moduleKey,
      title: mod.title,
      concept: mod.concept,
      model: mod.model,
      state: due ? "due_review" : (p?.state ?? "not_started"),
      currentStep: p?.currentStep ?? 1,
      masteredAt: p?.masteredAt ?? null,
      nextReviewAt: p?.nextReviewAt ?? null,
    };
  });
}

export async function getProgress(prisma: PrismaClient, userId: string) {
  const profile = await ensureProfile(prisma, userId);
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL },
    orderBy: { createdAt: "asc" },
  });

  const scored = attempts
    .map((a) => JSON.parse(a.scores || "{}"))
    .filter((s) => s.strict !== undefined);

  const session = scoreSession(scored as any);
  const readiness = probeReadiness();

  return {
    skillKey: SKILL,
    contentVersion: profile.contentVersion,
    locale: profile.locale,
    reviewStatus: getEvidencePack(profile.contentVersion, profile.locale as Locale).reviewStatus,
    hasBaseline: profile.assessmentCompletedAt != null,
    assessmentSkipped: profile.assessmentSkipped,
    probeReady: readiness.ready,
    probeBlockers: readiness.blockers,
    calendarPlanningEnabled: profile.calendarPlanningEnabled,
    totalAttempts: scored.length,
    ...session,
  };
}

export { onReviewPassed, onReviewFailed };
