/** Paths where bottom nav is visible (top-level app tabs only). List pages under Activities use internal layout + back to Activities. */
const BOTTOM_NAV_PATHS = new Set([
  "/",
  "/today",
  "/calendar",
  "/tools",
  "/activities",
  "/settings",
]);

/**
 * True when the route should hide bottom nav and use internal page layout
 * (back link, title + content). Includes list pages under Activities and all detail/form pages.
 */
export function isInternalPage(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return !BOTTOM_NAV_PATHS.has(normalized);
}
