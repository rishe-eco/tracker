/**
 * Clarity Lab session orchestration.
 *
 * Resolvers stay thin; the rules live here (convention #5). Four design points
 * worth knowing before changing anything:
 *
 * 1. **The two locks are the measurement, so the server stamps them.** A
 *    prediction is worth nothing if it can be revised after the reveal, and a
 *    diagnosis is worth nothing if it can be entered after the scores. Both are
 *    recorded as `SkillCheckEvent` rows — the same mechanism Evidence Lab uses
 *    for check ordering, and for the same reason: the sequence is the data, so
 *    it must not be a number the client reports afterwards. Submitting before
 *    the required lock is rejected rather than served.
 *
 * 2. **Nothing that could answer the item leaves this file.** Reveal text,
 *    seeded faults, required slots and exemplar fixes are all withheld until the
 *    attempt is scored; `toPublicClarityItem` cannot carry them.
 *
 * 3. **A revision is a second attempt, not an edit.** It gets its own row with
 *    `revisionOfAttemptId` pointing back, which is what makes the delta a fact
 *    about two scored artifacts rather than a diff of one mutable field.
 *
 * 4. **Offline is the default path, not a fallback.** Revision and repair items
 *    ship everything they need; only elicitation requires a reader. With no
 *    credential the server serves the offline types and says so, rather than
 *    serving an elicitation item that cannot be completed.
 *
 * Spec: 01-clarity-lab.md; build plan 01a §3.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CLARITY_MODULE_KEYS,
  RUBRIC_CRITERIA,
  toPublicClarityItem,
  type ClarityItemSpec,
  type ClarityItemSurface,
  type ClarityModuleKey,
  type CriterionId,
  type Locale,
  type PublicClarityItem,
} from "../../../content/skills/clarity/types";
import { buildClarityPack, RUBRIC_CRITERIA_BY_MODULE, RUBRIC_VERSION } from "../../../content/skills/clarity/v1";
import { detectorCriteriaFor } from "../../../content/skills/clarity/v1/rubric";
import { isOfflineCapable } from "../../../content/skills/clarity/validate";
import { ensureProfile } from "../profile";
import { toDayKey } from "../scheduler";
import { isVoid, runDetectors } from "./detectors";
import { createAnthropicJudge } from "./anthropicJudge";
import { calibrationStatus, scoreCriteria } from "./judge";
import {
  assembleClarityScore,
  atCriterion,
  diagnosisAccuracy,
  evaluateClarityMastery,
  revisionDelta,
  type ClarityScore,
  type JudgeCriterionResult,
  type ScoredClarityAttempt,
} from "./scoring";

const SKILL = "clarity" as const;

export type ClarityMode = "assessment" | "module" | "review" | "calibrated_practice" | "open_practice";

/** True when a live reader is configured, which is the only thing elicitation needs. */
export function readerAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export class ClaritySequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaritySequenceError";
  }
}

type PackItem = ClarityItemSpec & { surface: ClarityItemSurface };

async function loadPack(prisma: PrismaClient, userId: string) {
  const profile = await ensureProfile(prisma, userId, "en", SKILL);
  const pack = buildClarityPack(profile.locale as Locale);
  return { profile, pack };
}

// ─── Serving ────────────────────────────────────────────────────────────────

export type ServedClarityItem = {
  attemptId: string;
  item: PublicClarityItem;
  /** Elicitation only, and only meaningful once a reader exists. */
  needsPrediction: boolean;
  /** Revision and elicitation; repair drills collapse to write → score. */
  needsDiagnosis: boolean;
};

export async function serveClarityItem(
  prisma: PrismaClient,
  userId: string,
  mode: ClarityMode,
  moduleKey?: ClarityModuleKey | null
): Promise<ServedClarityItem | null> {
  const { profile, pack } = await loadPack(prisma, userId);

  const seen = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL },
    select: { itemId: true },
  });
  const seenIds = new Set(seen.map((a) => a.itemId));

  const candidates = pack.items.filter((item) => {
    if (seenIds.has(item.itemId)) return false;
    if (mode === "assessment") return item.formId === "A";
    if (item.formId !== "pool") return false;
    // Without a reader an elicitation item cannot be completed, so it is not a
    // candidate. Serving one and failing at the reveal would be worse than
    // having fewer items.
    if (!isOfflineCapable(item.type) && !readerAvailable()) return false;
    return moduleKey ? item.moduleKey === moduleKey : true;
  });

  if (candidates.length === 0) return null;

  const chosen =
    mode === "assessment"
      ? candidates[0]
      : [...candidates].sort((a, b) => a.difficulty - b.difficulty)[0];

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
      rubricVersion: RUBRIC_VERSION,
      scoredBy: "detector",
    },
  });

  return {
    attemptId: attempt.id,
    item: toPublicClarityItem(chosen),
    needsPrediction: chosen.type === "elicitation",
    needsDiagnosis: chosen.type !== "repair",
  };
}

// ─── The two locks ──────────────────────────────────────────────────────────

async function loadOpenAttempt(prisma: PrismaClient, userId: string, attemptId: string) {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: true },
  });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL) throw new Error("Not found");
  if (JSON.parse(attempt.scores || "{}").criteria) {
    throw new ClaritySequenceError("This attempt is already scored and cannot be changed.");
  }
  return attempt;
}

function hasEvent(attempt: { checkEvents: { kind: string }[] }, kind: string): boolean {
  return attempt.checkEvents.some((e) => e.kind === kind);
}

async function stamp(
  prisma: PrismaClient,
  attempt: { id: string; createdAt: Date },
  kind: string,
  payload: string
) {
  await prisma.skillCheckEvent.create({
    data: {
      attemptId: attempt.id,
      kind,
      payload,
      offsetMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
    },
  });
}

/**
 * Commit what the learner thinks the reader will produce, before they see it.
 *
 * Elicitation only — a revision item ships its misread as the stimulus, so there
 * is nothing to predict. Once locked it cannot be changed: a prediction you can
 * revise after the answer measures nothing.
 */
export async function lockClarityPrediction(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  prediction: string
) {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const { pack } = await loadPack(prisma, userId);
  const item = findItem(pack.items, attempt.itemId);

  if (item.type !== "elicitation") {
    throw new ClaritySequenceError(
      `Item "${item.itemId}" is a ${item.type} item — its reader output is authored, so there is nothing to predict.`
    );
  }
  if (hasEvent(attempt, "prediction_locked")) {
    throw new ClaritySequenceError("The prediction is already locked.");
  }
  if (!prediction.trim()) throw new ClaritySequenceError("A prediction cannot be empty.");

  await stamp(prisma, attempt, "prediction_locked", prediction);
  return { locked: true as const };
}

/**
 * Commit which criteria the learner believes failed, before any score is shown.
 *
 * The forcing function for the transferable half of the skill: naming *why* a
 * text failed is what carries to the next one.
 */
export async function lockClarityDiagnosis(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  tagged: CriterionId[]
) {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const { pack } = await loadPack(prisma, userId);
  const item = findItem(pack.items, attempt.itemId);

  if (item.type === "repair") {
    throw new ClaritySequenceError(
      "Repair drills have no diagnose step — the fault is named in the prompt."
    );
  }
  if (hasEvent(attempt, "diagnosis_locked")) {
    throw new ClaritySequenceError("The diagnosis is already locked.");
  }
  const unknown = tagged.filter((c) => !RUBRIC_CRITERIA.includes(c));
  if (unknown.length) throw new ClaritySequenceError(`Unknown criteria: ${unknown.join(", ")}.`);

  await stamp(prisma, attempt, "diagnosis_locked", JSON.stringify(tagged));
  return { locked: true as const };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export type ClaritySubmitResult = {
  attemptId: string;
  score: ClarityScore;
  /** Present on revision and elicitation items, once a diagnosis was locked. */
  diagnosis: { correct: CriterionId[]; missed: CriterionId[]; spurious: CriterionId[] } | null;
  /** Repair drills only: did the fix clear the bar the drill sets? */
  repairPassed: boolean | null;
  /** Set when this attempt revises another. */
  delta: number | null;
  reveal: string;
  moduleState: string;
  masteryUnmet: string[];
  atCriterion: boolean;
  /** Criteria a judge produced but which cannot count yet — reported, not hidden. */
  feedbackOnly: CriterionId[];
};

export async function submitClarityAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  input: { text: string; timeZoneOffsetMinutes?: number }
): Promise<ClaritySubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const { profile, pack } = await loadPack(prisma, userId);
  const item = findItem(pack.items, attempt.itemId);

  // The sequence gate. A score shown before the diagnosis was committed would
  // make the diagnosis a recollection rather than a prediction.
  if (item.type !== "repair" && !hasEvent(attempt, "diagnosis_locked")) {
    throw new ClaritySequenceError(
      "Commit a diagnosis before asking for scores — tagging what failed after seeing the levels measures nothing."
    );
  }
  if (item.type === "elicitation" && !hasEvent(attempt, "prediction_locked")) {
    throw new ClaritySequenceError("Commit a prediction before asking for scores.");
  }

  const text = input.text ?? "";
  const void_ = isVoid(text, item.surface.scenario);
  const locale = profile.locale as Locale;

  const detectorResults = void_ ? [] : runDetectors(text, detectorCriteriaFor(locale));
  const { judgeResults, feedbackOnly, judgeModel } = void_
    ? { judgeResults: [] as JudgeCriterionResult[], feedbackOnly: [] as CriterionId[], judgeModel: null }
    : await runJudge(item, text, locale);

  const score = assembleClarityScore(detectorResults, judgeResults, { isVoid: void_ });

  const tagged = readTagged(attempt.checkEvents);
  const diagnosis = tagged ? diagnosisAccuracy(tagged, score) : null;

  const repairPassed =
    item.type === "repair" && item.repairCheck
      ? (score.criteria.find((c) => c.criterion === item.repairCheck!.criterion)?.level ?? -1) >=
        item.repairCheck.requiredLevel
      : null;

  const delta = await computeDelta(prisma, attempt.revisionOfAttemptId, score);

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseText: text,
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({
        latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
        tagged,
        repairPassed,
      }),
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
      judgeModelVersion: judgeModel,
      scoredBy: scoredByLabel(detectorResults.length, judgeResults.length),
    },
  });

  const moduleUpdate = await updateClarityModuleProgress(
    prisma,
    userId,
    item.moduleKey,
    input.timeZoneOffsetMinutes ?? 0
  );

  return {
    attemptId,
    score,
    diagnosis,
    repairPassed,
    delta,
    reveal: item.surface.reveal,
    moduleState: moduleUpdate.state,
    masteryUnmet: moduleUpdate.unmetCriteria,
    atCriterion: atCriterion(score, item.moduleKey),
    feedbackOnly,
  };
}

/**
 * Open a revision of a scored attempt.
 *
 * A new row rather than an edit, so the draft survives and the delta is a
 * comparison of two scored artifacts. Revisions are scaffolded by definition —
 * the learner has just been told what failed — so they never count toward
 * mastery.
 */
export async function startClarityRevision(prisma: PrismaClient, userId: string, attemptId: string) {
  const draft = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!draft || draft.userId !== userId || draft.skillKey !== SKILL) throw new Error("Not found");

  const scored = JSON.parse(draft.scores || "{}");
  if (!scored.criteria) {
    throw new ClaritySequenceError("Score the draft before revising it — there is nothing to improve on yet.");
  }
  const existing = await prisma.skillAttempt.findFirst({ where: { revisionOfAttemptId: attemptId } });
  if (existing) throw new ClaritySequenceError("This attempt has already been revised.");

  const { pack } = await loadPack(prisma, userId);
  const item = findItem(pack.items, draft.itemId);

  const revision = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: draft.moduleKey,
      itemId: draft.itemId,
      formId: draft.formId,
      mode: draft.mode,
      revisionOfAttemptId: draft.id,
      scores: "{}",
      contentVersion: draft.contentVersion,
      rubricVersion: RUBRIC_VERSION,
      scoredBy: "detector",
    },
  });

  return {
    attemptId: revision.id,
    item: toPublicClarityItem(item),
    draftText: draft.responseText ?? "",
    needsPrediction: false,
    // The diagnosis was committed on the draft; asking again would be busywork.
    needsDiagnosis: false,
  };
}

// ─── Progress ───────────────────────────────────────────────────────────────

export async function getClarityModules(prisma: PrismaClient, userId: string) {
  const { pack } = await loadPack(prisma, userId);
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
      criterion: RUBRIC_CRITERIA_BY_MODULE[mod.moduleKey],
      state: due ? "due_review" : (p?.state ?? "not_started"),
      currentStep: p?.currentStep ?? 1,
      masteredAt: p?.masteredAt ?? null,
      nextReviewAt: p?.nextReviewAt ?? null,
    };
  });
}

export async function getClarityProgress(prisma: PrismaClient, userId: string) {
  const { profile, pack } = await loadPack(prisma, userId);
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL },
    orderBy: { createdAt: "asc" },
  });

  const scored = attempts
    .map((a) => ({ row: a, score: JSON.parse(a.scores || "{}") as ClarityScore }))
    .filter((a) => Array.isArray(a.score.criteria));

  // Per-criterion mean level. Six lines is the reason an analytic rubric is
  // worth its cost — it says *which* thing improved.
  const criterionMeans = RUBRIC_CRITERIA.map((id) => {
    const levels: number[] = scored
      .map((a) => a.score.criteria.find((c) => c.criterion === id)?.level)
      .filter((l) => l !== null && l !== undefined) as number[];
    return {
      criterion: id,
      mean: levels.length ? levels.reduce((s, l) => s + l, 0) / levels.length : null,
      count: levels.length,
    };
  });

  const byId = new Map(scored.map((a) => [a.row.id, a]));
  const deltas = scored
    .filter((a) => a.row.revisionOfAttemptId)
    .map((a) => {
      const draft = byId.get(a.row.revisionOfAttemptId as string);
      return draft ? revisionDelta(draft.score, a.score) : null;
    })
    .filter((d): d is number => d !== null);

  const calibration = calibrationStatus(RUBRIC_VERSION, "claude-opus-5");

  return {
    skillKey: SKILL,
    contentVersion: profile.contentVersion,
    rubricVersion: RUBRIC_VERSION,
    locale: profile.locale,
    reviewStatus: pack.reviewStatus,
    hasBaseline: profile.assessmentCompletedAt != null,
    assessmentSkipped: profile.assessmentSkipped,
    /** Elicitation items and the three judge-only criteria both depend on this. */
    readerAvailable: readerAvailable(),
    /** Nothing is calibrated yet, so no judge criterion enters a probe total. */
    anyCriterionCalibrated: calibration.anyCalibrated,
    detectorCriteria: detectorCriteriaFor(profile.locale as Locale),
    totalAttempts: scored.length,
    criterionMeans,
    revisionDeltas: deltas,
    meanDelta: deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null,
  };
}

// ─── Internals ──────────────────────────────────────────────────────────────

function findItem(items: PackItem[], itemId: string): PackItem {
  const item = items.find((i) => i.itemId === itemId);
  if (!item) throw new Error(`Clarity item "${itemId}" is not in this content version.`);
  return item;
}

function readTagged(events: { kind: string; payload: string | null }[]): CriterionId[] | null {
  const event = events.find((e) => e.kind === "diagnosis_locked");
  if (!event?.payload) return null;
  try {
    const parsed = JSON.parse(event.payload);
    return Array.isArray(parsed) ? (parsed as CriterionId[]) : null;
  } catch {
    return null;
  }
}

function scoredByLabel(detectors: number, judges: number): string {
  if (detectors && judges) return "mixed";
  if (judges) return "judge";
  return "detector";
}

/**
 * Judge the criteria no detector can see. Returns nothing when no credential is
 * configured, which is the ordinary path for phases 1–3 rather than an error.
 */
async function runJudge(item: PackItem, text: string, locale: Locale) {
  const provider = createAnthropicJudge({ mode: "practice" });
  if (!provider) return { judgeResults: [] as JudgeCriterionResult[], feedbackOnly: [] as CriterionId[], judgeModel: null };

  const detectorCriteria = new Set(detectorCriteriaFor(locale));
  const wanted = RUBRIC_CRITERIA.filter((c) => !detectorCriteria.has(c));

  const outcome = await scoreCriteria(
    provider,
    wanted,
    { submission: text, scenario: item.surface.scenario, requiredSlots: item.requiredSlots },
    { mode: "practice", rubricVersion: RUBRIC_VERSION }
  );

  return {
    judgeResults: outcome.scored as JudgeCriterionResult[],
    feedbackOnly: outcome.feedbackOnly.map((f) => f.criterion),
    judgeModel: outcome.modelVersion ?? null,
  };
}

async function computeDelta(
  prisma: PrismaClient,
  draftAttemptId: string | null,
  revisionScore: ClarityScore
): Promise<number | null> {
  if (!draftAttemptId) return null;
  const draft = await prisma.skillAttempt.findUnique({ where: { id: draftAttemptId } });
  if (!draft) return null;
  const draftScore = JSON.parse(draft.scores || "{}") as ClarityScore;
  if (!Array.isArray(draftScore.criteria)) return null;
  return revisionDelta(draftScore, revisionScore);
}

/** Recompute a module's state from its unscaffolded attempts. */
async function updateClarityModuleProgress(
  prisma: PrismaClient,
  userId: string,
  moduleKey: ClarityModuleKey,
  tzOffsetMinutes: number
) {
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, moduleKey },
    orderBy: { createdAt: "asc" },
  });

  const scored: ScoredClarityAttempt[] = attempts
    .map((a) => {
      const score = JSON.parse(a.scores || "{}") as ClarityScore;
      if (!Array.isArray(score.criteria)) return null;
      return {
        score,
        moduleKey,
        dayKey: toDayKey(a.createdAt, tzOffsetMinutes),
        // A revision follows feedback that named what failed, so it is
        // scaffolded by construction and cannot earn mastery.
        unscaffolded: a.revisionOfAttemptId == null,
      };
    })
    .filter(Boolean) as ScoredClarityAttempt[];

  const verdict = evaluateClarityMastery(scored);
  const state = verdict.mastered ? "mastered" : "in_progress";

  const existing = await prisma.skillModuleProgress.findUnique({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
  });

  const data = {
    state: state as any,
    lastCriterionDay: scored.length ? scored[scored.length - 1].dayKey : null,
    ...(verdict.mastered && { masteredAt: existing?.masteredAt ?? new Date() }),
  };

  await prisma.skillModuleProgress.upsert({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
    create: { userId, skillKey: SKILL, moduleKey, ...data },
    update: data,
  });

  return { state, unmetCriteria: verdict.unmetCriteria };
}

export { CLARITY_MODULE_KEYS };
