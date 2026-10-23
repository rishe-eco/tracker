/**
 * Reflect: the entry.
 *
 * Build plan §5 B2, §6.1, §6.2. The rules live here rather than in the UI:
 *
 * 1. One open entry per person, found at any age (D-8: a person may come back
 *    three weeks later, so unlike Feelings & Needs and Noticing there is no
 *    `startOfToday`).
 * 2. Every step commits as it goes. Omitted arguments are untouched; an empty
 *    string is stored as null; no text is trimmed.
 * 3. Bounds count `.length`, the same UTF-16 count as the browser's `maxLength`.
 * 4. A write to a closed entry is refused (D-15).
 * 5. Ownership by `ensureOwned` on the entry, which carries `userId`.
 *
 * No logging here and no error message carries a field's text (D-9).
 * Times are written from `new Date()` explicitly, so a faked clock reaches them.
 */

import type { PrismaClient } from "@prisma/client";
import { DIALS } from "../../content/reflect";
import { ensureOwned } from "../../graphql/auth";
import { withUserLock } from "../userLock";
import { fauxOfferFor, interpretationOfferFor } from "./catches";
import { REFUSALS } from "./refusals";

const WITH_CHILDREN = {
  moments: { orderBy: { position: "asc" as const } },
  readings: { orderBy: { position: "asc" as const } },
};

const STEPS = ["precheck", "story", "feelings", "reality", "close"] as const;
type Step = (typeof STEPS)[number];

const lock = (userId: string) => "rfl-entry:" + userId;

/** Empty string becomes null; undefined and null leave the column untouched. */
function norm(v: string | null | undefined): string | null | undefined {
  if (v == null) return undefined;
  return v === "" ? null : v;
}

function bound(v: string | null | undefined, max: number) {
  if (v != null && v.length > max) throw new Error(REFUSALS.tooLong);
}

async function loadOwned(prisma: PrismaClient, userId: string, entryId: string) {
  const entry = await prisma.reflectEntry.findUnique({ where: { id: entryId } });
  ensureOwned(entry, { user: { id: userId } });
  return entry;
}

async function loadOpen(prisma: PrismaClient, userId: string, entryId: string) {
  const entry = await loadOwned(prisma, userId, entryId);
  if (entry.closedAt) throw new Error(REFUSALS.closed);
  return entry;
}

function withChildren(prisma: PrismaClient, id: string) {
  return prisma.reflectEntry.findUniqueOrThrow({ where: { id }, include: WITH_CHILDREN });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** The open entry, any age. */
export function getOpenEntry(prisma: PrismaClient, userId: string) {
  return prisma.reflectEntry.findFirst({
    where: { userId, closedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: WITH_CHILDREN,
  });
}

const TEXT_COLUMNS = {
  moments: { select: { whenText: true, feeling: true, need: true }, orderBy: { position: "asc" as const } },
  readings: { select: { reading: true, camera: true }, orderBy: { position: "asc" as const } },
};

const written = (v: string | null | undefined): v is string => v != null && v !== "";

/**
 * Does the entry hold any written text (AC-37, AC-53; spec §2.2 #19)? A scene,
 * story or close, any moment's when, feeling or need, any reading's reading or
 * camera. Whitespace counts as written: no text is trimmed anywhere (rule 2),
 * and the calm close already offers Delete for it. The same fields as the
 * client's `holdsWrittenText`, and as `LISTABLE` below, which is this rule as
 * one `where`.
 */
function holdsText(e: {
  scene: string | null;
  story: string | null;
  close: string | null;
  moments: { whenText: string | null; feeling: string | null; need: string | null }[];
  readings: { reading: string | null; camera: string | null }[];
}): boolean {
  return (
    written(e.scene) ||
    written(e.story) ||
    written(e.close) ||
    e.moments.some((m) => written(m.whenText) || written(m.feeling) || written(m.need)) ||
    e.readings.some((r) => written(r.reading) || written(r.camera))
  );
}

/**
 * Listable entries are closed and hold any written text (AC-37 as amended, PD-12).
 * An empty string is stored as null (rule 2), so "not null" is "written".
 */
const LISTABLE = {
  closedAt: { not: null },
  OR: [
    { scene: { not: null } },
    { story: { not: null } },
    { close: { not: null } },
    { moments: { some: { OR: [{ whenText: { not: null } }, { feeling: { not: null } }, { need: { not: null } }] } } },
    { readings: { some: { OR: [{ reading: { not: null } }, { camera: { not: null } }] } } },
  ],
};

export async function getHome(prisma: PrismaClient, userId: string) {
  const open = await prisma.reflectEntry.findFirst({
    where: { userId, closedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true, scene: true, story: true, close: true, ...TEXT_COLUMNS },
  });
  const past = await prisma.reflectEntry.findFirst({ where: { userId, ...LISTABLE }, select: { id: true } });
  return {
    openEntry: open ? { id: open.id, createdAt: open.createdAt, hasWriting: holdsText(open) } : null,
    hasPast: past != null,
  };
}

function storyStart(story: string): string {
  let s = story.slice(0, DIALS.storyStartChars);
  // Never end on half of a surrogate pair.
  const last = s.charCodeAt(s.length - 1);
  if (story.length > s.length && last >= 0xd800 && last <= 0xdbff) s = s.slice(0, -1);
  return s;
}

/**
 * The start of an entry's first writing, in step order (spec §4.10, decision 2
 * of B6's card): scene, story, the first moment's when, the first reading, the
 * close; then, for an entry the five leave empty, the first feeling, the first
 * need, the first camera line. A listable entry always has one.
 */
function firstWriting(e: {
  scene: string | null;
  story: string | null;
  close: string | null;
  moments: { whenText: string | null; feeling: string | null; need: string | null }[];
  readings: { reading: string | null; camera: string | null }[];
}): string {
  const first = [
    e.scene,
    e.story,
    e.moments.find((m) => written(m.whenText))?.whenText,
    e.readings.find((r) => written(r.reading))?.reading,
    e.close,
    e.moments.find((m) => written(m.feeling))?.feeling,
    e.moments.find((m) => written(m.need))?.need,
    e.readings.find((r) => written(r.camera))?.camera,
  ].find(written);
  return storyStart(first ?? "");
}

export async function listPast(prisma: PrismaClient, userId: string, before?: string | null) {
  let cursor: object = {};
  if (before != null) {
    const c = await prisma.reflectEntry.findUnique({
      where: { id: before },
      select: { id: true, userId: true, createdAt: true },
    });
    ensureOwned(c, { user: { id: userId } });
    cursor = {
      OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
    };
  }
  const rows = await prisma.reflectEntry.findMany({
    where: { userId, AND: [LISTABLE, cursor] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DIALS.pastPageSize + 1,
    select: { id: true, createdAt: true, scene: true, story: true, close: true, ...TEXT_COLUMNS },
  });
  return {
    rows: rows.slice(0, DIALS.pastPageSize).map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      firstWriting: firstWriting(r),
    })),
    hasOlder: rows.length > DIALS.pastPageSize,
  };
}

/**
 * One past entry: closed and holding written text only, otherwise the same
 * `Not found` as a stranger's. Returned without `step` (AC-48): the type has
 * no such field, and the object doesn't carry it either.
 */
export async function getPast(prisma: PrismaClient, userId: string, id: string) {
  const entry = await prisma.reflectEntry.findUnique({ where: { id }, include: WITH_CHILDREN });
  ensureOwned(entry, { user: { id: userId } });
  if (!entry.closedAt || !holdsText(entry)) throw new Error(REFUSALS.notFound);
  const { step: _step, ...past } = entry;
  return past;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * The open entry, or a new one. `replacing` closes only that id (D-14): a double
 * tap on "Start a new one" must not close the entry it just created.
 */
export function startEntry(prisma: PrismaClient, userId: string, replacing?: string | null) {
  return withUserLock(lock(userId), async () => {
    const open = await prisma.reflectEntry.findFirst({
      where: { userId, closedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (open && !(replacing != null && replacing === open.id)) {
      return withChildren(prisma, open.id);
    }
    const now = new Date();
    if (open) {
      await prisma.reflectEntry.update({
        where: { id: open.id },
        data: { outcome: "stopped", closedAt: now },
      });
    }
    const created = await prisma.reflectEntry.create({ data: { userId, createdAt: now } });
    return withChildren(prisma, created.id);
  });
}

export type SaveEntryPatch = {
  scene?: string | null;
  story?: string | null;
  close?: string | null;
  precheckWhen?: string | null;
  precheckBefore?: string | null;
};

export function save(prisma: PrismaClient, userId: string, entryId: string, patch: SaveEntryPatch) {
  return withUserLock(lock(userId), async () => {
    const entry = await loadOpen(prisma, userId, entryId);
    bound(patch.scene, DIALS.limits.scene);
    bound(patch.story, DIALS.limits.story);
    bound(patch.close, DIALS.limits.close);
    const touchesPrecheck = patch.precheckWhen != null || patch.precheckBefore != null;
    if (touchesPrecheck && entry.step !== "precheck") throw new Error(REFUSALS.step);
    await prisma.reflectEntry.update({
      where: { id: entryId },
      data: {
        scene: norm(patch.scene),
        story: norm(patch.story),
        close: norm(patch.close),
        precheckWhen: patch.precheckWhen ?? undefined,
        precheckBefore: patch.precheckBefore ?? undefined,
      },
    });
    return withChildren(prisma, entryId);
  });
}

export type MomentPatch = {
  whenText?: string | null;
  feeling?: string | null;
  feelingSource?: string | null;
  need?: string | null;
  needSource?: string | null;
  met?: string | null;
};

/** Creates at the next free position, or updates one already there. Never skips a position. */
export function saveMoment(
  prisma: PrismaClient,
  userId: string,
  entryId: string,
  position: number,
  patch: MomentPatch
) {
  return withUserLock(lock(userId), async () => {
    const entry = await loadOpen(prisma, userId, entryId);
    bound(patch.whenText, DIALS.limits.whenText);
    bound(patch.feeling, DIALS.limits.ownWord);
    bound(patch.need, DIALS.limits.ownWord);
    const count = await prisma.reflectMoment.count({ where: { entryId } });
    if (!Number.isInteger(position) || position < 0 || position >= DIALS.momentsCap || position > count) {
      throw new Error(REFUSALS.atMostThree);
    }
    const stored = await prisma.reflectMoment.findUnique({
      where: { entryId_position: { entryId, position } },
      select: { feeling: true },
    });
    const data = {
      whenText: norm(patch.whenText),
      feeling: norm(patch.feeling),
      feelingSource: patch.feelingSource ?? undefined,
      need: norm(patch.need),
      needSource: patch.needSource ?? undefined,
      // B5: Met is the one clearable choice, so an explicit null clears it and an omitted met leaves it.
      met: patch.met,
    };
    const moment = await prisma.reflectMoment.upsert({
      where: { entryId_position: { entryId, position } },
      create: { entryId, position, ...data },
      update: data,
    });
    // The faux-feeling offer: only for a feeling that differs from the stored one (B3).
    const feeling = norm(patch.feeling);
    const fauxOffer =
      typeof feeling === "string" && feeling !== stored?.feeling
        ? await fauxOfferFor(prisma, userId, entry, position, feeling)
        : null;
    return { moment, fauxOffer };
  });
}

export function saveReading(
  prisma: PrismaClient,
  userId: string,
  entryId: string,
  position: number,
  patch: { reading?: string | null; camera?: string | null }
) {
  return withUserLock(lock(userId), async () => {
    await loadOpen(prisma, userId, entryId);
    bound(patch.reading, DIALS.limits.reading);
    bound(patch.camera, DIALS.limits.camera);
    const count = await prisma.reflectReading.count({ where: { entryId } });
    if (!Number.isInteger(position) || position < 0 || position >= DIALS.readingsCap || position > count) {
      throw new Error(REFUSALS.atMostThree);
    }
    const data = { reading: norm(patch.reading), camera: norm(patch.camera) };
    return prisma.reflectReading.upsert({
      where: { entryId_position: { entryId, position } },
      create: { entryId, position, ...data },
      update: data,
    });
  });
}

/**
 * From the pre-check to the story only; otherwise one step forward, or back to
 * any step from the story on; never to the pre-check. A move to the current
 * step returns the entry unchanged (a double tap on Next must not fail).
 */
export function move(prisma: PrismaClient, userId: string, entryId: string, to: string) {
  return withUserLock(lock(userId), async () => {
    const entry = await loadOpen(prisma, userId, entryId);
    const from = STEPS.indexOf(entry.step as Step);
    const target = STEPS.indexOf(to as Step);
    if (target === from) {
      return { entry: await withChildren(prisma, entryId), interpretationOffer: null };
    }
    const forward = target === from + 1;
    const back = target >= 1 && target < from;
    if (target < 0 || !(forward || back)) throw new Error(REFUSALS.step);
    await prisma.reflectEntry.update({ where: { id: entryId }, data: { step: to } });
    // The interpretation offer: only one step forward into the reality check (B3).
    const interpretationOffer =
      to === "reality" && forward ? await interpretationOfferFor(prisma, userId, entry) : null;
    return { entry: await withChildren(prisma, entryId), interpretationOffer };
  });
}

export function stop(prisma: PrismaClient, userId: string, entryId: string) {
  return withUserLock(lock(userId), async () => {
    await loadOpen(prisma, userId, entryId);
    await prisma.reflectEntry.update({
      where: { id: entryId },
      data: { outcome: "stopped", closedAt: new Date() },
    });
    return withChildren(prisma, entryId);
  });
}

export function finish(prisma: PrismaClient, userId: string, entryId: string) {
  return withUserLock(lock(userId), async () => {
    const entry = await loadOpen(prisma, userId, entryId);
    if (entry.step !== "close") throw new Error(REFUSALS.step);
    await prisma.reflectEntry.update({
      where: { id: entryId },
      data: { outcome: "finished", closedAt: new Date() },
    });
    return withChildren(prisma, entryId);
  });
}

/** Once, and for a finished entry only. The answer is never returned. */
export function answer(prisma: PrismaClient, userId: string, entryId: string, value: string) {
  return withUserLock(lock(userId), async () => {
    const entry = await loadOwned(prisma, userId, entryId);
    if (entry.outcome !== "finished" || entry.afterAnswer != null) throw new Error(REFUSALS.answer);
    await prisma.reflectEntry.update({ where: { id: entryId }, data: { afterAnswer: value } });
    return true;
  });
}

/** Any owned entry, open or closed. A hard delete; the children cascade. */
export function remove(prisma: PrismaClient, userId: string, entryId: string) {
  return withUserLock(lock(userId), async () => {
    await loadOwned(prisma, userId, entryId);
    await prisma.reflectEntry.delete({ where: { id: entryId } });
    return true;
  });
}
