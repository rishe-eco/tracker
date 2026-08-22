/**
 * Skill probes — baseline, post, and the 7-day delayed retention check.
 *
 * Deliberately skill-agnostic (build plan `03b-decomposition-lab-build-plan.md`
 * §3 Phase 5): Evidence and Clarity inherit this exactly as Decomposition does,
 * so it lives here rather than under `decomposition/`. What this file owns is
 * the *container* — which form (A/B/C) a timepoint gets, whether a pack can be
 * probed at all, when a probe is complete, the delayed probe's own scheduling,
 * and the self-report that must never enter a score. What it does not own is
 * the shape of a single item's score: those stay each tool's own type, per the
 * Clarity precedent (widening one shared shape would force every field on all
 * three tools to be nullable). `summarizeAttempts` below is the one place that
 * necessarily branches per skill, because totals mean something different for
 * behaviour (Evidence) than for a rubric (Clarity, Decomposition).
 *
 * Before this file, nothing ever wrote a `SkillProbe` row, and nothing ever
 * set `SkillProfile.assessmentCompletedAt` either — `hasBaseline` had been
 * permanently false in every progress screen. `completeSkillProbe` is now the
 * one place that stamps it, for the timepoint that fixes that.
 *
 * Spec: 00-skills-engine.md §6; build plan §3 Phase 5.
 */

import type { PrismaClient } from "@prisma/client";
import type { FormId, Locale, SkillKey } from "../../content/skills/types";
import { EVIDENCE_MODULE_KEYS } from "../../content/skills/types";
import { getEvidencePack, isProbeReady as isEvidenceProbeReady, validateEvidenceContent } from "../../content/skills";
import { CLARITY_MODULE_KEYS } from "../../content/skills/clarity/types";
import { buildClarityPack, RUBRIC_VERSION as CLARITY_RUBRIC_VERSION } from "../../content/skills/clarity/v1";
import { isProbeReady as isClarityProbeReady, validateClarityContent } from "../../content/skills/clarity/validate";
import { DECOMPOSITION_MODULE_KEYS } from "../../content/skills/decomposition/types";
import { buildDecompositionPack, RUBRIC_VERSION as DECOMPOSITION_RUBRIC_VERSION } from "../../content/skills/decomposition/v1";
import {
  isProbeReady as isDecompositionProbeReady,
  validateDecompositionContent,
} from "../../content/skills/decomposition/validate";
import { VERIFICATION_MODULE_KEYS } from "../../content/skills/verification/types";
import { buildVerificationPack, RUBRIC_VERSION as VERIFICATION_RUBRIC_VERSION } from "../../content/skills/verification/v1";
import {
  isProbeReady as isVerificationProbeReady,
  validateVerificationContent,
} from "../../content/skills/verification/validate";
import { ensureProfile } from "./profile";
import { delayedProbeDueAt, hashSeed } from "./scheduler";
import { scoreSession, type EvidenceItemScore } from "./scoring";

export type ProbeTimepoint = "baseline" | "post" | "delayed";
export type ProbeForm = "A" | "B" | "C";

/** Self-efficacy items per timepoint — collected, never scored (§6). */
export const SELF_REPORT_ITEM_COUNT = 4;

export class ProbeNotReadyError extends Error {
  constructor(blockers: string[]) {
    super(
      "This content version cannot serve a scored probe yet: " +
        `${blockers.length} item(s) still need a human to verify the answer key. ` +
        "Practice works today; probes unlock when verification is done."
    );
    this.name = "ProbeNotReadyError";
  }
}

export class ProbeSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeSequenceError";
  }
}

const MODULE_KEYS: Record<SkillKey, readonly string[]> = {
  evidence: EVIDENCE_MODULE_KEYS,
  clarity: CLARITY_MODULE_KEYS,
  decomposition: DECOMPOSITION_MODULE_KEYS,
  verification: VERIFICATION_MODULE_KEYS,
};

const FORMS: ProbeForm[] = ["A", "B", "C"];
const BASE_INDEX: Record<ProbeTimepoint, number> = { baseline: 0, post: 1, delayed: 2 };

/**
 * Which physical form (A/B/C) a timepoint gets, for this user.
 *
 * Assignment is fixed at first use — baseline=A, post=B, delayed=C — offset by
 * a per-user, per-skill hash so the same physical items don't always occupy
 * the same timepoint across every learner (00-skills-engine.md §6). Purely a
 * function of (userId, skillKey, timepoint), so it never needs to be stored.
 */
export function formForTimepoint(userId: string, skillKey: SkillKey, timepoint: ProbeTimepoint): ProbeForm {
  const offset = hashSeed(`${userId}:${skillKey}:probe-rotation`) % 3;
  return FORMS[(BASE_INDEX[timepoint] + offset) % 3];
}

function blockersFrom(issues: { severity: string; code: string; message: string }[]): string[] {
  return issues
    .filter((i) => i.severity === "error" || i.code === "key-unverified" || i.code === "snapshot-pending")
    .map((i) => i.message);
}

/**
 * Whether this skill's current content can serve a scored probe at all —
 * exposed so Clarity's and Decomposition's progress screens can show the
 * same "not ready yet" state Evidence's `SkillProgress.probeReady` already
 * did, rather than offering a "start baseline" button that dead-ends in a
 * ProbeNotReadyError.
 */
export function probeReadinessFor(skillKey: SkillKey): { ready: boolean; blockers: string[] } {
  if (skillKey === "evidence") {
    const issues = validateEvidenceContent();
    return { ready: isEvidenceProbeReady(issues), blockers: blockersFrom(issues) };
  }
  if (skillKey === "clarity") {
    const issues = validateClarityContent();
    return { ready: isClarityProbeReady(issues), blockers: blockersFrom(issues) };
  }
  if (skillKey === "decomposition") {
    const issues = validateDecompositionContent();
    return { ready: isDecompositionProbeReady(issues), blockers: blockersFrom(issues) };
  }
  const issues = validateVerificationContent();
  return { ready: isVerificationProbeReady(issues), blockers: blockersFrom(issues) };
}

type PackInfo = { items: { formId: FormId }[]; rubricVersion: string | null };

async function loadPackInfo(prisma: PrismaClient, userId: string, skillKey: SkillKey, locale: Locale): Promise<PackInfo> {
  if (skillKey === "evidence") {
    const profile = await ensureProfile(prisma, userId, locale, skillKey);
    const pack = getEvidencePack(profile.contentVersion, locale);
    return { items: pack.items, rubricVersion: null };
  }
  if (skillKey === "clarity") {
    const pack = buildClarityPack(locale);
    return { items: pack.items, rubricVersion: CLARITY_RUBRIC_VERSION };
  }
  if (skillKey === "decomposition") {
    const pack = buildDecompositionPack(locale);
    return { items: pack.items, rubricVersion: DECOMPOSITION_RUBRIC_VERSION };
  }
  const pack = buildVerificationPack(locale);
  return { items: pack.items, rubricVersion: VERIFICATION_RUBRIC_VERSION };
}

// ─── Serving support ────────────────────────────────────────────────────────

/**
 * Load the probe an "assessment"-mode item is about to be served into.
 *
 * Called from each tool's own `serve*Item` — never from here — so that an
 * assessment item can only ever be tagged with a probe the caller actually
 * owns, and the *form* comes from the probe row rather than being asserted by
 * the client on every call.
 */
export async function loadServingProbe(prisma: PrismaClient, userId: string, skillKey: SkillKey, probeId: string) {
  const probe = await prisma.skillProbe.findUnique({ where: { id: probeId } });
  if (!probe || probe.userId !== userId || probe.skillKey !== skillKey) throw new Error("Not found");
  if (probe.completedAt) {
    throw new ProbeSequenceError("This probe is already completed — items cannot be added to it.");
  }
  return probe;
}

// ─── Start / complete ───────────────────────────────────────────────────────

export type ProbeStartResult = {
  probeId: string;
  timepoint: ProbeTimepoint;
  formId: ProbeForm;
  /** True when a probe for this timepoint already existed and was reopened. */
  resuming: boolean;
  alreadyCompleted: boolean;
};

/**
 * Open (or resume) a probe.
 *
 * The delayed probe is never created here — `completeSkillProbe` creates it
 * proactively when the post probe completes, so it can be `scheduledFor` a
 * date and surfaced as a due item before anyone asks to start it. Calling this
 * for `delayed` before that has happened is a sequence error, not a fallback
 * creation, because a delayed probe with no `scheduledFor` would surface as
 * due immediately — the exact bug the schedule exists to prevent.
 */
export async function startSkillProbe(
  prisma: PrismaClient,
  userId: string,
  skillKey: SkillKey,
  timepoint: ProbeTimepoint,
  locale: Locale
): Promise<ProbeStartResult> {
  const profile = await ensureProfile(prisma, userId, locale, skillKey);

  const existing = await prisma.skillProbe.findUnique({
    where: { userId_skillKey_timepoint: { userId, skillKey, timepoint } },
  });

  if (existing?.completedAt) {
    return {
      probeId: existing.id,
      timepoint,
      formId: existing.formId as ProbeForm,
      resuming: false,
      alreadyCompleted: true,
    };
  }

  if (existing) {
    // A delayed row is created ahead of time (by completeSkillProbe on post),
    // scheduledFor 7 days out — its existence is not the same thing as being
    // due. Starting it early would defeat the one measurement this timepoint
    // exists to take: retention after a real gap, not an immediate re-ask.
    if (timepoint === "delayed" && existing.scheduledFor && existing.scheduledFor.getTime() > Date.now()) {
      throw new ProbeSequenceError("The delayed probe isn't due yet.");
    }
    const wasStarted = existing.startedAt != null;
    if (!wasStarted) {
      await prisma.skillProbe.update({ where: { id: existing.id }, data: { startedAt: new Date() } });
    }
    return {
      probeId: existing.id,
      timepoint,
      formId: existing.formId as ProbeForm,
      resuming: wasStarted,
      alreadyCompleted: false,
    };
  }

  if (timepoint === "delayed") {
    throw new ProbeSequenceError(
      "The delayed probe is scheduled automatically once the post probe completes — there is nothing to start yet."
    );
  }

  const readiness = probeReadinessFor(skillKey);
  if (!readiness.ready) throw new ProbeNotReadyError(readiness.blockers);

  const formId = formForTimepoint(userId, skillKey, timepoint);
  const created = await prisma.skillProbe.create({
    data: {
      userId,
      skillKey,
      timepoint,
      formId,
      startedAt: new Date(),
      contentVersion: profile.contentVersion,
    },
  });

  return { probeId: created.id, timepoint, formId, resuming: false, alreadyCompleted: false };
}

function meanByKey(scores: any[], criteria: readonly string[], key: "criterion" | "id"): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const critId of criteria) {
    const levels = scores
      .map((s) => s.criteria?.find((c: any) => c[key] === critId)?.level)
      .filter((l: any): l is 0 | 1 | 2 => l === 0 || l === 1 || l === 2);
    out[critId] = levels.length ? levels.reduce((a: number, b: number) => a + b, 0) / levels.length : null;
  }
  return out;
}

/**
 * Per-skill totals. Deliberately the one branch in this file that isn't
 * shared: Evidence's headline number is a behavioural composite over 0/1
 * outcomes, Clarity's and Decomposition's are rubric means over 0-2 levels —
 * pretending those are the same shape would either lose Evidence's discipline
 * (hit rate minus false-alarm rate, never raw accuracy) or force a rubric
 * total to look like a single behavioural number it isn't.
 */
function summarizeAttempts(skillKey: SkillKey, attempts: { scores: string }[]) {
  const scores = attempts.map((a) => JSON.parse(a.scores || "{}"));

  if (skillKey === "evidence") {
    return scoreSession(scores as EvidenceItemScore[]);
  }

  if (skillKey === "verification") {
    // A probe attempt is always unassisted (build plan §5), so every
    // criterion is scoreable on every scored attempt — unlike the module
    // progress screen, this total never has to account for a ceiling or a
    // control's inapplicable V5.
    const scored = scores.filter((s) => Array.isArray(s.criteria));
    const strictCount = scored.filter((s) => s.strict === true).length;
    const ritualCount = scored.filter((s) => s.ritualState === "none-could-fail").length;
    const costRatios = scored.map((s) => s.costRatio).filter((r: unknown): r is number => typeof r === "number");
    return {
      itemCount: scored.length,
      meanTotal: null,
      criteria: meanByKey(scored, ["V1", "V2", "V3", "V4", "V5", "V6"], "id"),
      strictComposite: scored.length ? strictCount / scored.length : null,
      ritualRate: scored.length ? ritualCount / scored.length : null,
      meanCostRatio: costRatios.length ? costRatios.reduce((a: number, b: number) => a + b, 0) / costRatios.length : null,
    };
  }

  const criteria = skillKey === "clarity" ? (["R1", "R2", "R3", "R4", "R5", "R6"] as const) : (["D1", "D2", "D3", "D4", "D5", "D6"] as const);
  const key = skillKey === "clarity" ? ("criterion" as const) : ("id" as const);
  const scored = scores.filter((s) => Array.isArray(s.criteria));
  const totals = scored.map((s) => s.total).filter((t): t is number => typeof t === "number");

  return {
    itemCount: scored.length,
    meanTotal: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    criteria: meanByKey(scored, criteria, key),
  };
}

export type ProbeCompleteResult = {
  probeId: string;
  timepoint: ProbeTimepoint;
  formId: ProbeForm;
  itemCount: number;
  totals: string;
  completedAt: Date;
};

/**
 * Close out a probe: stamp totals, the self-report, and — for `post` only —
 * schedule the delayed probe 7 days out. Rejects a second completion, the same
 * per-attempt immutability rule Evidence and Clarity already apply to a single
 * `SkillAttempt` (engine §7), applied here to the probe as a whole.
 */
export async function completeSkillProbe(
  prisma: PrismaClient,
  userId: string,
  skillKey: SkillKey,
  timepoint: ProbeTimepoint,
  selfReport: number[],
  locale: Locale
): Promise<ProbeCompleteResult> {
  const probe = await prisma.skillProbe.findUnique({
    where: { userId_skillKey_timepoint: { userId, skillKey, timepoint } },
  });
  if (!probe || probe.userId !== userId) throw new Error("Not found");
  if (probe.completedAt) throw new ProbeSequenceError("This probe is already completed.");

  if (!Array.isArray(selfReport) || selfReport.length !== SELF_REPORT_ITEM_COUNT) {
    throw new Error(`selfReport must have exactly ${SELF_REPORT_ITEM_COUNT} entries.`);
  }
  if (selfReport.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
    throw new Error("Each selfReport entry must be between 0 and 100.");
  }

  const attempts = await prisma.skillAttempt.findMany({
    where: { probeId: probe.id },
    orderBy: { createdAt: "asc" },
  });

  const packInfo = await loadPackInfo(prisma, userId, skillKey, locale);
  const expected = packInfo.items.filter((i) => i.formId === probe.formId).length;
  if (attempts.length < expected) {
    throw new ProbeSequenceError(
      `${attempts.length} of ${expected} items answered — finish the form before completing the probe.`
    );
  }

  const totals = summarizeAttempts(skillKey, attempts);
  const now = new Date();

  await prisma.skillProbe.update({
    where: { id: probe.id },
    data: {
      completedAt: now,
      totals: JSON.stringify(totals),
      rubricVersion: packInfo.rubricVersion,
      selfReport: JSON.stringify(selfReport),
    },
  });

  if (timepoint === "baseline") {
    await prisma.skillProfile.update({
      where: { userId_skillKey: { userId, skillKey } },
      data: { assessmentCompletedAt: now },
    });
  }

  if (timepoint === "post") {
    const existingDelayed = await prisma.skillProbe.findUnique({
      where: { userId_skillKey_timepoint: { userId, skillKey, timepoint: "delayed" } },
    });
    if (!existingDelayed) {
      const profile = await ensureProfile(prisma, userId, locale, skillKey);
      await prisma.skillProbe.create({
        data: {
          userId,
          skillKey,
          timepoint: "delayed",
          formId: formForTimepoint(userId, skillKey, "delayed"),
          scheduledFor: delayedProbeDueAt(now),
          contentVersion: profile.contentVersion,
        },
      });
    }
  }

  return { probeId: probe.id, timepoint, formId: probe.formId as ProbeForm, itemCount: attempts.length, totals: JSON.stringify(totals), completedAt: now };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export type SkillProbeEntry = {
  timepoint: ProbeTimepoint;
  formId: ProbeForm;
  scheduledFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  contentVersion: string;
  rubricVersion: string | null;
  totals: string | null;
  selfReport: string | null;
  /**
   * False when this probe's content or rubric version differs from what the
   * learner is currently pinned to. Computed here rather than left to the
   * client, per §6's "comparability enforced in code, not just in docs" — a
   * chart that pools across a version boundary is the single most common way
   * a tool like this quietly invalidates its own history.
   */
  comparable: boolean;
};

function toEntry(
  p: {
    timepoint: string;
    formId: string;
    scheduledFor: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    contentVersion: string;
    rubricVersion: string | null;
    totals: string | null;
    selfReport: string | null;
  },
  currentContentVersion: string,
  currentRubricVersion: string | null
): SkillProbeEntry {
  return {
    timepoint: p.timepoint as ProbeTimepoint,
    formId: p.formId as ProbeForm,
    scheduledFor: p.scheduledFor,
    startedAt: p.startedAt,
    completedAt: p.completedAt,
    contentVersion: p.contentVersion,
    rubricVersion: p.rubricVersion,
    totals: p.totals,
    selfReport: p.selfReport,
    comparable: p.contentVersion === currentContentVersion && (p.rubricVersion ?? null) === (currentRubricVersion ?? null),
  };
}

export async function getSkillProbe(
  prisma: PrismaClient,
  userId: string,
  skillKey: SkillKey,
  timepoint: ProbeTimepoint,
  locale: Locale
): Promise<SkillProbeEntry | null> {
  const probe = await prisma.skillProbe.findUnique({
    where: { userId_skillKey_timepoint: { userId, skillKey, timepoint } },
  });
  if (!probe) return null;
  const packInfo = await loadPackInfo(prisma, userId, skillKey, locale);
  const profile = await ensureProfile(prisma, userId, locale, skillKey);
  return toEntry(probe, profile.contentVersion, packInfo.rubricVersion);
}

export async function listSkillProbes(
  prisma: PrismaClient,
  userId: string,
  skillKey: SkillKey,
  locale: Locale
): Promise<SkillProbeEntry[]> {
  const probes = await prisma.skillProbe.findMany({ where: { userId, skillKey }, orderBy: { createdAt: "asc" } });
  const packInfo = await loadPackInfo(prisma, userId, skillKey, locale);
  const profile = await ensureProfile(prisma, userId, locale, skillKey);
  return probes.map((p) => toEntry(p, profile.contentVersion, packInfo.rubricVersion));
}

export type DueSkillProbe = { skillKey: SkillKey; timepoint: ProbeTimepoint; scheduledFor: Date | null };

/**
 * Due surfacing for the tool home and the one allowed line on Today
 * (00-skills-engine.md §12): a post probe once every module has reached
 * mastered/tested-out, and a delayed probe once its `scheduledFor` has
 * passed. Never a nag before that — an eligible-but-not-yet-due delayed probe
 * stays invisible, same as a review that isn't due yet.
 */
export async function getDueSkillProbes(prisma: PrismaClient, userId: string): Promise<DueSkillProbe[]> {
  const skillKeys: SkillKey[] = ["evidence", "clarity", "decomposition", "verification"];
  const out: DueSkillProbe[] = [];
  const now = Date.now();

  for (const skillKey of skillKeys) {
    const [probes, moduleProgress] = await Promise.all([
      prisma.skillProbe.findMany({ where: { userId, skillKey } }),
      prisma.skillModuleProgress.findMany({ where: { userId, skillKey } }),
    ]);
    const byTimepoint = new Map(probes.map((p) => [p.timepoint, p]));

    const post = byTimepoint.get("post");
    if (!post?.completedAt) {
      const keys = MODULE_KEYS[skillKey];
      const allDone =
        moduleProgress.length > 0 &&
        keys.every((mk) => {
          const p = moduleProgress.find((mp) => mp.moduleKey === mk);
          return p?.state === "mastered" || p?.state === "tested_out";
        });
      if (allDone) out.push({ skillKey, timepoint: "post", scheduledFor: null });
    }

    const delayed = byTimepoint.get("delayed");
    if (delayed && !delayed.completedAt && delayed.scheduledFor && delayed.scheduledFor.getTime() <= now) {
      out.push({ skillKey, timepoint: "delayed", scheduledFor: delayed.scheduledFor });
    }
  }

  return out;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export type SkillExportResult = { json: string; markdown: string };

/**
 * The learner's full attempt/probe history: it's their data, and a clean
 * export is the shortest path from "I built a practice tool" to "I have
 * evidence about whether either skill sticks" (00-skills-engine.md §13).
 */
export async function exportSkillData(
  prisma: PrismaClient,
  userId: string,
  skillKey: SkillKey,
  locale: Locale
): Promise<SkillExportResult> {
  const profile = await ensureProfile(prisma, userId, locale, skillKey);
  const [attempts, probes] = await Promise.all([
    prisma.skillAttempt.findMany({ where: { userId, skillKey }, orderBy: { createdAt: "asc" } }),
    prisma.skillProbe.findMany({ where: { userId, skillKey }, orderBy: { createdAt: "asc" } }),
  ]);

  const data = {
    skillKey,
    exportedAt: new Date().toISOString(),
    profile: {
      contentVersion: profile.contentVersion,
      assessmentCompletedAt: profile.assessmentCompletedAt?.toISOString() ?? null,
      assessmentSkipped: profile.assessmentSkipped,
    },
    attempts: attempts.map((a) => ({
      id: a.id,
      moduleKey: a.moduleKey,
      itemId: a.itemId,
      formId: a.formId,
      mode: a.mode,
      probeId: a.probeId,
      scores: JSON.parse(a.scores || "{}"),
      contentVersion: a.contentVersion,
      rubricVersion: a.rubricVersion,
      judgeModelVersion: a.judgeModelVersion,
      scoredBy: a.scoredBy,
      createdAt: a.createdAt.toISOString(),
    })),
    probes: probes.map((p) => ({
      timepoint: p.timepoint,
      formId: p.formId,
      scheduledFor: p.scheduledFor?.toISOString() ?? null,
      startedAt: p.startedAt?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      totals: p.totals ? JSON.parse(p.totals) : null,
      selfReport: p.selfReport ? JSON.parse(p.selfReport) : null,
      contentVersion: p.contentVersion,
      rubricVersion: p.rubricVersion,
    })),
  };

  const json = JSON.stringify(data, null, 2);
  const markdown = renderMarkdownSummary(data);
  return { json, markdown };
}

function renderMarkdownSummary(data: {
  skillKey: string;
  exportedAt: string;
  attempts: unknown[];
  probes: { timepoint: string; formId: string; completedAt: string | null; totals: unknown }[];
}): string {
  const lines = [`# ${data.skillKey} export`, "", `Exported ${data.exportedAt}`, "", "## Probes", ""];
  if (data.probes.length === 0) {
    lines.push("No probe has been started yet.");
  }
  for (const p of data.probes) {
    const status = p.completedAt ? `completed ${p.completedAt}` : "not completed";
    const totals = p.totals ? ` — ${JSON.stringify(p.totals)}` : "";
    lines.push(`- **${p.timepoint}** (form ${p.formId}): ${status}${totals}`);
  }
  lines.push("", "## Attempts", "", `${data.attempts.length} total, across all modes and forms.`);
  return lines.join("\n");
}
