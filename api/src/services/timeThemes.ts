/**
 * Time Themes: soft surfacing (time-themes.md §2).
 *
 * One pure, shared function so the same overlap rule drives both the Pre-day
 * picker's ranking and the timeline's affinity marker. It is presentation
 * only — it changes order/rendering, never membership: a Time Theme never
 * blocks, gates, or filters anything (build-plan.md §0, constraint #1).
 *
 * Mirrored client-side for the timeline/picker (see Phase 6) rather than
 * shared as a package — the two apps don't currently share runtime code, and
 * this function is a one-line overlap check, cheap to keep in sync.
 */
export function actionTagIdsMatchTheme(actionTagIds: string[], themeTagIds: string[]): boolean {
  return actionTagIds.some((id) => themeTagIds.includes(id));
}
