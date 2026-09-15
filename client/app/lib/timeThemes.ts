/**
 * Time Themes: soft surfacing overlap check — client mirror of
 * `api/src/services/timeThemes.ts` `actionTagIdsMatchTheme` (time-themes.md
 * §2, build-plan.md Phase 5). Presentation only: it changes order/marking,
 * never which actions are selectable.
 */
export function actionTagIdsMatchTheme(actionTagIds: string[], themeTagIds: string[]): boolean {
  return actionTagIds.some((id) => themeTagIds.includes(id));
}

export interface TimeThemeLike {
  id: string;
  title: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  tags: { id: string; name: string; color: string }[];
}

/** True if any of the given themes' tags overlap the action's tags — "does today's shape suggest this action anywhere?" */
export function matchesAnyTheme(actionTagIds: string[], themes: TimeThemeLike[]): boolean {
  return themes.some((theme) => actionTagIdsMatchTheme(actionTagIds, theme.tags.map((t) => t.id)));
}

function timeToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** The themes (if any) whose startTimeOfDay–endTimeOfDay span covers this time-of-day. */
export function themesCoveringTime(themes: TimeThemeLike[], startTimeOfDay: string | null | undefined): TimeThemeLike[] {
  if (!startTimeOfDay || !/^\d{2}:\d{2}/.test(startTimeOfDay)) return [];
  const t = timeToMinutes(startTimeOfDay.slice(0, 5));
  return themes.filter((theme) => t >= timeToMinutes(theme.startTimeOfDay) && t < timeToMinutes(theme.endTimeOfDay));
}
