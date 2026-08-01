import type { PrismaClient, Prisma } from "@prisma/client";

const REPEAT_UNIT_DAY = "day";
const REPEAT_UNIT_WEEK = "week";
const REPEAT_UNIT_MONTH = "month";

/** Add N days to a dateKey "YYYY-MM-DD", return dateKey. Uses UTC noon to avoid DST. */
function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parse dateKey to Date at UTC midnight for storage (forDate). */
function dateKeyToDate(dateKey: string): Date {
  return new Date(dateKey + "T00:00:00.000Z");
}

/** Get day of week in ISO form (1 = Monday, 7 = Sunday). */
function getISODayOfWeek(d: Date): number {
  const day = d.getUTCDay(); // 0 = Sun, 6 = Sat
  return day === 0 ? 7 : day;
}

/** Return true if the interval has an occurrence on the given dateKey (YYYY-MM-DD). */
export function intervalOccursOnDate(
  interval: {
    customRepeatDates: string | null;
    customRepeatRule: string | null;
    repeatValue: number;
    repeatUnit: string | null;
    endTime: Date | null;
    createdAt: Date;
  },
  dateKey: string
): boolean {
  const date = new Date(dateKey + "T12:00:00.000Z");
  if (interval.endTime != null && date > interval.endTime) return false;

  // 1) Explicit list of dates
  if (interval.customRepeatDates != null && interval.customRepeatDates !== "") {
    try {
      const arr = JSON.parse(interval.customRepeatDates) as string[];
      if (Array.isArray(arr)) {
        const match = arr.some((s) => String(s).slice(0, 10) === dateKey);
        if (match) return true;
        // If customRepeatDates is set and date not in list, no occurrence (unless repeatUnit also applies - schema says "and/or")
        // We treat customRepeatDates as override: if present and date in list, yes; if present and date not in list, no.
        if (arr.length > 0) return false;
      }
    } catch {
      // fall through
    }
  }

  // 2) customRepeatRule: { unit: "week", daysOfWeek } | { unit: "month", daysOfMonth } | { unit: "year", months, daysOfMonth? }
  if (interval.customRepeatRule != null && interval.customRepeatRule !== "") {
    try {
      const rule = JSON.parse(interval.customRepeatRule) as {
        unit?: string;
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        months?: number[];
        timeOfDayBlocks?: string[];
      };
      if (rule.unit === "week" && Array.isArray(rule.daysOfWeek)) {
        const dow = getISODayOfWeek(date);
        if (rule.daysOfWeek.includes(dow)) {
          if (!interval.repeatUnit || interval.repeatValue <= 0) return true;
          return dateMatchesRepeatFromAnchor(
            interval.createdAt,
            date,
            interval.repeatValue,
            interval.repeatUnit
          );
        }
        return false;
      }
      if (rule.unit === "month" && Array.isArray(rule.daysOfMonth)) {
        const dom = date.getUTCDate();
        if (rule.daysOfMonth.includes(dom)) {
          if (!interval.repeatUnit || interval.repeatValue <= 0) return true;
          return dateMatchesRepeatFromAnchor(
            interval.createdAt,
            date,
            interval.repeatValue,
            interval.repeatUnit
          );
        }
        return false;
      }
      if (rule.unit === "year" && Array.isArray(rule.months)) {
        const month = date.getUTCMonth() + 1; // 1-12
        if (!rule.months.includes(month)) return false;
        if (Array.isArray(rule.daysOfMonth) && rule.daysOfMonth.length > 0) {
          const dom = date.getUTCDate();
          if (!rule.daysOfMonth.includes(dom)) return false;
        }
        if (!interval.repeatUnit || interval.repeatValue <= 0) return true;
        return dateMatchesRepeatFromAnchor(
          interval.createdAt,
          date,
          interval.repeatValue,
          interval.repeatUnit
        );
      }
    } catch {
      // fall through
    }
  }

  // 3) repeatValue + repeatUnit from anchor (createdAt)
  if (interval.repeatUnit != null && interval.repeatValue > 0) {
    return dateMatchesRepeatFromAnchor(
      interval.createdAt,
      date,
      interval.repeatValue,
      interval.repeatUnit
    );
  }

  // No rule: no occurrence
  return false;
}

/** Parse interval time blocks from customRepeatRule.timeOfDayBlocks; fallback to predictedToDoTime or 09:00. */
export function getIntervalOccurrencesForDate(interval: {
  customRepeatRule: string | null;
  predictedToDoTime: string | null;
}): { startTimeOfDay: string }[] {
  let blocks: string[] = [];
  if (interval.customRepeatRule != null && interval.customRepeatRule !== "") {
    try {
      const rule = JSON.parse(interval.customRepeatRule) as { timeOfDayBlocks?: string[] };
      if (Array.isArray(rule.timeOfDayBlocks)) {
        blocks = rule.timeOfDayBlocks
          .map((s) => String(s).trim().slice(0, 5))
          .filter((s) => /^\d{2}:\d{2}$/.test(s));
      }
    } catch {
      // ignore invalid customRepeatRule
    }
  }
  if (blocks.length === 0) {
    const fallback =
      interval.predictedToDoTime && /^\d{2}:\d{2}$/.test(interval.predictedToDoTime)
        ? interval.predictedToDoTime
        : "09:00";
    blocks = [fallback];
  }
  return blocks.map((startTimeOfDay) => ({ startTimeOfDay }));
}

/** True if date is exactly (anchor + N * repeatValue repeatUnit) for some N >= 0. */
export function dateMatchesRepeatFromAnchor(
  anchor: Date,
  date: Date,
  repeatValue: number,
  repeatUnit: string
): boolean {
  const anchorDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  const targetDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (targetDay < anchorDay) return false;

  const diffMs = targetDay.getTime() - anchorDay.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  switch (repeatUnit) {
    case REPEAT_UNIT_DAY:
      return diffDays >= 0 && diffDays % repeatValue === 0;
    case REPEAT_UNIT_WEEK: {
      const diffWeeks = diffDays / 7;
      return diffWeeks >= 0 && Number.isInteger(diffWeeks) && diffWeeks % repeatValue === 0;
    }
    case REPEAT_UNIT_MONTH: {
      const months =
        (targetDay.getUTCFullYear() - anchorDay.getUTCFullYear()) * 12 +
        (targetDay.getUTCMonth() - anchorDay.getUTCMonth());
      return months >= 0 && months % repeatValue === 0 && targetDay.getUTCDate() === anchorDay.getUTCDate();
    }
    default:
      return false;
  }
}

/** Parse routine timeOfDayBlocks JSON; return array of "HH:mm". */
function getRoutineTimeBlocks(timeOfDayBlocks: string | null): string[] {
  if (timeOfDayBlocks == null || timeOfDayBlocks === "") return [];
  try {
    const arr = JSON.parse(timeOfDayBlocks) as string[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s) => String(s).trim().slice(0, 5))
      .filter((s) => /^\d{2}:\d{2}$/.test(s));
  } catch {
    return [];
  }
}

/** Return true if routine has at least one occurrence on the given date (e.g. daily). */
function routineOccursOnDate(
  routine: { endTime: Date | null; timeOfDayBlocks: string | null },
  _dateKey: string
): boolean {
  const date = new Date(_dateKey + "T12:00:00.000Z");
  if (routine.endTime != null && date > routine.endTime) return false;
  const blocks = getRoutineTimeBlocks(routine.timeOfDayBlocks);
  return blocks.length > 0;
}

/** Get one occurrence per time block for the routine on the given date. */
function getRoutineOccurrencesForDate(
  routine: { timeOfDayBlocks: string | null; title: string; estimatedTimeMinutes: number | null }
): { startTimeOfDay: string }[] {
  const blocks = getRoutineTimeBlocks(routine.timeOfDayBlocks);
  if (blocks.length === 0) return [{ startTimeOfDay: "09:00" }]; // fallback
  return blocks.map((startTimeOfDay) => ({ startTimeOfDay }));
}

/** Get dateKeys to gather: today, today+1, today+2. */
export function getGatheringDateKeys(todayDateKey: string): string[] {
  return [
    todayDateKey,
    addDaysToDateKey(todayDateKey, 1),
    addDaysToDateKey(todayDateKey, 2),
  ];
}

export type ActionGatheringOptions = {
  /** Current local date "YYYY-MM-DD" (used to compute today, today+1, today+2). */
  todayDateKey: string;
  /**
   * If true, skip dates whose gathering already ran — unless an interval or
   * routine has changed since. See the note in `runActionGathering`.
   */
  skipCompletedDates?: boolean;
};

/**
 * Identity of a gathered action: one per source, per date, per time block.
 * Used to dedupe against rows already in the database and against duplicate
 * time blocks within a single run.
 */
function gatheredActionKey(action: {
  forDate: Date | null;
  sourceType: string | null;
  sourceId: string | null;
  startTimeOfDay: string | null;
}): string {
  return [
    action.forDate?.getTime() ?? "",
    action.sourceType,
    action.sourceId,
    action.startTimeOfDay,
  ].join("|");
}

/**
 * Run action gathering for today, today+1, today+2 (or subset).
 * Creates gathered Actions from intervals and routines, and sets actionGatheringCompletedAt on DayState.
 *
 * Query shape matters here — this runs every time Today is opened. Everything
 * the loop needs is read up front (four queries total, regardless of how many
 * intervals or routines exist), and each date's writes commit as one
 * transaction. Doing a findFirst-then-create round trip per action instead cost
 * ~100-400ms per action against SQLite, so a user with 10 intervals across two
 * time blocks waited ~23s.
 */
export async function runActionGathering(
  prisma: PrismaClient,
  userId: string,
  options: ActionGatheringOptions
): Promise<{ dateKeysProcessed: string[]; actionsCreated: number }> {
  const { todayDateKey, skipCompletedDates = true } = options;
  const dateKeys = getGatheringDateKeys(todayDateKey);
  let actionsCreated = 0;
  const dateKeysProcessed: string[] = [];

  const intervals = await prisma.interval.findMany({
    where: { userId, status: "active" },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  const routines = await prisma.routine.findMany({
    where: { userId, status: "active" },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  // Marking a date "gathered" must not close it to templates created later.
  // Opening Today gathers all three dates up front, so an interval added
  // afterwards used to be locked out of the whole window and only surfaced
  // once the window rolled past it — two days late. Re-open a date when a
  // template changed after that date was marked. Creation is deduped on
  // (forDate, sourceType, sourceId, startTimeOfDay), so re-running is safe.
  const newestTemplateChange = [...intervals, ...routines].reduce<Date | null>(
    (newest, template) =>
      newest == null || template.updatedAt > newest ? template.updatedAt : newest,
    null
  );

  // Both prefetched for the whole window rather than per date.
  const forDates = dateKeys.map(dateKeyToDate);

  const dayStates = await prisma.dayState.findMany({
    where: { userId, dateKey: { in: dateKeys } },
    select: { dateKey: true, actionGatheringCompletedAt: true },
  });
  const gatheredAtByDateKey = new Map(
    dayStates.map((d) => [d.dateKey, d.actionGatheringCompletedAt])
  );

  const existingActions = await prisma.action.findMany({
    where: { userId, forDate: { in: forDates }, isGathered: true },
    select: { forDate: true, sourceType: true, sourceId: true, startTimeOfDay: true },
  });
  // Grows as we go, so duplicate time blocks within one run dedupe too.
  const seen = new Set(existingActions.map(gatheredActionKey));

  for (const dateKey of dateKeys) {
    if (skipCompletedDates) {
      const gatheredAt = gatheredAtByDateKey.get(dateKey);
      if (
        gatheredAt != null &&
        (newestTemplateChange == null || gatheredAt >= newestTemplateChange)
      ) {
        continue;
      }
    }

    const forDate = dateKeyToDate(dateKey);
    const toCreate: Prisma.ActionUncheckedCreateInput[] = [];

    const collect = (
      template: { id: string; title: string; estimatedTimeMinutes: number | null },
      sourceType: "interval" | "routine",
      occurrences: { startTimeOfDay: string }[]
    ) => {
      for (const { startTimeOfDay } of occurrences) {
        const key = gatheredActionKey({
          forDate,
          sourceType,
          sourceId: template.id,
          startTimeOfDay,
        });
        if (seen.has(key)) continue;
        seen.add(key);

        toCreate.push({
          userId,
          title: template.title,
          estimatedTimeMinutes: template.estimatedTimeMinutes ?? undefined,
          startTimeOfDay,
          forDate,
          sourceType,
          sourceId: template.id,
          isGathered: true,
          priority: "P",
        });
      }
    };

    // ---- Intervals: one action per interval per date per time block (if occurs)
    for (const interval of intervals) {
      if (!intervalOccursOnDate(interval, dateKey)) continue;
      collect(interval, "interval", getIntervalOccurrencesForDate(interval));
    }

    // ---- Routines: one action per routine per date per time block
    for (const routine of routines) {
      if (!routineOccursOnDate(routine, dateKey)) continue;
      collect(routine, "routine", getRoutineOccurrencesForDate(routine));
    }

    // One transaction per date: the actions and the completion marker land
    // together, so a failure can't leave a date marked gathered but empty.
    const completedAt = new Date();
    await prisma.$transaction([
      ...toCreate.map((data) => prisma.action.create({ data })),
      prisma.dayState.upsert({
        where: { userId_dateKey: { userId, dateKey } },
        create: { userId, dateKey, actionGatheringCompletedAt: completedAt },
        update: { actionGatheringCompletedAt: completedAt },
      }),
    ]);

    actionsCreated += toCreate.length;
    dateKeysProcessed.push(dateKey);
  }

  return { dateKeysProcessed, actionsCreated };
}
