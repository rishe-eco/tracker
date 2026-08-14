/**
 * Calendar planning for skill modules.
 *
 * Turns a module sequence into ordinary scheduled Actions, so practice competes
 * for time in the same place as everything else the learner has committed to. A
 * review queue that lives only inside the tool competes with nothing and loses.
 *
 * This is consistent with D-3 rather than a departure from it: a scheduled
 * session is a *future commitment*, which is what Tracker's recurrence model is
 * for. It is not a streak, nothing breaks if a session is missed, and there is no
 * counter to defend.
 *
 * ── The rule that shapes the default ────────────────────────────────────────
 * Mastery requires at-criterion attempts on **two distinct calendar days**
 * (mastery.ts). So a plan with one session per module can never produce mastery
 * — it would look complete and quietly go nowhere. Two sessions per module is
 * therefore the default, not an upsell.
 *
 * Passes are also ordered module-major (every module once, then every module
 * again) which separates a module's two sittings by a full cycle and interleaves
 * the modules on the way — and interleaving beats blocking for durable transfer.
 */

import type { PrismaClient } from "@prisma/client";
import { getEvidencePack } from "../../content/skills";
import type { Locale } from "../../content/skills/types";
import { ensureProfile } from "./profile";

export type PlannedSession = {
  moduleKey: string;
  /** 1-based: which sitting of this module. */
  pass: number;
  /** "YYYY-MM-DD" */
  dateKey: string;
  /** "HH:mm" */
  timeOfDay: string;
  estimatedTimeMinutes: number;
};

export type PlanOptions = {
  startDateKey: string;
  /** 1–7. */
  sessionsPerWeek: number;
  timeOfDay: string;
  /** Defaults to 2. Below 2 and mastery is unreachable — see the header. */
  sessionsPerModule?: number;
  estimatedTimeMinutes?: number;
};

export type BuiltPlan = { sessions: PlannedSession[]; warnings: string[] };

/** Evidence Lab sittings run ~5 minutes; 10 is an honest slot for one. */
export const DEFAULT_SESSION_MINUTES = 10;
export const DEFAULT_SESSIONS_PER_MODULE = 2;
export const DEFAULT_SESSIONS_PER_WEEK = 3;
export const DEFAULT_TIME_OF_DAY = "09:00";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Spread N sessions across a 7-day week as evenly as whole days allow. */
export function weekdaySlots(sessionsPerWeek: number): number[] {
  const n = Math.min(Math.max(Math.round(sessionsPerWeek), 1), 7);
  if (n === 7) return [0, 1, 2, 3, 4, 5, 6];
  return Array.from({ length: n }, (_, i) => Math.round((i * 7) / n));
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

function isValidDateKey(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

function isValidTimeOfDay(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Pure: no clock, no database. The applier below turns this into rows. */
export function buildPlan(moduleKeys: string[], opts: PlanOptions): BuiltPlan {
  if (moduleKeys.length === 0) return { sessions: [], warnings: [] };
  if (!isValidDateKey(opts.startDateKey)) throw new Error("startDateKey must be YYYY-MM-DD.");
  if (!isValidTimeOfDay(opts.timeOfDay)) throw new Error("timeOfDay must be HH:mm.");

  const perModule = opts.sessionsPerModule ?? DEFAULT_SESSIONS_PER_MODULE;
  if (perModule < 1) throw new Error("sessionsPerModule must be at least 1.");

  const warnings: string[] = [];
  if (perModule < 2) {
    warnings.push(
      "With one session per module, mastery is unreachable: it requires at-criterion attempts on two distinct calendar days. The plan will still schedule the work."
    );
  }

  const slots = weekdaySlots(opts.sessionsPerWeek);
  const minutes = opts.estimatedTimeMinutes ?? DEFAULT_SESSION_MINUTES;

  // Module-major ordering: every module once, then every module again.
  const ordered: { moduleKey: string; pass: number }[] = [];
  for (let pass = 1; pass <= perModule; pass++) {
    for (const moduleKey of moduleKeys) ordered.push({ moduleKey, pass });
  }

  const sessions = ordered.map((entry, i) => {
    const week = Math.floor(i / slots.length);
    const dayOffset = week * 7 + slots[i % slots.length];
    return {
      moduleKey: entry.moduleKey,
      pass: entry.pass,
      dateKey: addDays(opts.startDateKey, dayOffset),
      timeOfDay: opts.timeOfDay,
      estimatedTimeMinutes: minutes,
    };
  });

  // Belt and braces on the rule the default exists to satisfy.
  for (const moduleKey of moduleKeys) {
    const days = new Set(sessions.filter((s) => s.moduleKey === moduleKey).map((s) => s.dateKey));
    if (perModule >= 2 && days.size < 2) {
      warnings.push(`Module "${moduleKey}" landed all its sessions on one day; mastery needs two.`);
    }
  }

  return { sessions, warnings };
}

function toDateTime(dateKey: string, timeOfDay: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = timeOfDay.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

const sourceIdFor = (skillKey: string, moduleKey: string) => `${skillKey}:${moduleKey}`;

/**
 * Deliberate practice is the textbook S quadrant — important, not urgent — and
 * labelling it P would have it shouting over things that actually are urgent.
 */
const PLAN_PRIORITY = "S" as const;

/**
 * Remove future, not-yet-done planned sessions for a skill. Past and completed
 * sessions are never touched: re-planning must not rewrite history, and a
 * learner who did the work should keep the record of it.
 */
export async function clearFuturePlan(
  prisma: PrismaClient,
  userId: string,
  skillKey: string,
  from: Date = new Date()
): Promise<number> {
  const result = await prisma.action.deleteMany({
    where: {
      userId,
      sourceType: "skill",
      sourceId: { startsWith: `${skillKey}:` },
      done: false,
      tbd: { gte: from },
    },
  });
  return result.count;
}

export type ApplyPlanResult = { created: number; removed: number; warnings: string[] };

export async function applyPlan(
  prisma: PrismaClient,
  userId: string,
  skillKey: "evidence",
  opts: PlanOptions,
  locale: Locale
): Promise<ApplyPlanResult> {
  const profile = await ensureProfile(prisma, userId, locale);
  const pack = getEvidencePack(profile.contentVersion, locale);

  // Titles come from the content pack, so a Persian learner gets Persian
  // calendar entries without a second translation path. Written once, at plan
  // time, in whatever language the request arrived in — an action already on the
  // calendar is a record, and records don't re-translate themselves.
  const titleByKey = new Map<string, string>(pack.modules.map((m) => [m.moduleKey, m.title]));
  const moduleKeys: string[] = pack.modules.map((m) => m.moduleKey);

  const { sessions, warnings } = buildPlan(moduleKeys, opts);

  // Re-planning replaces the future plan rather than adding a second one on top.
  const removed = await clearFuturePlan(prisma, userId, skillKey);

  await prisma.action.createMany({
    data: sessions.map((s) => ({
      userId,
      title: titleByKey.get(s.moduleKey) ?? s.moduleKey,
      tbd: toDateTime(s.dateKey, s.timeOfDay),
      startTimeOfDay: s.timeOfDay,
      estimatedTimeMinutes: s.estimatedTimeMinutes,
      priority: PLAN_PRIORITY,
      sourceType: "skill" as const,
      sourceId: sourceIdFor(skillKey, s.moduleKey),
      isGathered: false,
    })),
  });

  await prisma.skillProfile.update({
    where: { userId_skillKey: { userId, skillKey } },
    data: { calendarPlanningEnabled: true, planTimeOfDay: opts.timeOfDay },
  });

  return { created: sessions.length, removed, warnings };
}

export async function clearPlan(
  prisma: PrismaClient,
  userId: string,
  skillKey: "evidence"
): Promise<number> {
  await ensureProfile(prisma, userId);
  const removed = await clearFuturePlan(prisma, userId, skillKey);
  await prisma.skillProfile.update({
    where: { userId_skillKey: { userId, skillKey } },
    data: { calendarPlanningEnabled: false },
  });
  return removed;
}

/**
 * Put a due review on the calendar. Called when a module reaches mastery and the
 * learner has opted in — the spaced dates already exist internally, and this is
 * what makes them something they will actually see.
 *
 * Idempotent per module per day: mastery can be recomputed on every submission,
 * and that must not deposit a pile of duplicates.
 */
export async function scheduleReviewAction(
  prisma: PrismaClient,
  userId: string,
  skillKey: "evidence",
  moduleKey: string,
  dueAt: Date,
  locale: Locale
): Promise<boolean> {
  const profile = await prisma.skillProfile.findUnique({
    where: { userId_skillKey: { userId, skillKey } },
  });
  if (!profile?.calendarPlanningEnabled) return false;

  const dayStart = new Date(dueAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

  const existing = await prisma.action.findFirst({
    where: {
      userId,
      sourceType: "skill",
      sourceId: sourceIdFor(skillKey, moduleKey),
      done: false,
      tbd: { gte: dayStart, lt: dayEnd },
    },
  });
  if (existing) return false;

  const pack = getEvidencePack(profile.contentVersion, locale);
  const title = pack.modules.find((m) => m.moduleKey === moduleKey)?.title ?? moduleKey;
  const timeOfDay = profile.planTimeOfDay ?? DEFAULT_TIME_OF_DAY;
  const [hh, mm] = timeOfDay.split(":").map(Number);
  const tbd = new Date(dayStart);
  tbd.setHours(hh, mm, 0, 0);

  await prisma.action.create({
    data: {
      userId,
      title,
      tbd,
      startTimeOfDay: timeOfDay,
      estimatedTimeMinutes: DEFAULT_SESSION_MINUTES,
      priority: PLAN_PRIORITY,
      sourceType: "skill",
      sourceId: sourceIdFor(skillKey, moduleKey),
      isGathered: false,
    },
  });
  return true;
}

export type PlannedSessionRow = {
  actionId: string;
  moduleKey: string;
  title: string;
  tbd: Date;
  done: boolean;
};

export async function getPlan(
  prisma: PrismaClient,
  userId: string,
  skillKey: "evidence"
): Promise<PlannedSessionRow[]> {
  const actions = await prisma.action.findMany({
    where: { userId, sourceType: "skill", sourceId: { startsWith: `${skillKey}:` } },
    orderBy: { tbd: "asc" },
  });
  return actions.map((a) => ({
    actionId: a.id,
    moduleKey: (a.sourceId ?? "").split(":")[1] ?? "",
    title: a.title,
    tbd: a.tbd as Date,
    done: a.done,
  }));
}
