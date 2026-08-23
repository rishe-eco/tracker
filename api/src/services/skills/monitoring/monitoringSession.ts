/**
 * Monitoring Lab session orchestration. Mirrors `delegationSession.ts`'s
 * shape; what's specific here:
 *
 * 1. **The ordering rule the whole tool rests on.** `prediction_committed`
 *    must be server-stamped before the answer field exists in any payload —
 *    the answer is never IN the served item at all (unlike Delegation's
 *    advice, which is withheld but does exist on the item). `answerVariants`
 *    never leaves this file.
 * 2. **A resolved ordering conflict in `s2-explain` (D-45).** Spec §5 item 3
 *    lists "rate, explain, select steps, re-rate," but §10 requires the
 *    re-rating to happen "before the authored steps are shown" — the two
 *    can't both be literally true if `commitMonitoringExplanation` returns
 *    the step list immediately. Resolved by enforcing the re-rating
 *    ("after") before `selectMonitoringSteps` will accept a selection: the
 *    client receives the step list from `commitMonitoringExplanation` but
 *    must commit the "after" rating before the server accepts a step
 *    selection, so the rating always happens before the learner has acted
 *    on the revealed list.
 * 3. **`s1-access` pairs are two independent items, not one served twice**
 *    (content types.ts's header note) — each half is its own attempt.
 * 4. **A checkpoint-review event beyond the build plan's illustrative
 *    table (D-45).** `s6-complacency`'s check-rate needs per-checkpoint
 *    events to compute first-third/last-third decay; `markMonitoringCheckpoint`
 *    fills that gap the same way Verification Lab's `loadVerificationElements`
 *    filled one in the build plan's own table (D-34's precedent).
 *
 * Spec: 06-monitoring-lab.md; build plan §3.
 */

import type { PrismaClient } from "@prisma/client";
import {
  PREDICTION_ORDINAL,
  toPublicMonitoringItem,
  type MonitoringItemSpec,
  type MonitoringItemSurface,
  type MonitoringModuleKey,
  type Locale,
  type PairHalf,
  type PredictionLevel,
  type PublicMonitoringItem,
} from "../../../content/skills/monitoring/types";
import { buildMonitoringPack, COUNTERMEASURE_HAS_TRIGGER, ITEM_SPEC_BY_ID, RUBRIC_VERSION } from "../../../content/skills/monitoring/v1";
import { ensureProfile } from "../profile";
import { scheduleOnMastery, toDayKey } from "../scheduler";
import { loadServingProbe } from "../probes";
import type { MasteryGap } from "../mastery";
import { matchAnswer } from "./answerMatch";
import { computeGamma } from "./gamma";
import { checkRateDecay, computeBias, inflationFor } from "./metrics";
import {
  assembleExplainScore,
  assembleLongsetScore,
  assembleTranscriptScore,
  type MonitoringScore,
} from "./scoring";
import { evaluateAccessMastery, evaluateKeyedMastery, evaluateResolutionMastery } from "./mastery";

const SKILL = "monitoring" as const;
const CLEAN_TRANSCRIPT_MODULES: readonly MonitoringModuleKey[] = ["s4-agreement", "s5-anchor"];

export type MonitoringMode = "assessment" | "module" | "review" | "calibrated_practice" | "open_practice";

export class MonitoringSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitoringSequenceError";
  }
}

type PackItem = MonitoringItemSpec & { surface: MonitoringItemSurface };

async function loadPack(prisma: PrismaClient, userId: string, locale: Locale) {
  const profile = await ensureProfile(prisma, userId, locale, SKILL);
  const pack = buildMonitoringPack(locale);
  return { profile, pack };
}

function specFor(itemId: string): MonitoringItemSpec {
  const spec = ITEM_SPEC_BY_ID.get(itemId);
  if (!spec) throw new Error(`Monitoring item "${itemId}" is not in this content version.`);
  return spec;
}

function findItem(items: PackItem[], itemId: string): PackItem {
  const item = items.find((i) => i.itemId === itemId);
  if (!item) throw new Error(`Monitoring item "${itemId}" is not in this content version.`);
  return item;
}

// ─── Serving ────────────────────────────────────────────────────────────────

export type ServedMonitoringItem = { attemptId: string; item: PublicMonitoringItem };

export async function startMonitoringItem(
  prisma: PrismaClient,
  userId: string,
  mode: MonitoringMode,
  moduleKey: MonitoringModuleKey | null,
  locale: Locale,
  probeId?: string | null
): Promise<ServedMonitoringItem | null> {
  const { profile, pack } = await loadPack(prisma, userId, locale);

  let formId: "A" | "B" | "C" = "A";
  if (mode === "assessment") {
    if (!probeId) throw new MonitoringSequenceError("An assessment item must be served inside a probe — call startSkillProbe first.");
    const probe = await loadServingProbe(prisma, userId, SKILL, probeId);
    formId = probe.formId as "A" | "B" | "C";
  }

  const seen = await prisma.skillAttempt.findMany({ where: { userId, skillKey: SKILL }, select: { itemId: true } });
  const seenIds = new Set(seen.map((a) => a.itemId));

  const candidates = pack.items.filter((item) => {
    if (seenIds.has(item.itemId)) return false;
    if (mode === "assessment") return item.formId === formId;
    if (item.formId !== "pool") return false;
    return moduleKey ? item.moduleKey === moduleKey : true;
  });

  if (candidates.length === 0) return null;

  const chosen = mode === "assessment" ? candidates[0] : [...candidates].sort((a, b) => a.difficulty - b.difficulty)[0];

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: chosen.moduleKey,
      itemId: chosen.itemId,
      formId: chosen.formId,
      mode: mode as any,
      probeId: mode === "assessment" ? probeId : null,
      scores: "{}",
      contentVersion: profile.contentVersion,
      rubricVersion: RUBRIC_VERSION,
      scoredBy: chosen.kind === "explain" ? "key" : "computed",
    },
  });

  return { attemptId: attempt.id, item: toPublicMonitoringItem(chosen) };
}

// ─── Locks and live events ──────────────────────────────────────────────────

async function loadOpenAttempt(prisma: PrismaClient, userId: string, attemptId: string) {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: { orderBy: { offsetMs: "asc" } } },
  });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL) throw new Error("Not found");
  if (JSON.parse(attempt.scores || "{}").criteria) {
    throw new MonitoringSequenceError("This attempt is already scored and cannot be changed.");
  }
  return attempt;
}

type CheckEventRow = { kind: string; payload: string | null; offsetMs: number };

function hasEvent(attempt: { checkEvents: CheckEventRow[] }, kind: string): boolean {
  return attempt.checkEvents.some((e) => e.kind === kind);
}

function eventsOfKind(attempt: { checkEvents: CheckEventRow[] }, kind: string) {
  return attempt.checkEvents.filter((e) => e.kind === kind);
}

function payloadOf<T>(event: CheckEventRow | undefined): T | null {
  if (!event?.payload) return null;
  try {
    return JSON.parse(event.payload) as T;
  } catch {
    return null;
  }
}

async function stamp(prisma: PrismaClient, attempt: { id: string; createdAt: Date }, kind: string, payload: unknown) {
  await prisma.skillCheckEvent.create({
    data: {
      attemptId: attempt.id,
      kind,
      payload: JSON.stringify(payload),
      offsetMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
    },
  });
}

// ─── recall (s3), and the unassisted half of a pair (s1) ───────────────────

export async function commitMonitoringPrediction(prisma: PrismaClient, userId: string, attemptId: string, level: PredictionLevel): Promise<{ ok: true }> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "recall" && !(item.kind === "pair" && item.pairHalf === "unassisted")) {
    throw new MonitoringSequenceError(`Item kind "${item.kind}"${item.pairHalf ? ` (${item.pairHalf})` : ""} does not take a prediction commit.`);
  }
  if (hasEvent(attempt, "prediction_committed")) throw new MonitoringSequenceError("A prediction is already committed for this attempt.");

  await stamp(prisma, attempt, "prediction_committed", { level });
  return { ok: true };
}

export type MonitoringSubmitResult = {
  attemptId: string;
  score: MonitoringScore;
  moduleState: string;
  masteryUnmet: MasteryGap[];
};

export type MonitoringAnswerResult = { stage: "needsRating" | "scored"; result: MonitoringSubmitResult | null };

export async function submitMonitoringAnswer(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  text: string,
  locale: Locale,
  timeZoneOffsetMinutes = 0
): Promise<MonitoringAnswerResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  const isUnassistedPairHalf = item.kind === "pair" && item.pairHalf === "unassisted";
  if (item.kind !== "recall" && !isUnassistedPairHalf) {
    throw new MonitoringSequenceError(`Item kind "${item.kind}" does not take an answer submission.`);
  }
  if (!hasEvent(attempt, "prediction_committed")) throw new MonitoringSequenceError("Commit a prediction before answering.");
  if (hasEvent(attempt, "answer_submitted")) throw new MonitoringSequenceError("An answer is already submitted for this attempt.");

  // D-46: the answer key must be matched in whatever locale the learner is
  // actually typing in, not a hardcoded "en" — a Persian-typed correct answer
  // was silently scored wrong against the English answerVariants, inverting
  // resolution for every fa learner with no symptom (exactly the failure
  // mode build plan §4.2 warns this file exists to prevent).
  const { pack } = await loadPack(prisma, userId, locale);
  const fullItem = findItem(pack.items, attempt.itemId);
  const correct = matchAnswer(text, fullItem.surface.answerVariants ?? [], fullItem.surface.requiredTokens);

  await stamp(prisma, attempt, "answer_submitted", { text, correct });

  if (isUnassistedPairHalf) {
    // Finalizes on the rating instead — s1's unit is (prediction, outcome, rating) together.
    return { stage: "needsRating", result: null };
  }

  const predictionEvent = eventsOfKind(attempt, "prediction_committed")[0];
  const prediction = payloadOf<{ level: PredictionLevel }>(predictionEvent)?.level;
  if (!prediction) throw new MonitoringSequenceError("Cannot score an attempt with no prediction.");

  const score: MonitoringScore = {
    moduleKey: "s3-resolution",
    criteria: allUnscored(),
    total: 0,
    scoredCount: 0,
    predictionSample: { prediction, outcome: correct ? 1 : 0 },
    ratingSample: null,
    deflation: null,
    influenceResult: null,
    checkRate: null,
  };

  await persistAttempt(prisma, attempt, score, { text, correct, prediction });
  const result = await finishAttempt(prisma, userId, attempt.id, "s3-resolution", attempt.mode, timeZoneOffsetMinutes);
  return { stage: "scored", result };
}

function allUnscored(): MonitoringScore["criteria"] {
  return (["S1", "S2", "S3", "S4", "S5", "S6"] as const).map((id) => ({ id, level: null, scoredBy: "unscored" as const, evidence: "Not this item's module." }));
}

// ─── pair rating (s1, both halves) ──────────────────────────────────────────

export type MonitoringRatingResult = { stage: "recorded" | "scored"; result: MonitoringSubmitResult | null };

export async function commitMonitoringRating(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  phase: "before" | "after",
  value: number,
  timeZoneOffsetMinutes = 0
): Promise<MonitoringRatingResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);

  if (item.kind === "explain") {
    if (phase === "before" && hasEvent(attempt, "rating_committed_before")) {
      throw new MonitoringSequenceError("A 'before' rating is already committed for this attempt.");
    }
    if (phase === "after") {
      if (!hasEvent(attempt, "explanation_committed")) throw new MonitoringSequenceError("Commit an explanation before the re-rating.");
      if (hasEvent(attempt, "rating_committed_after")) throw new MonitoringSequenceError("An 'after' rating is already committed for this attempt.");
    }
    await stamp(prisma, attempt, `rating_committed_${phase}`, { value });
    return { stage: "recorded", result: null };
  }

  if (item.kind !== "pair") throw new MonitoringSequenceError(`Item kind "${item.kind}" does not take a rating commit.`);
  if (hasEvent(attempt, "rating_committed_after")) throw new MonitoringSequenceError("A rating is already committed for this attempt.");

  if (item.pairHalf === "unassisted" && !hasEvent(attempt, "answer_submitted")) {
    throw new MonitoringSequenceError("Answer this item before rating it.");
  }

  await stamp(prisma, attempt, "rating_committed_after", { value });

  const predictionEvent = eventsOfKind(attempt, "prediction_committed")[0];
  const answerEvent = eventsOfKind(attempt, "answer_submitted")[0];
  const prediction = payloadOf<{ level: PredictionLevel }>(predictionEvent)?.level ?? null;
  const correct = payloadOf<{ correct: boolean }>(answerEvent)?.correct ?? null;

  const score: MonitoringScore = {
    moduleKey: "s1-access",
    criteria: allUnscored(),
    total: 0,
    scoredCount: 0,
    predictionSample: prediction !== null && correct !== null ? { prediction, outcome: correct ? 1 : 0 } : null,
    ratingSample: { pairId: item.pairId!, pairHalf: item.pairHalf as PairHalf, rating: value },
    deflation: null,
    influenceResult: null,
    checkRate: null,
  };

  await persistAttempt(prisma, attempt, score, { rating: value, prediction, correct });
  const result = await finishAttempt(prisma, userId, attempt.id, "s1-access", attempt.mode, timeZoneOffsetMinutes);
  return { stage: "scored", result };
}

// ─── explain (s2) ────────────────────────────────────────────────────────

export type CommitExplanationResult = { steps: { stepId: string; label: string }[] };

export async function commitMonitoringExplanation(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  text: string,
  locale: Locale
): Promise<CommitExplanationResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "explain") throw new MonitoringSequenceError("Only explain items take an explanation commit.");
  if (!hasEvent(attempt, "rating_committed_before")) throw new MonitoringSequenceError("Rate your understanding before explaining.");
  if (hasEvent(attempt, "explanation_committed")) throw new MonitoringSequenceError("An explanation is already committed for this attempt.");

  await stamp(prisma, attempt, "explanation_committed", { text });

  const { pack } = await loadPack(prisma, userId, locale);
  const fullItem = findItem(pack.items, attempt.itemId);
  const steps = (item.causalSteps ?? []).map((s) => ({ stepId: s.stepId, label: fullItem.surface.stepLabels?.[s.stepId] ?? s.stepId }));
  return { steps };
}

export async function selectMonitoringSteps(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  stepIds: string[],
  timeZoneOffsetMinutes = 0
): Promise<MonitoringSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "explain") throw new MonitoringSequenceError("Only explain items take a step selection.");
  if (!hasEvent(attempt, "explanation_committed")) throw new MonitoringSequenceError("Commit an explanation before selecting steps.");
  // D-45: the re-rating must land before a step selection is accepted, so the
  // learner is never rating against a list they've already acted on (§10).
  if (!hasEvent(attempt, "rating_committed_after")) throw new MonitoringSequenceError("Re-rate your understanding before selecting steps.");
  if (hasEvent(attempt, "steps_selected")) throw new MonitoringSequenceError("Steps are already selected for this attempt.");

  await stamp(prisma, attempt, "steps_selected", { stepIds });

  const before = payloadOf<{ value: number }>(eventsOfKind(attempt, "rating_committed_before")[0])?.value;
  const after = payloadOf<{ value: number }>(eventsOfKind(attempt, "rating_committed_after")[0])?.value;
  if (before === undefined || after === undefined) throw new MonitoringSequenceError("Missing a before/after rating.");

  const score = assembleExplainScore(before, after, stepIds, item.causalSteps ?? []);
  await persistAttempt(prisma, attempt, score, { before, after, stepIds });
  return finishAttempt(prisma, userId, attempt.id, "s2-explain", attempt.mode, timeZoneOffsetMinutes);
}

// ─── transcript (s4, s5) ─────────────────────────────────────────────────

export type InfluenceMark = { turnId: string; movedWhat: string };

export async function markMonitoringInfluence(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  marks: InfluenceMark[],
  timeZoneOffsetMinutes = 0
): Promise<MonitoringSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "transcript") throw new MonitoringSequenceError("Only transcript items take influence marks.");
  if (hasEvent(attempt, "influence_marked")) throw new MonitoringSequenceError("Influences are already marked for this attempt.");

  await stamp(prisma, attempt, "influence_marked", { marks });

  const plantedTurnIds = (item.planted ?? []).map((p) => p.turnId);
  const markedTurnIds = marks.map((m) => m.turnId);
  const everyHitNamed = markedTurnIds
    .filter((id) => plantedTurnIds.includes(id))
    .every((id) => (marks.find((m) => m.turnId === id)?.movedWhat ?? "").trim().length > 0);

  const score = assembleTranscriptScore({
    moduleKey: item.moduleKey as "s4-agreement" | "s5-anchor",
    isCleanControl: !!item.isCleanControl,
    plantedTurnIds,
    markedTurnIds,
    everyHitNamed,
  });

  await persistAttempt(prisma, attempt, score, { marks });
  return finishAttempt(prisma, userId, attempt.id, item.moduleKey, attempt.mode, timeZoneOffsetMinutes);
}

// ─── longset (s6) ────────────────────────────────────────────────────────

export async function markMonitoringCheckpoint(prisma: PrismaClient, userId: string, attemptId: string, checkpointId: string, checked: boolean): Promise<{ ok: true }> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "longset") throw new MonitoringSequenceError("Only longset items take checkpoint reviews.");
  if (!(item.checkpoints ?? []).some((c) => c.checkpointId === checkpointId)) {
    throw new MonitoringSequenceError(`Unknown checkpoint "${checkpointId}" for this item.`);
  }
  await stamp(prisma, attempt, "checkpoint_reviewed", { checkpointId, checked });
  return { ok: true };
}

export async function selectMonitoringCountermeasure(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  optionId: string,
  timeZoneOffsetMinutes = 0
): Promise<MonitoringSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "longset") throw new MonitoringSequenceError("Only longset items take a countermeasure selection.");
  if (hasEvent(attempt, "countermeasure_selected")) throw new MonitoringSequenceError("A countermeasure is already selected for this attempt.");

  await stamp(prisma, attempt, "countermeasure_selected", { optionId });

  const checkpoints = item.checkpoints ?? [];
  const reviewed = eventsOfKind(attempt, "checkpoint_reviewed");
  const checkedById = new Map(reviewed.map((e) => [payloadOf<{ checkpointId: string; checked: boolean }>(e)?.checkpointId, payloadOf<{ checkpointId: string; checked: boolean }>(e)?.checked ?? false]));
  const checked = checkpoints.map((c) => checkedById.get(c.checkpointId) ?? false);
  const decay = checkRateDecay(checked);

  const score = assembleLongsetScore(optionId, item.countermeasures ?? [], COUNTERMEASURE_HAS_TRIGGER, decay);
  await persistAttempt(prisma, attempt, score, { optionId, checked });
  return finishAttempt(prisma, userId, attempt.id, "s6-complacency", attempt.mode, timeZoneOffsetMinutes);
}

// ─── Shared finalize plumbing ───────────────────────────────────────────────

async function persistAttempt(prisma: PrismaClient, attempt: { id: string; createdAt: Date }, score: MonitoringScore, responseFields: Record<string, unknown>) {
  await prisma.skillAttempt.update({
    where: { id: attempt.id },
    data: {
      responseStructure: JSON.stringify(responseFields),
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({ latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()) }),
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
      scoredBy: "computed",
    },
  });
}

async function finishAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  moduleKey: MonitoringModuleKey,
  mode: string,
  timeZoneOffsetMinutes: number
): Promise<MonitoringSubmitResult> {
  const row = await prisma.skillAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const score = JSON.parse(row.scores) as MonitoringScore;

  const moduleUpdate =
    mode !== "open_practice" ? await updateMonitoringModuleProgress(prisma, userId, moduleKey, timeZoneOffsetMinutes) : { state: "not_started", unmetCriteria: [] as MasteryGap[] };

  return { attemptId, score, moduleState: moduleUpdate.state, masteryUnmet: moduleUpdate.unmetCriteria };
}

// ─── Progress ───────────────────────────────────────────────────────────────

async function loadModuleAttempts(prisma: PrismaClient, userId: string, moduleKey: MonitoringModuleKey, tzOffsetMinutes: number) {
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, moduleKey, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });
  return attempts
    .map((a) => {
      const score = JSON.parse(a.scores || "{}") as MonitoringScore;
      if (!Array.isArray(score.criteria)) return null;
      return { score, spec: specFor(a.itemId), dayKey: toDayKey(a.createdAt, tzOffsetMinutes) };
    })
    .filter(Boolean) as { score: MonitoringScore; spec: MonitoringItemSpec; dayKey: string }[];
}

export async function updateMonitoringModuleProgress(prisma: PrismaClient, userId: string, moduleKey: MonitoringModuleKey, tzOffsetMinutes: number) {
  const rows = await loadModuleAttempts(prisma, userId, moduleKey, tzOffsetMinutes);

  let verdict: { mastered: boolean; unmetCriteria: MasteryGap[] };
  if (moduleKey === "s3-resolution") {
    verdict = evaluateResolutionMastery(
      rows.filter((r) => r.score.predictionSample).map((r) => ({ ...r.score.predictionSample!, dayKey: r.dayKey }))
    );
  } else if (moduleKey === "s1-access") {
    const predictionRows = rows.filter((r) => r.score.predictionSample).map((r) => ({ ...r.score.predictionSample!, dayKey: r.dayKey }));
    const pairMap = new Map<string, { assisted?: number; unassisted?: number }>();
    for (const r of rows) {
      if (!r.score.ratingSample) continue;
      const entry = pairMap.get(r.score.ratingSample.pairId) ?? {};
      entry[r.score.ratingSample.pairHalf] = r.score.ratingSample.rating;
      pairMap.set(r.score.ratingSample.pairId, entry);
    }
    const ratingPairs = [...pairMap.values()]
      .filter((p): p is { assisted: number; unassisted: number } => p.assisted !== undefined && p.unassisted !== undefined)
      .map((p) => ({ assistedRating: p.assisted, unassistedRating: p.unassisted }));
    verdict = evaluateAccessMastery(predictionRows, ratingPairs);
  } else {
    const requireNoCleanFalseAlarm = CLEAN_TRANSCRIPT_MODULES.includes(moduleKey);
    verdict = evaluateKeyedMastery(
      rows.map((r) => ({
        level: r.score.criteria.find((c) => c.scoredBy !== "unscored")?.level ?? null,
        dayKey: r.dayKey,
        isCleanControl: r.spec.isCleanControl,
        falseAlarm: r.score.influenceResult ? r.score.influenceResult.falseAlarms > 0 : false,
      })),
      { requireNoCleanFalseAlarm }
    );
  }

  const state = verdict.mastered ? "mastered" : "in_progress";

  const existing = await prisma.skillModuleProgress.findUnique({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
  });

  const data = {
    state: state as any,
    lastCriterionDay: rows.length ? rows[rows.length - 1].dayKey : null,
    ...(verdict.mastered && scheduleOnMastery(existing, new Date(), `${userId}:${moduleKey}`)),
  };

  await prisma.skillModuleProgress.upsert({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
    create: { userId, skillKey: SKILL, moduleKey, ...data },
    update: data,
  });

  return { state, unmetCriteria: verdict.unmetCriteria };
}

export async function getMonitoringModules(prisma: PrismaClient, userId: string, locale: Locale) {
  const { pack } = await loadPack(prisma, userId, locale);
  const progress = await prisma.skillModuleProgress.findMany({ where: { userId, skillKey: SKILL } });
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

/** §6's §1.1 finding is withheld until the learner's own inflation number exists (settled 2026-08-12) — an anchor delivered early cannot be withdrawn, same reasoning as Delegation's WOA baseline gate. */
export async function getMonitoringProgress(prisma: PrismaClient, userId: string, locale: Locale) {
  const { profile, pack } = await loadPack(prisma, userId, locale);
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });

  const scored = attempts
    .map((a) => ({ row: a, spec: specFor(a.itemId), score: JSON.parse(a.scores || "{}") as MonitoringScore }))
    .filter((a) => Array.isArray(a.score.criteria));

  const criterionMeans = (["S1", "S2", "S3", "S4", "S5", "S6"] as const).map((id) => {
    const levels = scored.map((a) => a.score.criteria.find((c) => c.id === id)?.level).filter((l): l is 0 | 1 | 2 => l !== null && l !== undefined);
    return { criterion: id, mean: levels.length ? levels.reduce((s: number, l) => s + l, 0) / levels.length : null, count: levels.length };
  });

  // Resolution is s3-resolution's own instrument — the headline metric (spec
  // §6) — and is deliberately never computed by pooling s1's samples in,
  // even though both are "recall"-shaped: s1's unassisted half exists to
  // pair with its assisted sibling for inflation, not to extend s3's window.
  const s3Samples = scored.filter((a) => a.spec.moduleKey === "s3-resolution" && a.score.predictionSample).map((a) => a.score.predictionSample!);
  const resolution = computeGamma(s3Samples.map((s) => ({ prediction: PREDICTION_ORDINAL[s.prediction], outcome: s.outcome })));
  const bias = computeBias(s3Samples);
  const performance = s3Samples.length ? s3Samples.filter((s) => s.outcome === 1).length / s3Samples.length : null;

  const pairMap = new Map<string, { assisted?: number; unassisted?: number }>();
  for (const a of scored) {
    if (!a.score.ratingSample) continue;
    const entry = pairMap.get(a.score.ratingSample.pairId) ?? {};
    entry[a.score.ratingSample.pairHalf] = a.score.ratingSample.rating;
    pairMap.set(a.score.ratingSample.pairId, entry);
  }
  const completePairs = [...pairMap.values()].filter((p): p is { assisted: number; unassisted: number } => p.assisted !== undefined && p.unassisted !== undefined);
  const inflation = inflationFor(completePairs.map((p) => ({ assistedRating: p.assisted, unassistedRating: p.unassisted })));

  const influenceRows = scored.filter((a) => a.score.influenceResult);
  const totalHits = influenceRows.reduce((s, a) => s + a.score.influenceResult!.hits, 0);
  const totalPlanted = influenceRows.reduce((s, a) => s + a.score.influenceResult!.plantedTotal, 0);
  const cleanRows = influenceRows.filter((a) => a.spec.isCleanControl);
  const cleanFalseAlarms = cleanRows.reduce((s, a) => s + a.score.influenceResult!.falseAlarms, 0);
  const influenceDiscrimination = totalPlanted > 0 || cleanRows.length > 0 ? (totalPlanted > 0 ? totalHits / totalPlanted : 0) - (cleanRows.length > 0 ? cleanFalseAlarms / cleanRows.length : 0) : null;

  return {
    skillKey: SKILL,
    contentVersion: profile.contentVersion,
    rubricVersion: RUBRIC_VERSION,
    locale,
    reviewStatus: pack.reviewStatus,
    hasBaseline: profile.assessmentCompletedAt != null,
    assessmentSkipped: profile.assessmentSkipped,
    totalAttempts: scored.length,
    criterionMeans,
    resolutionSampleCount: s3Samples.length,
    resolution,
    bias,
    performance,
    postAiInflation: inflation,
    postAiInflationReady: completePairs.length > 0,
    influenceDiscrimination,
  };
}

export { MONITORING_MODULE_KEYS } from "../../../content/skills/monitoring/types";
