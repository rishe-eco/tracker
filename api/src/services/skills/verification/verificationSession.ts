/**
 * Verification Lab session orchestration. Mirrors `decompositionSession.ts`'s
 * shape; what's specific here:
 *
 * 1. **The bench-leak rule shapes every operation.** A served item never
 *    carries `independent`/`discriminating`/outcomes — `toPublicVerificationItem`
 *    strips them. An outcome is served one at a time, on selection, from
 *    `revealVerificationCheck`, never as part of a batch.
 * 2. **Naming the oracle is a lock, same shape as Clarity's prediction lock
 *    and Decomposition's whole-statement lock.** `oracle_named` must precede
 *    the first `check_selected`, server-stamped and rejected otherwise — the
 *    ordering is what V1 measures, not just a UI nicety.
 * 3. **Two commit shapes, one scoring path.** Assisted rung: verdict +
 *    element arrive together, scoring runs immediately. Unassisted rung: the
 *    verdict commits with free-text localisation only, the element list is
 *    returned *after* that commit, and scoring runs once the pick lands in
 *    `setVerificationLocalization` — nothing is revealed before it.
 *
 * Spec: 04-verification-lab.md; build plan §3.
 */

import type { PrismaClient } from "@prisma/client";
import {
  toPublicVerificationItem,
  type Locale,
  type Verdict,
  type VerificationItemSpec,
  type VerificationItemSurface,
  type VerificationModuleKey,
  type PublicVerificationItem,
} from "../../../content/skills/verification/types";
import { buildVerificationPack, ITEM_SPEC_BY_ID, RUBRIC_VERSION } from "../../../content/skills/verification/v1";
import { ensureProfile } from "../profile";
import {
  scheduleOnMastery,
  scheduleOnReviewSubmitted,
  toDayKey,
  type MasterySchedule,
  type ReviewSubmissionSchedule,
} from "../scheduler";
import { loadServingProbe } from "../probes";
import type { MasteryGap } from "../mastery";
import { assistedCeilingFor, costFor } from "./metrics";
import {
  assembleVerificationScore,
  evaluateVerificationMastery,
  promotionEligible,
  type Rung,
  type ScoredVerificationAttempt,
  type VerificationScore,
} from "./scoring";

const SKILL = "verification" as const;

export type VerificationMode = "assessment" | "module" | "review" | "calibrated_practice" | "open_practice";

export class VerificationSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationSequenceError";
  }
}

type PackItem = VerificationItemSpec & { surface: VerificationItemSurface };

async function loadPack(prisma: PrismaClient, userId: string, locale: Locale) {
  const profile = await ensureProfile(prisma, userId, locale, SKILL);
  const pack = buildVerificationPack(locale);
  return { profile, pack };
}

function specFor(itemId: string) {
  const spec = ITEM_SPEC_BY_ID.get(itemId);
  if (!spec) throw new Error(`Verification item "${itemId}" is not in this content version.`);
  return spec;
}

function findItem(items: PackItem[], itemId: string): PackItem {
  const item = items.find((i) => i.itemId === itemId);
  if (!item) throw new Error(`Verification item "${itemId}" is not in this content version.`);
  return item;
}

// ─── Serving ────────────────────────────────────────────────────────────────

export type ServedVerificationItem = {
  attemptId: string;
  item: PublicVerificationItem;
  rung: Rung;
  /** Seconds, only on the assisted rung — the hard ceiling, visible from the start (spec §10). */
  assistedCeilingSeconds: number | null;
};

export async function serveVerificationItem(
  prisma: PrismaClient,
  userId: string,
  mode: VerificationMode,
  moduleKey: VerificationModuleKey | null,
  locale: Locale,
  probeId?: string | null
): Promise<ServedVerificationItem | null> {
  const { profile, pack } = await loadPack(prisma, userId, locale);

  let formId: "A" | "B" | "C" = "A";
  if (mode === "assessment") {
    if (!probeId) {
      throw new VerificationSequenceError("An assessment item must be served inside a probe — call startSkillProbe first.");
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

  // Probes are always unassisted, whatever the learner's module rung — the
  // one assertion that keeps baseline/post/delayed comparable (spec §4a,
  // build plan §5).
  let rung: Rung = "unassisted";
  if (mode !== "assessment") {
    const moduleProgress = await prisma.skillModuleProgress.findUnique({
      where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey: chosen.moduleKey } },
    });
    rung = (moduleProgress?.rung as Rung | undefined) ?? "assisted";
  }

  const attempt = await prisma.skillAttempt.create({
    data: {
      userId,
      skillKey: SKILL,
      moduleKey: chosen.moduleKey,
      itemId: chosen.itemId,
      formId: chosen.formId,
      mode: mode as any,
      probeId: mode === "assessment" ? probeId : null,
      rung,
      scores: "{}",
      contentVersion: profile.contentVersion,
      rubricVersion: RUBRIC_VERSION,
      scoredBy: "detector",
    },
  });

  return {
    attemptId: attempt.id,
    item: toPublicVerificationItem(chosen),
    rung,
    assistedCeilingSeconds: rung === "assisted" ? assistedCeilingFor(chosen.bench) : null,
  };
}

// ─── Locks and live events ──────────────────────────────────────────────────

async function loadOpenAttempt(prisma: PrismaClient, userId: string, attemptId: string) {
  const attempt = await prisma.skillAttempt.findUnique({
    where: { id: attemptId },
    include: { checkEvents: { orderBy: { offsetMs: "asc" } } },
  });
  if (!attempt || attempt.userId !== userId || attempt.skillKey !== SKILL) throw new Error("Not found");
  if (JSON.parse(attempt.scores || "{}").criteria) {
    throw new VerificationSequenceError("This attempt is already scored and cannot be changed.");
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

/** V1 is unscoreable if a check can precede it — server-stamped, rejected once any check has been selected. */
export async function nameVerificationOracle(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  text: string,
  predictedCostSeconds?: number | null
) {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if (hasEvent(attempt, "check_selected")) {
    throw new VerificationSequenceError("A check has already been run for this attempt — the oracle must be named first, and that order is what V1 measures.");
  }
  if (hasEvent(attempt, "oracle_named")) {
    throw new VerificationSequenceError("The oracle is already named for this attempt.");
  }
  if (!text.trim()) throw new VerificationSequenceError("An oracle statement cannot be empty.");

  await stamp(prisma, attempt, "oracle_named", { text, predictedCostSeconds: predictedCostSeconds ?? null });
  return { locked: true as const };
}

export type CheckRevealResult = {
  checkId: string;
  outcome: string;
  costSeconds: number;
  cumulativeSpent: number;
  ceilingSeconds: number | null;
};

export async function revealVerificationCheck(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  checkId: string,
  locale: Locale
): Promise<CheckRevealResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if (!hasEvent(attempt, "oracle_named")) {
    throw new VerificationSequenceError("Name an oracle before opening the bench.");
  }

  const alreadyRevealed = eventsOfKind(attempt, "check_revealed").some(
    (e) => payloadOf<{ checkId: string }>(e)?.checkId === checkId
  );
  if (alreadyRevealed) throw new VerificationSequenceError("This check has already been revealed.");

  const item = specFor(attempt.itemId);
  const entry = item.bench.find((b) => b.checkId === checkId);
  if (!entry) throw new VerificationSequenceError(`Unknown check "${checkId}" for this item.`);

  const priorCheckIds = eventsOfKind(attempt, "check_selected").map((e) => payloadOf<{ checkId: string }>(e)?.checkId ?? "");
  const { costSpent: priorSpent } = costFor(item.bench, priorCheckIds);
  const cumulativeSpent = priorSpent + entry.costSeconds;

  const rung = attempt.rung as Rung;
  const ceilingSeconds = rung === "assisted" ? assistedCeilingFor(item.bench) : null;
  if (ceilingSeconds !== null && cumulativeSpent > ceilingSeconds) {
    throw new VerificationSequenceError(`Running this check would spend ${cumulativeSpent}s against a ${ceilingSeconds}s ceiling.`);
  }

  const { pack } = await loadPack(prisma, userId, locale);
  const fullItem = findItem(pack.items, attempt.itemId);
  const outcome = fullItem.surface.checkOutcomes[checkId] ?? "";

  await stamp(prisma, attempt, "check_selected", { checkId });
  await stamp(prisma, attempt, "check_revealed", { checkId, outcome });

  return { checkId, outcome, costSeconds: entry.costSeconds, cumulativeSpent, ceilingSeconds };
}

/**
 * The assisted rung shows the element list at the verdict step, before the
 * commit call — unlike the unassisted rung, where the list only exists in
 * the commit's own response. A dedicated call rather than folding it into
 * the served item keeps the list out of the client's memory for the whole
 * check-selection stage, not merely unrendered: nothing before this call
 * ever holds it.
 */
export async function loadVerificationElements(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  locale: Locale
): Promise<LocalisationElement[]> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if ((attempt.rung as Rung) !== "assisted") {
    throw new VerificationSequenceError("The element list is only fetched separately on the assisted rung.");
  }
  if (!hasEvent(attempt, "oracle_named")) {
    throw new VerificationSequenceError("Name an oracle before requesting the element list.");
  }
  const { pack } = await loadPack(prisma, userId, locale);
  const item = findItem(pack.items, attempt.itemId);
  return item.elements.map((e) => ({ elementId: e.elementId, label: item.surface.elementLabels[e.elementId] ?? e.elementId }));
}

// ─── Commit and scoring ─────────────────────────────────────────────────────

export type CommitInput = {
  verdict: Verdict;
  confidence: number;
  residualRisk: string;
  /** Assisted rung only — arrives with the commit. */
  elementId?: string | null;
  /** Unassisted rung only — committed before the element list is shown. */
  elementFreeText?: string | null;
};

export type LocalisationElement = { elementId: string; label: string };

export type VerificationCommitResult =
  | { stage: "scored"; result: VerificationSubmitResult }
  | { stage: "awaitingLocalisation"; elements: LocalisationElement[] };

export type VerificationSubmitResult = {
  attemptId: string;
  score: VerificationScore;
  moduleState: string;
  masteryUnmet: MasteryGap[];
  promotionOffered: boolean;
  /** Only once scored — the cheapest sufficient check and the ideal cost, never shown before commit. */
  reveal: { failingElementLabel: string | null; cheapestCheckId: string | null; cheapestCostSeconds: number | null };
};

export async function commitVerificationVerdict(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  input: CommitInput,
  locale: Locale,
  timeZoneOffsetMinutes = 0
): Promise<VerificationCommitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if (!hasEvent(attempt, "oracle_named")) {
    throw new VerificationSequenceError("Name an oracle before committing a verdict.");
  }
  if (hasEvent(attempt, "verdict_set")) {
    throw new VerificationSequenceError("A verdict is already committed for this attempt.");
  }

  const { pack } = await loadPack(prisma, userId, locale);
  const item = findItem(pack.items, attempt.itemId);
  const rung = attempt.rung as Rung;

  if (rung === "assisted") {
    if (!input.elementId) {
      throw new VerificationSequenceError("The assisted rung commits verdict and localisation together.");
    }
    await stamp(prisma, attempt, "verdict_set", {
      verdict: input.verdict,
      confidence: input.confidence,
      residualRisk: input.residualRisk,
      elementId: input.elementId,
    });
    await stamp(prisma, attempt, "localization_set", { elementId: input.elementId });
    const result = await finalizeVerificationAttempt(prisma, userId, attemptId, locale, timeZoneOffsetMinutes);
    return { stage: "scored", result };
  }

  if (!input.elementFreeText?.trim()) {
    throw new VerificationSequenceError("The unassisted rung requires a free-text localisation before the element list appears.");
  }
  await stamp(prisma, attempt, "verdict_set", {
    verdict: input.verdict,
    confidence: input.confidence,
    residualRisk: input.residualRisk,
    elementFreeText: input.elementFreeText,
  });

  const elements: LocalisationElement[] = item.elements.map((e) => ({
    elementId: e.elementId,
    label: item.surface.elementLabels[e.elementId] ?? e.elementId,
  }));
  return { stage: "awaitingLocalisation", elements };
}

/** Unassisted rung only — the pick is what's scored; nothing is revealed before it. */
export async function setVerificationLocalization(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  elementId: string,
  locale: Locale,
  timeZoneOffsetMinutes = 0
): Promise<VerificationSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  if ((attempt.rung as Rung) !== "unassisted") {
    throw new VerificationSequenceError("Only the unassisted rung has a separate localisation step.");
  }
  if (!hasEvent(attempt, "verdict_set")) {
    throw new VerificationSequenceError("Commit a verdict before localising.");
  }
  if (hasEvent(attempt, "localization_set")) {
    throw new VerificationSequenceError("Localisation is already committed for this attempt.");
  }

  await stamp(prisma, attempt, "localization_set", { elementId });
  return finalizeVerificationAttempt(prisma, userId, attemptId, locale, timeZoneOffsetMinutes);
}

async function finalizeVerificationAttempt(
  prisma: PrismaClient,
  userId: string,
  attemptId: string,
  locale: Locale,
  timeZoneOffsetMinutes: number
): Promise<VerificationSubmitResult> {
  const attempt = await loadOpenAttempt(prisma, userId, attemptId);
  const { pack } = await loadPack(prisma, userId, locale);
  const item = findItem(pack.items, attempt.itemId);

  const oracleEvent = eventsOfKind(attempt, "oracle_named")[0];
  const oracle = payloadOf<{ text: string; predictedCostSeconds: number | null }>(oracleEvent);
  const verdictEvent = eventsOfKind(attempt, "verdict_set")[0];
  const verdictPayload = payloadOf<{
    verdict: Verdict;
    confidence: number;
    residualRisk: string;
    elementId?: string;
    elementFreeText?: string;
  }>(verdictEvent);
  const localizationEvent = eventsOfKind(attempt, "localization_set")[0];
  const localization = payloadOf<{ elementId: string }>(localizationEvent);

  if (!oracle || !verdictPayload) throw new VerificationSequenceError("Cannot score an attempt with no oracle or verdict.");

  const selectedCheckIds = eventsOfKind(attempt, "check_selected").map((e) => payloadOf<{ checkId: string }>(e)?.checkId ?? "");
  const firstCheckOffset = eventsOfKind(attempt, "check_selected")[0]?.offsetMs;
  const oracleNamedBeforeAnyCheck = firstCheckOffset === undefined || oracleEvent.offsetMs <= firstCheckOffset;

  const score = assembleVerificationScore({
    item: {
      profile: item.profile,
      bench: item.bench,
      elements: item.elements,
      failingElementId: item.failingElementId,
      keyVerdict: item.keyVerdict,
      notWorthChecking: item.notWorthChecking,
    },
    locale,
    rung: attempt.rung as Rung,
    oracleText: oracle.text,
    oracleNamedBeforeAnyCheck,
    selectedCheckIds,
    verdict: verdictPayload.verdict,
    elementId: localization?.elementId ?? null,
    residualRisk: verdictPayload.residualRisk,
    answerText: item.surface.answer,
  });

  await prisma.skillAttempt.update({
    where: { id: attemptId },
    data: {
      responseStructure: JSON.stringify({
        oracle: { text: oracle.text, predictedCostSeconds: oracle.predictedCostSeconds },
        checksRun: selectedCheckIds,
        verdict: verdictPayload.verdict,
        confidence: verdictPayload.confidence,
        elementFreeText: verdictPayload.elementFreeText ?? null,
        elementId: localization?.elementId ?? null,
        residualRisk: verdictPayload.residualRisk,
      }),
      scores: JSON.stringify(score),
      behaviors: JSON.stringify({
        latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
        ritualState: score.ritualState,
        costSpent: score.costSpent,
        costRatio: score.costRatio,
      }),
      confidence: verdictPayload.confidence,
      latencyMs: Math.max(0, Date.now() - attempt.createdAt.getTime()),
      rung: attempt.rung,
      scoredBy: "mixed",
    },
  });

  const moduleUpdate =
    attempt.mode !== "open_practice"
      ? await updateVerificationModuleProgress(prisma, userId, attempt.moduleKey as VerificationModuleKey, timeZoneOffsetMinutes, {
          mode: attempt.mode as VerificationMode,
          passed: score.strict,
        })
      : { state: "not_started", unmetCriteria: [] as MasteryGap[] };

  const promotionOffered =
    attempt.mode !== "open_practice" && attempt.rung === "assisted"
      ? await isPromotionOffered(prisma, userId, attempt.moduleKey as VerificationModuleKey)
      : false;

  const cheapest = item.bench.filter((b) => b.discriminating).sort((a, b) => a.costSeconds - b.costSeconds)[0] ?? null;

  return {
    attemptId,
    score,
    moduleState: moduleUpdate.state,
    masteryUnmet: moduleUpdate.unmetCriteria,
    promotionOffered,
    reveal: {
      failingElementLabel: item.failingElementId ? item.surface.elementLabels[item.failingElementId] ?? null : null,
      cheapestCheckId: cheapest?.checkId ?? null,
      cheapestCostSeconds: cheapest?.costSeconds ?? null,
    },
  };
}

// ─── Rung ───────────────────────────────────────────────────────────────────

/** The only way a module's rung changes — always a learner action, offered but never forced (spec §4a). */
export async function setVerificationRung(prisma: PrismaClient, userId: string, moduleKey: VerificationModuleKey, rung: Rung) {
  await ensureProfile(prisma, userId, "en", SKILL);
  await prisma.skillModuleProgress.upsert({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
    create: { userId, skillKey: SKILL, moduleKey, rung },
    update: { rung },
  });
  return { rung };
}

async function isPromotionOffered(prisma: PrismaClient, userId: string, moduleKey: VerificationModuleKey): Promise<boolean> {
  const attempts = await loadScoredAttempts(prisma, userId, moduleKey, 0);
  const assisted = attempts.filter((a) => a.score.rung === "assisted");
  return promotionEligible(assisted);
}

// ─── Progress ───────────────────────────────────────────────────────────────

export async function getVerificationModules(prisma: PrismaClient, userId: string, locale: Locale) {
  const { pack } = await loadPack(prisma, userId, locale);
  const progress = await prisma.skillModuleProgress.findMany({ where: { userId, skillKey: SKILL } });
  const byKey = new Map(progress.map((p) => [p.moduleKey, p]));
  const now = Date.now();

  return Promise.all(
    pack.modules.map(async (mod) => {
      const p = byKey.get(mod.moduleKey);
      const due = p?.nextReviewAt != null && p.nextReviewAt.getTime() <= now;
      const rung = (p?.rung as Rung | undefined) ?? "assisted";
      return {
        moduleKey: mod.moduleKey,
        title: mod.title,
        concept: mod.concept,
        model: mod.model,
        rung,
        state: due ? "due_review" : (p?.state ?? "not_started"),
        currentStep: p?.currentStep ?? 1,
        masteredAt: p?.masteredAt ?? null,
        nextReviewAt: p?.nextReviewAt ?? null,
        promotionOffered: rung === "assisted" ? await isPromotionOffered(prisma, userId, mod.moduleKey) : false,
      };
    })
  );
}

export async function getVerificationProgress(prisma: PrismaClient, userId: string, locale: Locale) {
  const { profile, pack } = await loadPack(prisma, userId, locale);
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });

  const scored = attempts
    .map((a) => ({ row: a, score: JSON.parse(a.scores || "{}") as VerificationScore }))
    .filter((a) => Array.isArray(a.score.criteria));

  const criterionMeans = ["V1", "V2", "V3", "V4", "V5", "V6"].map((id) => {
    const levels = scored
      .map((a) => a.score.criteria.find((c) => c.id === id)?.level)
      .filter((l): l is 0 | 1 | 2 => l !== null && l !== undefined);
    return { criterion: id, mean: levels.length ? levels.reduce((s: number, l) => s + l, 0) / levels.length : null, count: levels.length };
  });

  const strictCount = scored.filter((a) => a.score.strict).length;
  const ritualCount = scored.filter((a) => a.score.ritualState === "none-could-fail").length;
  const costRatios = scored.map((a) => a.score.costRatio).filter((r): r is number => r !== null);

  const faultyAttempts = scored.filter((a) => specFor(a.row.itemId).profile !== "CORRECT" && specFor(a.row.itemId).profile !== "NO_ORACLE");
  const controlAttempts = scored.filter((a) => specFor(a.row.itemId).profile === "CORRECT");
  const hits = faultyAttempts.filter((a) => a.score.strict).length;
  const falseAlarms = controlAttempts.filter((a) => !a.score.strict).length;

  const noOracleAttempts = scored.filter((a) => specFor(a.row.itemId).profile === "NO_ORACLE");
  const correctUnverified = noOracleAttempts.filter((a) => a.score.strict).length;
  const verifiableAttempts = scored.filter((a) => specFor(a.row.itemId).profile !== "NO_ORACLE");
  const falseUnverified = verifiableAttempts.filter((a) => {
    const resp = JSON.parse(a.row.responseStructure || "{}");
    return resp.verdict === "cannot_verify";
  }).length;

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
    strictComposite: scored.length ? strictCount / scored.length : null,
    ritualRate: scored.length ? ritualCount / scored.length : null,
    discrimination: faultyAttempts.length || controlAttempts.length ? hits / Math.max(1, faultyAttempts.length) - falseAlarms / Math.max(1, controlAttempts.length) : null,
    meanCostRatio: costRatios.length ? costRatios.reduce((a, b) => a + b, 0) / costRatios.length : null,
    correctUnverifiedCount: correctUnverified,
    falseUnverifiedCount: falseUnverified,
  };
}

// ─── Internals ──────────────────────────────────────────────────────────────

async function loadScoredAttempts(
  prisma: PrismaClient,
  userId: string,
  moduleKey: VerificationModuleKey,
  tzOffsetMinutes: number
): Promise<ScoredVerificationAttempt[]> {
  const attempts = await prisma.skillAttempt.findMany({
    where: { userId, skillKey: SKILL, moduleKey, mode: { not: "open_practice" } },
    orderBy: { createdAt: "asc" },
  });

  return attempts
    .map((a) => {
      const score = JSON.parse(a.scores || "{}") as VerificationScore;
      if (!Array.isArray(score.criteria)) return null;
      return { score, profile: specFor(a.itemId).profile, dayKey: toDayKey(a.createdAt, tzOffsetMinutes) };
    })
    .filter(Boolean) as ScoredVerificationAttempt[];
}

/** Exported for tests, mirroring `updateDecompositionModuleProgress`'s precedent. */
export async function updateVerificationModuleProgress(
  prisma: PrismaClient,
  userId: string,
  moduleKey: VerificationModuleKey,
  tzOffsetMinutes: number,
  submitted?: { mode: VerificationMode; passed: boolean | null } | null
) {
  const allAttempts = await loadScoredAttempts(prisma, userId, moduleKey, tzOffsetMinutes);
  const unassisted = allAttempts.filter((a) => a.score.rung === "unassisted");

  const verdict = evaluateVerificationMastery(unassisted);
  const state = verdict.mastered ? "mastered" : "in_progress";

  const existing = await prisma.skillModuleProgress.findUnique({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
  });

  // A review-mode submission carries its own schedule, from the pass/fail of
  // that one attempt — not the mastery window's rolling verdict. Any other
  // mode falls back to the ordinary first-mastery scheduling.
  //
  // `passed: null` means the module has no per-attempt verdict to read: its
  // criterion is scored over a window rather than per attempt, so the only
  // honest answer to "did this review pass" is whether the module still holds.
  const schedule: Partial<ReviewSubmissionSchedule & MasterySchedule> =
    submitted?.mode === "review"
      ? scheduleOnReviewSubmitted(submitted.passed ?? verdict.mastered, existing, new Date(), `${userId}:${moduleKey}`)
      : verdict.mastered
        ? scheduleOnMastery(existing, new Date(), `${userId}:${moduleKey}`)
        : {};

  const data = {
    state: state as any,
    lastCriterionDay: allAttempts.length ? allAttempts[allAttempts.length - 1].dayKey : null,
    ...schedule,
  };

  await prisma.skillModuleProgress.upsert({
    where: { userId_skillKey_moduleKey: { userId, skillKey: SKILL, moduleKey } },
    create: { userId, skillKey: SKILL, moduleKey, ...data },
    update: data,
  });

  return { state, unmetCriteria: verdict.unmetCriteria };
}

export { VERIFICATION_MODULE_KEYS } from "../../../content/skills/verification/types";
