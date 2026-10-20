import type { PrismaClient } from "@prisma/client";

/**
 * Focus Periods: the rules (spec 02-spec.md §1; build plan 07-build-plan.md §5 B1).
 *
 * A Focus Period is a lens, not a container: a one-off, non-overlapping stretch
 * of days that points at a few projects. Dates are date keys ("YYYY-MM-DD",
 * Gregorian) on the wire and `DateTime` at UTC midnight in the database.
 * Everything here compares by date key or by those UTC-midnight values, never by
 * a timestamp carrying a time of day, and never asks the server for "today":
 * the client sends its own (PD-2).
 */

export const MAX_PROJECTS_PER_PERIOD = 30;
export const MAX_TITLE_LENGTH = 120;
export const LOOKBACK_ANSWERS = ["oriented", "behind"] as const;

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function dateKeyToDate(dateKey: string): Date {
  return new Date(dateKey + "T00:00:00.000Z");
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A real calendar day: the regex, then a round-trip so "2026-02-30" is refused. */
export function isValidDateKey(key: unknown): key is string {
  if (typeof key !== "string" || !DATE_KEY_REGEX.test(key)) return false;
  const d = new Date(key + "T00:00:00.000Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key;
}

export function assertDateKey(key: unknown): asserts key is string {
  if (!isValidDateKey(key)) throw new Error(`Invalid date: ${String(key)}.`);
}

/** Both keys real days, and end on or after start. Date keys sort as strings. */
export function validateRange(start: string, end: string): void {
  assertDateKey(start);
  assertDateKey(end);
  if (end < start) throw new Error("End date must be on or after the start date.");
}

/** Inclusive ranges share at least one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

export function validateTitle(title: unknown): string {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) throw new Error("Title is required.");
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new Error(`Title can be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  return trimmed;
}

/**
 * A project is done when it has at least one action and all of them are done.
 * Mirrors the "Done" branch of `getProjectStatus` in
 * client/app/components/projects/ProjectPreview.tsx (lines 57-64). The client
 * computes it for everything a person sees; the server copies it once, to refuse
 * a finished project being newly added to a period (PD-4). Keep the two in step.
 */
export function isProjectDone(actions: { done: boolean }[]): boolean {
  return actions.length > 0 && actions.every((a) => a.done);
}

/** Rejects when another of the user's periods shares a day with [start, end]. */
export async function assertNoOverlap(
  prisma: PrismaClient,
  userId: string,
  start: string,
  end: string,
  exceptId?: string
): Promise<void> {
  const clash = await prisma.focusPeriod.findFirst({
    where: {
      userId,
      startDate: { lte: dateKeyToDate(end) },
      endDate: { gte: dateKeyToDate(start) },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new Error("These dates overlap another focus period.");
}

/**
 * Makes the period's project list equal `projectIds`. Projects that stay keep
 * their `addedAt` (it is the order the card list shows); only the ids being
 * *added* are checked for ownership and for not being done, so a project that
 * finishes after joining doesn't make the Edit sheet fail (D-4).
 */
export async function setProjects(
  tx: Pick<PrismaClient, "focusPeriodProject" | "project">,
  userId: string,
  periodId: string,
  projectIds: string[]
): Promise<void> {
  const ids = [...new Set(projectIds)];
  if (ids.length > MAX_PROJECTS_PER_PERIOD) {
    throw new Error(`A focus period can hold at most ${MAX_PROJECTS_PER_PERIOD} projects.`);
  }

  const current = await tx.focusPeriodProject.findMany({
    where: { focusPeriodId: periodId },
    select: { projectId: true },
  });
  const currentIds = new Set(current.map((c) => c.projectId));
  const toAdd = ids.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !ids.includes(id));

  if (toAdd.length > 0) {
    const projects = await tx.project.findMany({
      where: { id: { in: toAdd } },
      select: { id: true, userId: true, actions: { select: { done: true } } },
    });
    if (projects.length !== toAdd.length || projects.some((p) => p.userId !== userId)) {
      throw new Error("Not found");
    }
    if (projects.some((p) => isProjectDone(p.actions))) {
      throw new Error("A finished project can't be added to a focus period.");
    }
  }

  if (toRemove.length > 0) {
    await tx.focusPeriodProject.deleteMany({
      where: { focusPeriodId: periodId, projectId: { in: toRemove } },
    });
  }
  // One row at a time, a millisecond apart, so `addedAt` keeps the order the
  // caller listed them in (a single createMany would stamp them all alike).
  const base = Date.now();
  for (let i = 0; i < toAdd.length; i++) {
    await tx.focusPeriodProject.create({
      data: { focusPeriodId: periodId, projectId: toAdd[i], addedAt: new Date(base + i) },
    });
  }
}

export interface FocusPeriodInput {
  title: string;
  startDate: string;
  endDate: string;
  projectIds: string[];
}

/** Everything that can be checked without touching a project, in the order the user would fix it. */
function validateInput(input: FocusPeriodInput) {
  const title = validateTitle(input.title);
  validateRange(input.startDate, input.endDate);
  const projectIds = input.projectIds ?? [];
  if (new Set(projectIds).size > MAX_PROJECTS_PER_PERIOD) {
    throw new Error(`A focus period can hold at most ${MAX_PROJECTS_PER_PERIOD} projects.`);
  }
  return { title, projectIds };
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

export async function createFocusPeriod(prisma: PrismaClient, userId: string, input: FocusPeriodInput) {
  const { title, projectIds } = validateInput(input);
  await assertNoOverlap(prisma, userId, input.startDate, input.endDate);
  return prisma.$transaction(async (tx) => {
    const period = await tx.focusPeriod.create({
      data: {
        title,
        startDate: dateKeyToDate(input.startDate),
        endDate: dateKeyToDate(input.endDate),
        userId,
      },
    });
    await setProjects(tx, userId, period.id, projectIds);
    return period;
  }, TX_OPTIONS);
}

/** The caller has already run `ensureOwned` on `periodId`. */
export async function updateFocusPeriod(
  prisma: PrismaClient,
  userId: string,
  periodId: string,
  input: FocusPeriodInput
) {
  const { title, projectIds } = validateInput(input);
  await assertNoOverlap(prisma, userId, input.startDate, input.endDate, periodId);
  return prisma.$transaction(async (tx) => {
    await setProjects(tx, userId, periodId, projectIds);
    return tx.focusPeriod.update({
      where: { id: periodId },
      data: {
        title,
        startDate: dateKeyToDate(input.startDate),
        endDate: dateKeyToDate(input.endDate),
      },
    });
  }, TX_OPTIONS);
}

/**
 * The look-back opens once the period has ended (`endDate < dateKey`). `answer`
 * is "oriented", "behind" or null; either way it marks the look-back as seen.
 * The caller has already run `ensureOwned` on `period`.
 */
export async function recordLookback(
  prisma: PrismaClient,
  period: { id: string; endDate: Date },
  answer: string | null | undefined,
  dateKey: string
) {
  assertDateKey(dateKey);
  const stored = answer ?? null;
  if (stored !== null && !(LOOKBACK_ANSWERS as readonly string[]).includes(stored)) {
    throw new Error('Answer must be "oriented" or "behind".');
  }
  if (toDateKey(period.endDate) >= dateKey) {
    throw new Error("The look-back opens after the period ends.");
  }
  return prisma.focusPeriod.update({
    where: { id: period.id },
    data: { lookbackAnswer: stored, lookbackSeenAt: new Date() },
  });
}

/**
 * What the Focus page needs for `dateKey` (the client's today): the period
 * containing it, the earliest one starting after it, and, if it hasn't been
 * answered yet, the most recent one that ended before it (PD-9: older unseen
 * look-backs never appear). Periods can't overlap, so "containing" is unique.
 */
export async function getOverview(prisma: PrismaClient, userId: string, dateKey: string) {
  assertDateKey(dateKey);
  const day = dateKeyToDate(dateKey);
  const [active, upcoming, lastEnded] = await Promise.all([
    prisma.focusPeriod.findFirst({
      where: { userId, startDate: { lte: day }, endDate: { gte: day } },
    }),
    prisma.focusPeriod.findFirst({
      where: { userId, startDate: { gt: day } },
      orderBy: { startDate: "asc" },
    }),
    prisma.focusPeriod.findFirst({
      where: { userId, endDate: { lt: day } },
      orderBy: { endDate: "desc" },
    }),
  ]);
  const lookback = lastEnded && lastEnded.lookbackSeenAt == null ? lastEnded : null;
  return { lookback, active, upcoming };
}

export async function listRanges(prisma: PrismaClient, userId: string) {
  return prisma.focusPeriod.findMany({
    where: { userId },
    orderBy: { startDate: "asc" },
    select: { id: true, title: true, startDate: true, endDate: true },
  });
}
