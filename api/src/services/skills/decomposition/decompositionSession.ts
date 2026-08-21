/**
 * Decomposition Lab session orchestration. Mirrors `claritySession.ts`'s
 * shape; three things are specific to this tool:
 *
 * 1. **The ordering is the measurement, twice over.** Not just "diagnose
 *    before scores" (Clarity's rule) but "whole before any piece" (D1) and
 *    "which piece existed before which" (D2, from `node_added` order). Every
 *    lock and every authoring event is server-stamped; nothing here accepts a
 *    client-supplied offset or a client-asserted order.
 * 2. **No credential is ever required.** Every item type — arrangement,
 *    control, repair, breakdown — completes and scores without a reader. A
 *    breakdown item's D3/D5/D6 degrade to self-diagnosis rather than to a
 *    missing feature (see `scoring.ts`'s header note).
 * 3. **Nothing that could answer the item leaves this file before commit.**
 *    `toPublicDecompositionItem` strips the key; the reveal (what was
 *    required, what overlapped, what blocked what) is only ever attached to
 *    a `DecompositionAttemptResult`, which cannot exist before scoring.
 *
 * Spec: 03-decomposition-lab.md; build plan 03b §3.
 */

import type { PrismaClient } from "@prisma/client";
import {
  DECOMPOSITION_MODULE_KEYS,
  FAULT_TAGS,
  toPublicDecompositionItem,
  type DecompositionItemSpec,
  type DecompositionItemSurface,
  type DecompositionModuleKey,
  type FaultTag,
  type Locale,
  type PublicDecompositionItem,
} from "../../../content/skills/decomposition/types";
import { buildDecompositionPack, ITEM_SPEC_BY_ID, RUBRIC_CRITERIA_BY_MODULE, RUBRIC_VERSION } from "../../../content/skills/decomposition/v1";
import { ensureProfile } from "../profile";
import { scheduleOnMastery, toDayKey } from "../scheduler";
import { loadServingProbe } from "../probes";
import type { MasteryGap } from "../mastery";
import {
  assembleDecompositionScore,
  atCriterion,
  evaluateDecompositionMastery,
  type DecompositionScore,
  type DecompositionStructure,
  type ScoredDecompositionAttempt,
} from "./scoring";

const SKILL = "decomposition" as const;

export type DecompositionMode = "assessment" | "module" | "review" | "calibrated_practice" | "open_practice";

export class DecompositionSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecompositionSequenceError";
  }
}

type PackItem = DecompositionItemSpec & { surface: DecompositionItemSurface };

async function loadPack(prisma: PrismaClient, userId: string, locale: Locale) {
  const profile = await ensureProfile(prisma, userId, locale, SKILL);
  const pack = buildDecompositionPack(locale);
  return { profile, pack };
}

function specFor(itemId: string) {
  const spec = ITEM_SPEC_BY_ID.get(itemId);
  if (!spec) throw new Error(`Decomposition item "${itemId}" is not in this content version.`);
  return spec;
}

function findItem(items: PackItem[], itemId: string): PackItem {
  const item = items.find((i) => i.itemId === itemId);
  if (!item) throw new Error(`Decomposition item "${itemId}" is not in this content version.`);
  return item;
}

// ─── Serving ────────────────────────────────────────────────────────────────

export type ServedDecompositionItem = {
  attemptId: string;
  item: PublicDecompositionItem;
  /** Repair items only: name the fault before fixing it. */
  needsDiagnosis: boolean;
};

export async function serveDecompositionItem(
  prisma: PrismaClient,
  userId: string,
  mode: DecompositionMode,
  moduleKey: DecompositionModuleKey | null,
  locale: Locale,
  /** Assessment mode only — which probe this served item belongs to. */
  probeId?: string | null
): Promise<ServedDecompositionItem | null> {
  const { profile, pack } = await loadPack(prisma, userId, locale);

  // The form comes from the probe row, not the caller — see the matching note
  // in evidenceSession.ts's serveItem.
  let formId: "A" | "B" | "C" = "A";
  if (mode === "assessment") {
    if (!probeId) {
      throw new DecompositionSequenceError("An assessment item must be served inside a probe — call startSkillProbe first.");
    }
    const probe = await loadServingProbe(prisma, userId, SKILL, probeId);
    formId = probe.formId as "A" | "B" | "C";
  }

  const seen = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL },
    select: { itemId: true },
  });
  const seenIds = new Set(seen.map((a) => a.itemId));

  // Every item type completes and scores with no credential — unlike
  // Clarity's elicitation items, nothing here needs to be filtered out for
  // running offline.
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
      scoredBy: "detector",
    },
  });

  return {
    attemptId: attempt.id,
    item: toPublicDecompositionItem(chosen),
    needsDiagnosis: chosen.type === "repair",
  };
}

// ─── Locks and live authoring events ────────────────────────────────────────

async function loadOpenAttempt(prisma: PrismaClient, userId: string, attemptId: string) {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: { orderBy: { offsetMs: "asc" } } },
  });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL) throw new Error("Not found");
  if (JSON.parse(attempt.scores || "{}").criteria) {
    throw new DecompositionSequenceError("This attempt is already scored and cannot be changed.");
  }
  return attempt;
}

function hasEvent(attempt: { checkEvents: { kind: string }[] }, kind: string): boolean {
  return attempt.checkEvents.some((e) => e.kind === kind);
}

async function stamp(prisma: PrismaClient, attempt: { id: string; createdAt: Date }, kind: string, payload: string) {
  await prisma.skillCheckEvent.create({
    data: { attemptId: attempt.id, kind, payload, offsetMs: Math.max(0, Date.now() - attempt.createdAt.getTime()) },
  });
}

/**
 * Commit the whole, before any piece exists. D1 is unscoreable if pieces can
 * precede it, and the ordering *is* the measurement, so this is server-
 * stamped and rejected outright if a `node_added` already happened —
 * matching Clarity's "commit before reveal" locks, for the same reason.
 */
export async function lockDecompositionWhole(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  statement: string,
  doneWhen: string
) {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if (hasEvent(attempt, "whole_stated")) {
    throw new DecompositionSequenceError("The whole is already locked for this attempt.");
  }
  if (hasEvent(attempt, "node_added")) {
    throw new DecompositionSequenceError(
      "A piece already exists for this attempt — the whole must be stated before the first piece, and that order is what D1 measures."
    );
  }
  if (!statement.trim()) throw new DecompositionSequenceError("A whole cannot be empty.");

  await stamp(prisma, attempt, "whole_stated", JSON.stringify({ statement, doneWhen }));
  return { locked: true as const };
}

/**
 * Repair items only: name the fault before fixing it. The tag is checked
 * against the item's seeded fault only once the attempt is scored — this
 * step only commits the guess.
 */
export async function lockDecompositionDiagnosis(prisma: PrismaClient, userId: string, attemptId: string, tags: FaultTag[]) {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const item = specFor(attempt.itemId);

  if (item.type !== "repair") {
    throw new DecompositionSequenceError("Only repair items have something supplied to diagnose.");
  }
  if (hasEvent(attempt, "diagnosis_locked")) {
    throw new DecompositionSequenceError("The diagnosis is already locked.");
  }
  const unknown = tags.filter((t) => !FAULT_TAGS.includes(t));
  if (unknown.length) throw new DecompositionSequenceError(`Unknown fault tag(s): ${unknown.join(", ")}.`);

  await stamp(prisma, attempt, "diagnosis_locked", JSON.stringify(tags));
  return { locked: true as const };
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export type DecompositionRevealPiece = { id: string; label: string; required: boolean; atomic: boolean };
export type DecompositionPairing = { a: string; b: string };

export type DecompositionReveal = {
  pieces: DecompositionRevealPiece[];
  overlapPairs: DecompositionPairing[];
  blockingEdges: DecompositionPairing[];
  independentPairs: DecompositionPairing[];
};

const asPairing = (pairs: [string, string][]): DecompositionPairing[] => pairs.map(([a, b]) => ({ a, b }));

function revealFor(item: PackItem): DecompositionReveal {
  const requiredSet = new Set(item.key.requiredPieceIds);
  return {
    pieces: item.key.pieces.map((p) => ({
      id: p.id,
      label: item.surface.pieceLabels[p.id] ?? p.id,
      required: requiredSet.has(p.id),
      atomic: p.atomic,
    })),
    overlapPairs: asPairing(item.key.overlapPairs),
    blockingEdges: asPairing(item.key.blockingEdges),
    independentPairs: asPairing(item.key.independentPairs),
  };
}

export type DecompositionSubmitResult = {
  attemptId: string;
  score: DecompositionScore;
  /** Repair items only: did the named fault match the seeded one? */
  diagnosisCorrect: boolean | null;
  /** Revision total minus draft total. Null unless this attempt revises another. */
  delta: number | null;
  moduleState: string;
  masteryUnmet: MasteryGap[];
  atCriterion: boolean;
  /** The correct structure, for self-diagnosis on whatever D3/D5/D6 came back unscored. */
  reveal: DecompositionReveal;
};

export async function submitDecompositionAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  input: { structure: DecompositionStructure; timeZoneOffsetMinutes?: number },
  locale: Locale
): Promise<DecompositionSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const { pack } = await loadPack(prisma, userId, locale);
  const item = findItem(pack.items, attempt.itemId);

  const isRevision = attempt.revisionOfAttemptId != null;
  if (!isRevision) {
    if (!hasEvent(attempt, "whole_stated")) {
      throw new DecompositionSequenceError("State the whole before asking for scores.");
    }
    if (item.type === "repair" && !hasEvent(attempt, "diagnosis_locked")) {
      throw new DecompositionSequenceError("Name the fault before asking for scores.");
    }
  }

  const addEventsInOrder = attempt.checkEvents
    .filter((e) => e.kind === "node_added")
    .map((e) => {
      const payload = JSON.parse(e.payload || "{}");
      return { nodeId: payload.nodeId as string, depth: (payload.depth === 2 ? 2 : 1) as 1 | 2 };
    });

  const wholeEvent = attempt.checkEvents.find((e) => e.kind === "whole_stated");
  const firstNodeEvent = attempt.checkEvents.find((e) => e.kind === "node_added");
  const wholeStatedFirst = Boolean(wholeEvent) && (!firstNodeEvent || wholeEvent!.offsetMs <= firstNodeEvent.offsetMs);

  const score = assembleDecompositionScore({
    item,
    structure: input.structure,
    addEventsInOrder,
    wholeStatedFirst,
    itemPrompt: item.surface.scenario,
    locale,
    judgeAvailable: false, // Phase 6
  });

  const diagnosisCorrect =
    item.type === "repair" ? (readDiagnosisTags(attempt.checkEvents)?.includes(item.seededFault!) ?? null) : null;

  const delta = await computeDelta(prisma, attempt.revisionOfAttemptId, score);

  await stamp(prisma, attempt, "breakdown_locked", JSON.stringify({ nodeCount: input.structure.nodes.length }));

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseStructure: JSON.stringify(input.structure),
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({
        latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
        diagnosisCorrect,
        bfi: score.bfi,
        overDecomposed: score.overDecomposed,
      }),
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
      scoredBy: "detector",
    },
  });

  const moduleUpdate = await updateDecompositionModuleProgress(prisma, userId, item.moduleKey, input.timeZoneOffsetMinutes ?? 0);

  return {
    attemptId,
    score,
    diagnosisCorrect,
    delta,
    moduleState: moduleUpdate.state,
    masteryUnmet: moduleUpdate.unmetCriteria,
    atCriterion: atCriterion({
      score,
      moduleKey: item.moduleKey,
      itemType: item.type,
      dayKey: "",
      unscaffolded: true,
      ownCriterion: RUBRIC_CRITERIA_BY_MODULE[item.moduleKey],
    }),
    reveal: revealFor(item),
  };
}

/**
 * Open a revision of a scored attempt — a new row, never an edit, so the
 * draft survives and the delta compares two scored artifacts. A revision
 * follows feedback that named what failed, so it is scaffolded by
 * construction and can never earn mastery.
 */
export async function startDecompositionRevision(prisma: PrismaClient, userId: string, attemptId: string, locale: Locale) {
  const draft = await prisma.skillAttempt.findUnique({ where: { id: attemptId } });
  if (!draft || draft.userId !== userId || draft.skillKey !== SKILL) throw new Error("Not found");

  const scored = JSON.parse(draft.scores || "{}");
  if (!scored.criteria) {
    throw new DecompositionSequenceError("Score the draft before revising it — there is nothing to improve on yet.");
  }
  const existing = await prisma.skillAttempt.findFirst({ where: { revisionOfAttemptId: attemptId } });
  if (existing) throw new DecompositionSequenceError("This attempt has already been revised.");

  const { pack } = await loadPack(prisma, userId, locale);
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
    item: toPublicDecompositionItem(item),
    draftStructure: draft.responseStructure ?? null,
    needsDiagnosis: false, // the diagnosis was committed on the draft
  };
}

// ─── Progress ───────────────────────────────────────────────────────────────

export async function getDecompositionModules(prisma: PrismaClient, userId: string, locale: Locale) {
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
      criterion: RUBRIC_CRITERIA_BY_MODULE[mod.moduleKey],
      state: due ? "due_review" : (p?.state ?? "not_started"),
      currentStep: p?.currentStep ?? 1,
      masteredAt: p?.masteredAt ?? null,
      nextReviewAt: p?.nextReviewAt ?? null,
    };
  });
}

export async function getDecompositionProgress(prisma: PrismaClient, userId: string, locale: Locale) {
  const { profile, pack } = await loadPack(prisma, userId, locale);
  // open_practice (real-work) attempts are excluded from every trend and
  // total here — they're uncalibrated real material, never mastery or probe
  // signal (build plan §3 Phase 7; spec §8).
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });

  const scored = attempts
    .map((a) => ({ row: a, score: JSON.parse(a.scores || "{}") as DecompositionScore }))
    .filter((a) => Array.isArray(a.score.criteria));

  const criterionMeans = ["D1", "D2", "D3", "D4", "D5", "D6"].map((id) => {
    const levels = scored
      .map((a) => a.score.criteria.find((c) => c.id === id)?.level)
      .filter((l): l is 0 | 1 | 2 => l !== null && l !== undefined);
    return { criterion: id, mean: levels.length ? levels.reduce((s: number, l) => s + l, 0) / levels.length : null, count: levels.length };
  });

  const bfiValues = scored.map((a) => a.score.bfi).filter((v): v is number => v !== null);
  const decomposableAttempts = scored.filter((a) => a.row.mode !== "open_practice");
  const decomposableD4Level2 = decomposableAttempts.filter(
    (a) => a.score.criteria.find((c) => c.id === "D4")?.level === 2 && specFor(a.row.itemId).type !== "control"
  ).length;
  const decomposableCount = decomposableAttempts.filter((a) => specFor(a.row.itemId).type !== "control").length;
  const controlAttempts = decomposableAttempts.filter((a) => specFor(a.row.itemId).type === "control");
  const overDecomposedControls = controlAttempts.filter((a) => a.score.overDecomposed).length;

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
    breadthFirstIndexTrend: bfiValues,
    granularityDiscrimination:
      decomposableCount > 0 && controlAttempts.length > 0
        ? decomposableD4Level2 / decomposableCount - overDecomposedControls / controlAttempts.length
        : null,
  };
}

// ─── Internals ──────────────────────────────────────────────────────────────

function readDiagnosisTags(events: { kind: string; payload: string | null }[]): FaultTag[] | null {
  const event = events.find((e) => e.kind === "diagnosis_locked");
  if (!event?.payload) return null;
  try {
    const parsed = JSON.parse(event.payload);
    return Array.isArray(parsed) ? (parsed as FaultTag[]) : null;
  } catch {
    return null;
  }
}

async function computeDelta(prisma: PrismaClient, draftAttemptId: string | null, revisionScore: DecompositionScore): Promise<number | null> {
  if (!draftAttemptId) return null;
  const draft = await prisma.skillAttempt.findUnique({ where: { id: draftAttemptId } });
  if (!draft) return null;
  const draftScore = JSON.parse(draft.scores || "{}") as DecompositionScore;
  if (!Array.isArray(draftScore.criteria)) return null;
  if (draftScore.isVoid || revisionScore.isVoid) return null;
  return revisionScore.total - draftScore.total;
}

/**
 * Recompute a module's state from its unscaffolded attempts. Exported for
 * tests, mirroring `updateClarityModuleProgress`'s precedent (Phase 1b).
 */
export async function updateDecompositionModuleProgress(
  prisma: PrismaClient,
  userId: string,
  moduleKey: DecompositionModuleKey,
  tzOffsetMinutes: number
) {
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, moduleKey },
    orderBy: { createdAt: "asc" },
  });

  const scored: ScoredDecompositionAttempt[] = attempts
    .map((a) => {
      const score = JSON.parse(a.scores || "{}") as DecompositionScore;
      if (!Array.isArray(score.criteria)) return null;
      const spec = specFor(a.itemId);
      return {
        score,
        moduleKey,
        itemType: spec.type,
        dayKey: toDayKey(a.createdAt, tzOffsetMinutes),
        unscaffolded: a.revisionOfAttemptId == null,
        ownCriterion: RUBRIC_CRITERIA_BY_MODULE[moduleKey],
      };
    })
    .filter(Boolean) as ScoredDecompositionAttempt[];

  const verdict = evaluateDecompositionMastery(scored);
  const state = verdict.mastered ? "mastered" : "in_progress";

  const existing = await prisma.skillModuleProgress.findUnique({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
  });

  const data = {
    state: state as any,
    lastCriterionDay: scored.length ? scored[scored.length - 1].dayKey : null,
    ...(verdict.mastered && scheduleOnMastery(existing, new Date(), `${userId}:${moduleKey}`)),
  };

  await prisma.skillModuleProgress.upsert({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
    create: { userId, skillKey: SKILL, moduleKey, ...data },
    update: data,
  });

  return { state, unmetCriteria: verdict.unmetCriteria };
}

export { DECOMPOSITION_MODULE_KEYS };
