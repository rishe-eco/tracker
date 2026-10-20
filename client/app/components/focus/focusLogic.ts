/**
 * Focus Periods — the pure rules behind the Focus page.
 *
 * Everything a person *sees* about a project's progress or done-ness comes
 * from Tracker's existing project rule (`getProjectStatus`), never from a
 * second copy of it (spec 02-spec.md decision 5). The one server-side mirror
 * lives in `api/src/services/focusPeriods.ts` and is used only to refuse
 * adding a finished project.
 *
 * Every date here is a Gregorian `YYYY-MM-DD` key — what the API sends and
 * what `toLocalDateString` produces. Rendering goes through `useAppDate`.
 */
import { getProjectStatus } from "~/components/projects/ProjectPreview";
import { parseDateOnly } from "~/utils/dateUtils";

export type FocusAction = {
  id: string;
  title: string;
  done: boolean;
  tbd?: string | null;
  createdAt?: string | null;
  actionFate?: string | null;
  estimatedTimeMinutes?: number | null;
};

export type FocusProject = {
  id: string;
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  actions: FocusAction[];
  goal?: { id: string; title: string } | null;
  milestone?: { id: string; title: string; goal?: { id: string; title: string } | null } | null;
};

export type FocusPeriod = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  lookbackAnswer?: string | null;
  lookbackSeenAt?: string | null;
  projects: FocusProject[];
};

export type FocusOverview = {
  lookback: FocusPeriod | null;
  active: FocusPeriod | null;
  upcoming: FocusPeriod | null;
};

export type FocusPeriodRange = { id: string; title: string; startDate: string; endDate: string };

export const NEXT_ACTIONS_SHOWN = 3;

/** Whole days from `fromKey` to `toKey` (negative when `toKey` is earlier). */
export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Days left in a period, counting today: 1 on the last day. */
export function daysLeft(endKey: string, todayKey: string): number {
  return daysBetween(todayKey, endKey) + 1;
}

/** A wire date (ISO or YYYY-MM-DD) reduced to its YYYY-MM-DD key. */
export function toKey(value: string): string {
  return value.slice(0, 10);
}

export type FocusPageState = "lookback" | "active" | "upcoming" | "empty";

/** Which screen the Focus tab opens on (spec §4.1). The look-back comes first. */
export function deriveState(overview: FocusOverview | null): FocusPageState {
  if (!overview) return "empty";
  if (overview.lookback) return "lookback";
  if (overview.active) return "active";
  if (overview.upcoming) return "upcoming";
  return "empty";
}

/** True when the project counts as done by Tracker's project rule. */
export function isProjectDone(project: Pick<FocusProject, "id" | "title" | "actions">): boolean {
  return (
    getProjectStatus({
      id: project.id,
      title: project.title,
      actions: project.actions.map((a) => ({
        id: a.id,
        title: a.title,
        done: a.done,
        tbd: a.tbd ? parseDateOnly(a.tbd) : undefined,
      })),
    }) === "Done"
  );
}

export type ProjectProgress = { done: number; total: number; isDone: boolean };

/** Actions done out of all the project's actions — the same count ProjectPreview draws. */
export function projectProgress(project: FocusProject): ProjectProgress {
  const total = project.actions.length;
  const done = project.actions.filter((a) => a.done).length;
  return { done, total, isDone: isProjectDone(project) };
}

/**
 * Undone, un-disposed actions, soonest first (build plan PD-6): those with a
 * day by day ascending (overdue included), then those without, oldest first.
 * An action with any fate is excluded — `postponeAction` clears the fate when
 * it moves the day, so no live action carries one.
 */
export function openActions(actions: FocusAction[]): FocusAction[] {
  const open = actions.filter((a) => !a.done && !a.actionFate);
  const scheduled = open
    .filter((a) => a.tbd)
    .sort((a, b) => toKey(a.tbd!).localeCompare(toKey(b.tbd!)));
  const unscheduled = open
    .filter((a) => !a.tbd)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  return [...scheduled, ...unscheduled];
}

/** The goal and milestone a project sits under. A milestone project reaches its goal through the milestone. */
export function projectContext(project: FocusProject): { goal: string | null; milestone: string | null } {
  if (project.milestone) {
    return { goal: project.milestone.goal?.title ?? null, milestone: project.milestone.title };
  }
  return { goal: project.goal?.title ?? null, milestone: null };
}

/** True when the project has an undone action scheduled inside [startKey, endKey]. */
export function isScheduledInRange(project: FocusProject, startKey: string, endKey: string): boolean {
  return openActions(project.actions).some((a) => {
    if (!a.tbd) return false;
    const k = toKey(a.tbd);
    return k >= startKey && k <= endKey;
  });
}

export type PickerGroups = { scheduled: FocusProject[]; other: FocusProject[] };

/**
 * The project picker (spec §4.4, wireframes W7): projects that aren't done,
 * split by whether they already have work scheduled in the chosen dates and
 * filtered by title. Projects already in the period (`keepIds`) stay listed
 * even once finished, so they can be unticked.
 */
export function groupForPicker(
  projects: FocusProject[],
  startKey: string,
  endKey: string,
  search: string,
  keepIds: Set<string> = new Set()
): PickerGroups {
  const q = search.trim().toLocaleLowerCase();
  const eligible = projects.filter(
    (p) => (keepIds.has(p.id) || !isProjectDone(p)) && (!q || p.title.toLocaleLowerCase().includes(q))
  );
  const validRange = Boolean(startKey && endKey && startKey <= endKey);
  const scheduled: FocusProject[] = [];
  const other: FocusProject[] = [];
  for (const p of eligible) {
    if (validRange && isScheduledInRange(p, startKey, endKey)) scheduled.push(p);
    else other.push(p);
  }
  return { scheduled, other };
}

/** The other period whose days the range [startKey, endKey] shares, if any. */
export function findOverlap(
  ranges: FocusPeriodRange[],
  startKey: string,
  endKey: string,
  exceptId?: string
): FocusPeriodRange | null {
  return (
    ranges.find(
      (r) => r.id !== exceptId && toKey(r.startDate) <= endKey && toKey(r.endDate) >= startKey
    ) ?? null
  );
}
