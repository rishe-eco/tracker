/**
 * Delegation Lab session orchestration. Mirrors `verificationSession.ts`'s
 * shape; what's specific here:
 *
 * 1. **The ordering rule the whole tool rests on.** `estimate_committed` (and
 *    `confidence_committed`) must be server-stamped before the advice ever
 *    reaches the client — `startDelegationItem`'s response never carries it,
 *    and `commitDelegationEstimate` is the one call that returns it. WOA is
 *    meaningless if the initial estimate can move after advice is seen.
 * 2. **No rung.** The two-rung progression is specific to Verification
 *    Lab's cost bench; every item here practises the same way regardless of
 *    module (build plan §9, §5 "what must not be built").
 * 3. **Two kinds never go through `commitDelegationEstimate` at all.** A
 *    `split` item goes straight to `commitDelegationSplit`; a `sequence`
 *    item uses `commitSequenceRound` for each of its `G6_ROUNDS` rounds.
 * 4. **A `g5-stakes` pair scores across two separate attempts, not one.**
 *    Whichever half finalises second is the one that actually computes G5,
 *    by reading its sibling's already-persisted score; the first half to
 *    finalise records `pendingPair: true` and no G5 level until then.
 *
 * Spec: 05-delegation-lab.md; build plan §3.
 */

import type { PrismaClient } from "@prisma/client";
import {
  G6_ROUNDS,
  toPublicDelegationItem,
  type DelegationItemSpec,
  type DelegationItemSurface,
  type DelegationModuleKey,
  type Locale,
  type PublicDelegationItem,
} from "../../../content/skills/delegation/types";
import { buildDelegationPack, ITEM_SPEC_BY_ID, RUBRIC_VERSION } from "../../../content/skills/delegation/v1";
import { ensureProfile } from "../profile";
import { scheduleOnMastery, toDayKey } from "../scheduler";
import { loadServingProbe } from "../probes";
import type { MasteryGap } from "../mastery";
import { computeWoa } from "./woa";
import { anchoringFor, calibrationBrier, discriminationFor, relianceRates } from "./metrics";
import {
  assembleEstimateScore,
  assembleSequenceScore,
  assembleSplitScore,
  scoreCueSelection,
  scoreSplitDisposition,
  type DelegationScore,
} from "./scoring";
import { evaluateKeyedMastery, evaluateWeighingMastery, type KeyedAttempt, type WeighingAttempt } from "./mastery";

const SKILL = "delegation" as const;
const KEYED_MODULES: readonly DelegationModuleKey[] = ["g4-split", "g6-drift"];

export type DelegationMode = "assessment" | "module" | "review" | "calibrated_practice" | "open_practice";

export class DelegationSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelegationSequenceError";
  }
}

type PackItem = DelegationItemSpec & { surface: DelegationItemSurface };

async function loadPack(prisma: PrismaClient, userId: string, locale: Locale) {
  const profile = await ensureProfile(prisma, userId, locale, SKILL);
  const pack = buildDelegationPack(locale);
  return { profile, pack };
}

function specFor(itemId: string): DelegationItemSpec {
  const spec = ITEM_SPEC_BY_ID.get(itemId);
  if (!spec) throw new Error(`Delegation item "${itemId}" is not in this content version.`);
  return spec;
}

function findItem(items: PackItem[], itemId: string): PackItem {
  const item = items.find((i) => i.itemId === itemId);
  if (!item) throw new Error(`Delegation item "${itemId}" is not in this content version.`);
  return item;
}

// ─── Serving ────────────────────────────────────────────────────────────────

export type ServedDelegationItem = { attemptId: string; item: PublicDelegationItem };

export async function startDelegationItem(
  prisma: PrismaClient,
  userId: string,
  mode: DelegationMode,
  moduleKey: DelegationModuleKey | null,
  locale: Locale,
  probeId?: string | null
): Promise<ServedDelegationItem | null> {
  const { profile, pack } = await loadPack(prisma, userId, locale);

  let formId: "A" | "B" | "C" = "A";
  if (mode === "assessment") {
    if (!probeId) {
      throw new DelegationSequenceError("An assessment item must be served inside a probe — call startSkillProbe first.");
    }
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
      scoredBy: "computed",
    },
  });

  return { attemptId: attempt.id, item: toPublicDelegationItem(chosen) };
}

// ─── Locks and live events ──────────────────────────────────────────────────

async function loadOpenAttempt(prisma: PrismaClient, userId: string, attemptId: string) {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: { orderBy: { offsetMs: "asc" } } },
  });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL) throw new Error("Not found");
  if (JSON.parse(attempt.scores || "{}").criteria) {
    throw new DelegationSequenceError("This attempt is already scored and cannot be changed.");
  }
  return attempt;
}

type CheckEventRow = { kind: string; payload: string | null; offsetMs: number };

function hasEvent(attempt: { checkEvents: CheckEventRow[] }, kind: string, roundIndex?: number): boolean {
  return attempt.checkEvents.some((e) => {
    if (e.kind !== kind) return false;
    if (roundIndex === undefined) return true;
    return payloadOf<{ roundIndex?: number }>(e)?.roundIndex === roundIndex;
  });
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

// ─── Estimate / advice / revision (estimate, cue, stakes kinds) ────────────

export type CommitEstimateResult = { advice: number; unitLabel: string | null };

export async function commitDelegationEstimate(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  value: number,
  confidence: number,
  locale: Locale
): Promise<CommitEstimateResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "estimate" && item.kind !== "cue" && item.kind !== "stakes") {
    throw new DelegationSequenceError(`Item kind "${item.kind}" does not take a plain estimate commit.`);
  }
  if (hasEvent(attempt, "estimate_committed")) {
    throw new DelegationSequenceError("An estimate is already committed for this attempt.");
  }
  if (item.advice === null) throw new DelegationSequenceError("This item has no authored advice.");

  await stamp(prisma, attempt, "estimate_committed", { value });
  await stamp(prisma, attempt, "confidence_committed", { confidence });
  await stamp(prisma, attempt, "advice_shown", { advice: item.advice });

  const { pack } = await loadPack(prisma, userId, locale);
  const fullItem = findItem(pack.items, attempt.itemId);
  return { advice: item.advice, unitLabel: fullItem.surface.unitLabel ?? null };
}

export type DelegationCommitResult =
  | { stage: "scored"; result: DelegationSubmitResult }
  | { stage: "needsCue"; cueOptions: { cueId: string; label: string }[] };

export async function commitDelegationRevision(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  value: number,
  recoverabilityMove: boolean | null,
  locale: Locale,
  timeZoneOffsetMinutes = 0
): Promise<DelegationCommitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if (!hasEvent(attempt, "estimate_committed")) {
    throw new DelegationSequenceError("Commit an estimate before revising it.");
  }
  if (hasEvent(attempt, "revision_committed")) {
    throw new DelegationSequenceError("A revision is already committed for this attempt.");
  }

  const item = specFor(attempt.itemId);
  await stamp(prisma, attempt, "revision_committed", { value, recoverabilityMove: recoverabilityMove ?? null });

  if (item.kind === "cue") {
    const { pack } = await loadPack(prisma, userId, locale);
    const fullItem = findItem(pack.items, attempt.itemId);
    const cueOptions = (item.cueOptions ?? []).map((c) => ({ cueId: c.cueId, label: fullItem.surface.cueLabels?.[c.cueId] ?? c.cueId }));
    return { stage: "needsCue", cueOptions };
  }

  const result = await finalizeEstimateAttempt(prisma, userId, attemptId, locale, timeZoneOffsetMinutes);
  return { stage: "scored", result };
}

export async function selectDelegationCue(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  cueId: string,
  locale: Locale,
  timeZoneOffsetMinutes = 0
): Promise<DelegationSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "cue") throw new DelegationSequenceError("Only cue items take a cue selection.");
  if (!hasEvent(attempt, "revision_committed")) {
    throw new DelegationSequenceError("Commit a revision before selecting a cue.");
  }
  if (hasEvent(attempt, "cue_selected")) {
    throw new DelegationSequenceError("A cue is already selected for this attempt.");
  }
  if (!(item.cueOptions ?? []).some((c) => c.cueId === cueId)) {
    throw new DelegationSequenceError(`Unknown cue "${cueId}" for this item.`);
  }

  await stamp(prisma, attempt, "cue_selected", { cueId });
  return finalizeEstimateAttempt(prisma, userId, attemptId, locale, timeZoneOffsetMinutes);
}

async function finalizeEstimateAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  locale: Locale,
  timeZoneOffsetMinutes: number
): Promise<DelegationSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.truth === null || item.advice === null || item.plausibleRange === null) {
    throw new DelegationSequenceError("This item has no truth/advice/plausibleRange to score against.");
  }

  const estimateEvent = eventsOfKind(attempt, "estimate_committed")[0];
  const confidenceEvent = eventsOfKind(attempt, "confidence_committed")[0];
  const revisionEvent = eventsOfKind(attempt, "revision_committed")[0];
  const cueEvent = eventsOfKind(attempt, "cue_selected")[0];

  const initial = payloadOf<{ value: number }>(estimateEvent)?.value;
  const confidence = payloadOf<{ confidence: number }>(confidenceEvent)?.confidence;
  const revision = payloadOf<{ value: number; recoverabilityMove: boolean | null }>(revisionEvent);
  const cueId = payloadOf<{ cueId: string }>(cueEvent)?.cueId ?? null;

  if (initial === undefined || confidence === undefined || !revision) {
    throw new DelegationSequenceError("Cannot score an attempt with no estimate or revision.");
  }
  if (item.kind === "cue" && !cueId) {
    throw new DelegationSequenceError("Cannot score a cue item with no cue selected.");
  }

  let cueSelection: { selectedCueId: string; correct: boolean; level: 0 | 1 | 2 } | undefined;
  if (item.kind === "cue" && cueId) {
    const { level, correct } = scoreCueSelection(cueId, item.cueOptions ?? [], item.cueDirection);
    cueSelection = { selectedCueId: cueId, correct, level };
  }

  let stakes: Parameters<typeof assembleEstimateScore>[0]["stakes"] | undefined;
  if (item.kind === "stakes" && item.stakesPairId && item.stakesRole) {
    const sibling = await findScoredSibling(prisma, userId, item.stakesPairId, attempt.id);
    stakes = {
      role: item.stakesRole,
      recoverabilityMove: revision.recoverabilityMove ?? false,
      siblingWoaClamped: sibling?.score.woaClamped ?? null,
      siblingRecoverabilityMove: sibling?.recoverabilityMove ?? false,
    };
  }

  const score = assembleEstimateScore({
    moduleKey: item.moduleKey,
    initial,
    confidence,
    advice: item.advice,
    final: revision.value,
    truth: item.truth,
    plausibleRange: item.plausibleRange,
    cueDirection: item.cueDirection,
    cueSelection,
    stakes,
    locale,
  });

  await persistAttempt(prisma, attempt, score, {
    initial,
    confidence,
    advice: item.advice,
    final: revision.value,
    cueId,
    recoverabilityMove: revision.recoverabilityMove ?? null,
  });

  // Whichever half of a g5 pair finalises second carries the pair's actual
  // G5 level (it can see both WOAs); the half that finalised first keeps
  // `pendingPair: true` forever and is filtered out of every aggregate below
  // — which is exactly "counted in pairs, not items" (spec §7): only the
  // one row that resolved the pair ever contributes to that pair's mastery
  // or progress count, never both.

  return finishAttempt(prisma, userId, attempt.id, item.moduleKey, attempt.mode, timeZoneOffsetMinutes, locale);
}

type SiblingScore = { score: DelegationScore; recoverabilityMove: boolean };

async function findScoredSibling(prisma: PrismaClient, userId: string, stakesPairId: string, excludeAttemptId: string): Promise<SiblingScore | null> {
  const rows = await prisma.skillAttempt.findMany({ where: { userId, skillKey: SKILL }, orderBy: { createdAt: "asc" } });
  for (const row of rows) {
    if (row.id === excludeAttemptId) continue;
    const spec = ITEM_SPEC_BY_ID.get(row.itemId);
    if (!spec || spec.stakesPairId !== stakesPairId) continue;
    const parsedScore = JSON.parse(row.scores || "{}");
    if (!Array.isArray(parsedScore.criteria)) continue;
    const response = JSON.parse(row.responseStructure || "{}");
    return { score: parsedScore as DelegationScore, recoverabilityMove: response.recoverabilityMove ?? false };
  }
  return null;
}

// ─── Split ──────────────────────────────────────────────────────────────────

export async function commitDelegationSplit(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  dispositions: { pieceId: string; disposition: "give" | "keep" }[],
  locale: Locale,
  timeZoneOffsetMinutes = 0
): Promise<DelegationSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "split") throw new DelegationSequenceError("Only split items take a split commit.");
  if (hasEvent(attempt, "split_committed")) {
    throw new DelegationSequenceError("A split is already committed for this attempt.");
  }

  const dispositionMap = Object.fromEntries(dispositions.map((d) => [d.pieceId, d.disposition]));
  await stamp(prisma, attempt, "split_committed", { dispositions: dispositionMap });

  const { level } = scoreSplitDisposition(item.splitPieces ?? [], dispositionMap);
  const score = assembleSplitScore({ moduleKey: "g4-split", level, locale });

  await persistAttempt(prisma, attempt, score, { dispositions: dispositionMap });
  return finishAttempt(prisma, userId, attempt.id, "g4-split", attempt.mode, timeZoneOffsetMinutes, locale);
}

// ─── Sequence (g6-drift) ────────────────────────────────────────────────────

export type SequenceRoundPhase = "estimate" | "revision";
export type CommitSequenceRoundResult = { stage: "advice"; advice: number } | { stage: "recorded" } | { stage: "scored"; result: DelegationSubmitResult };

export async function commitSequenceRound(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  roundIndex: number,
  value: number,
  phase: SequenceRoundPhase,
  locale: Locale,
  confidence?: number | null,
  timeZoneOffsetMinutes = 0
): Promise<CommitSequenceRoundResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  if (item.kind !== "sequence") throw new DelegationSequenceError("Only sequence items take a round commit.");
  const rounds = item.sequenceRounds ?? [];
  if (roundIndex < 0 || roundIndex >= rounds.length) {
    throw new DelegationSequenceError(`Round ${roundIndex} does not exist on this sequence.`);
  }
  if (roundIndex > 0 && !hasEvent(attempt, "revision_committed", roundIndex - 1)) {
    throw new DelegationSequenceError(`Round ${roundIndex} is out of order — round ${roundIndex - 1} isn't finished yet.`);
  }

  if (phase === "estimate") {
    if (hasEvent(attempt, "estimate_committed", roundIndex)) {
      throw new DelegationSequenceError(`Round ${roundIndex}'s estimate is already committed.`);
    }
    await stamp(prisma, attempt, "estimate_committed", { roundIndex, value });
    if (confidence != null) await stamp(prisma, attempt, "confidence_committed", { roundIndex, confidence });
    await stamp(prisma, attempt, "advice_shown", { roundIndex, advice: rounds[roundIndex].advice });
    return { stage: "advice", advice: rounds[roundIndex].advice };
  }

  if (!hasEvent(attempt, "estimate_committed", roundIndex)) {
    throw new DelegationSequenceError(`Commit round ${roundIndex}'s estimate before revising it.`);
  }
  if (hasEvent(attempt, "revision_committed", roundIndex)) {
    throw new DelegationSequenceError(`Round ${roundIndex}'s revision is already committed.`);
  }
  await stamp(prisma, attempt, "revision_committed", { roundIndex, value });

  if (roundIndex < rounds.length - 1) return { stage: "recorded" };

  const result = await finalizeSequenceAttempt(prisma, userId, attemptId, locale, timeZoneOffsetMinutes);
  return { stage: "scored", result };
}

async function finalizeSequenceAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  locale: Locale,
  timeZoneOffsetMinutes: number
): Promise<DelegationSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);
  const rounds = item.sequenceRounds ?? [];

  const roundResults = rounds.map((r, i) => {
    const initial = payloadOf<{ roundIndex: number; value: number }>(eventsOfKind(attempt, "estimate_committed").find((e) => payloadOf<{ roundIndex: number }>(e)?.roundIndex === i))?.value;
    const final = payloadOf<{ roundIndex: number; value: number }>(eventsOfKind(attempt, "revision_committed").find((e) => payloadOf<{ roundIndex: number }>(e)?.roundIndex === i))?.value;
    if (initial === undefined || final === undefined) throw new DelegationSequenceError(`Round ${i} is missing an estimate or revision.`);
    const { clamped } = computeWoa(initial, r.advice, final);
    return { roundIndex: i, initial, advice: r.advice, final, truth: r.truth, woaClamped: clamped };
  });

  const score = assembleSequenceScore({
    moduleKey: "g6-drift",
    round1Woa: roundResults[0]?.woaClamped ?? null,
    round3Woa: roundResults[G6_ROUNDS - 1]?.woaClamped ?? null,
    locale,
  });

  await persistAttempt(prisma, attempt, score, { rounds: roundResults });
  return finishAttempt(prisma, userId, attempt.id, "g6-drift", attempt.mode, timeZoneOffsetMinutes, locale);
}

// ─── Shared finalize plumbing ───────────────────────────────────────────────

async function persistAttempt(prisma: PrismaClient, attempt: { id: string; createdAt: Date }, score: DelegationScore, responseFields: Record<string, unknown>) {
  await prisma.skillAttempt.update({
    where: { id: attempt.id },
    data: {
      responseStructure: JSON.stringify(responseFields),
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({ latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()), woaRaw: score.woaRaw, woaClamped: score.woaClamped }),
      confidence: (responseFields as any).confidence ?? null,
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
      scoredBy: "computed",
    },
  });
}

export type DelegationSubmitResult = {
  attemptId: string;
  score: DelegationScore;
  moduleState: string;
  masteryUnmet: MasteryGap[];
};

async function finishAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  moduleKey: DelegationModuleKey,
  mode: string,
  timeZoneOffsetMinutes: number,
  _locale: Locale
): Promise<DelegationSubmitResult> {
  const row = await prisma.skillAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const score = JSON.parse(row.scores) as DelegationScore;

  const moduleUpdate =
    mode !== "open_practice" ? await updateDelegationModuleProgress(prisma, userId, moduleKey, timeZoneOffsetMinutes) : { state: "not_started", unmetCriteria: [] as MasteryGap[] };

  return { attemptId, score, moduleState: moduleUpdate.state, masteryUnmet: moduleUpdate.unmetCriteria };
}

// ─── Progress ───────────────────────────────────────────────────────────────

async function loadModuleAttempts(prisma: PrismaClient, userId: string, moduleKey: DelegationModuleKey, tzOffsetMinutes: number) {
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, moduleKey, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });
  return attempts
    .map((a) => {
      const score = JSON.parse(a.scores || "{}") as DelegationScore;
      if (!Array.isArray(score.criteria)) return null;
      return { score, spec: specFor(a.itemId), dayKey: toDayKey(a.createdAt, tzOffsetMinutes) };
    })
    .filter(Boolean) as { score: DelegationScore; spec: DelegationItemSpec; dayKey: string }[];
}

export async function updateDelegationModuleProgress(prisma: PrismaClient, userId: string, moduleKey: DelegationModuleKey, tzOffsetMinutes: number) {
  const rows = await loadModuleAttempts(prisma, userId, moduleKey, tzOffsetMinutes);

  const verdict = KEYED_MODULES.includes(moduleKey)
    ? evaluateKeyedMastery(rows.map((r): KeyedAttempt => ({ level: r.score.criteria.find((c) => c.level !== null)?.level ?? null, dayKey: r.dayKey })))
    : evaluateWeighingMastery(
        rows
          .filter((r) => !r.score.pendingPair)
          .map(
            (r): WeighingAttempt => ({
              woaClamped: r.score.woaClamped,
              cueDirection: r.spec.cueDirection,
              direction: r.score.direction,
              netGain: r.score.netGain,
              dayKey: r.dayKey,
            })
          )
      );

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

export async function getDelegationModules(prisma: PrismaClient, userId: string, locale: Locale) {
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

/** §6's population baseline is withheld until the baseline probe completes, or 12 scored items if it was skipped (settled 2026-08-11) — an anchor delivered early cannot be withdrawn. */
export const POPULATION_BASELINE_MIN_ITEMS = 12;
/** Meta-analytic mean WOA (95% CI [0.37, 0.42]) — the egocentric-discounting baseline this tool compares a learner's own mean WOA against. */
export const PUBLISHED_MEAN_WOA = 0.39;

export async function getDelegationProgress(prisma: PrismaClient, userId: string, locale: Locale) {
  const { profile, pack } = await loadPack(prisma, userId, locale);
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });

  const scored = attempts
    .map((a) => ({ row: a, spec: specFor(a.itemId), score: JSON.parse(a.scores || "{}") as DelegationScore }))
    .filter((a) => Array.isArray(a.score.criteria) && !a.score.pendingPair);

  const criterionMeans = ["G1", "G2", "G3", "G4", "G5", "G6"].map((id) => {
    const levels = scored.map((a) => a.score.criteria.find((c) => c.id === id)?.level).filter((l): l is 0 | 1 | 2 => l !== null && l !== undefined);
    return { criterion: id, mean: levels.length ? levels.reduce((s: number, l) => s + l, 0) / levels.length : null, count: levels.length };
  });

  const woaBearing = scored.filter((a) => a.score.woaClamped !== null);
  const trustWoas = woaBearing.filter((a) => a.spec.cueDirection === "trust").map((a) => a.score.woaClamped as number);
  const keepWoas = woaBearing.filter((a) => a.spec.cueDirection === "keep").map((a) => a.score.woaClamped as number);
  const noneWoas = woaBearing.filter((a) => a.spec.cueDirection === "none").map((a) => a.score.woaClamped as number);

  const discrimination = discriminationFor(trustWoas, keepWoas);
  const anchoring = anchoringFor(noneWoas);
  const { overReliance, underReliance } = relianceRates(woaBearing.map((a) => a.score.direction));
  const netGains = scored.map((a) => a.score.netGain).filter((g): g is number => g !== null);
  const netGain = netGains.length ? netGains.reduce((a, b) => a + b, 0) / netGains.length : null;

  const g1Samples = scored.filter((a) => a.spec.moduleKey === "g1-own" && a.score.g1Sample).map((a) => a.score.g1Sample!);
  const calibration = calibrationBrier(
    g1Samples.map((s) => s.confidence),
    g1Samples.map((s) => (s.wasAccurate ? 0 : 1))
  );

  const populationBaselineReady = profile.assessmentCompletedAt != null || woaBearing.length >= POPULATION_BASELINE_MIN_ITEMS;
  const ownMeanWoa = woaBearing.length ? woaBearing.reduce((sum, a) => sum + (a.score.woaClamped as number), 0) / woaBearing.length : null;

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
    relianceDiscrimination: discrimination,
    overReliance,
    underReliance,
    netGainFromAdvice: netGain,
    anchoringOnUncuedItems: anchoring,
    selfAssessmentCalibration: calibration,
    populationMeanWoa: populationBaselineReady ? PUBLISHED_MEAN_WOA : null,
    ownMeanWoa: populationBaselineReady ? ownMeanWoa : null,
  };
}

export { DELEGATION_MODULE_KEYS } from "../../../content/skills/delegation/types";
