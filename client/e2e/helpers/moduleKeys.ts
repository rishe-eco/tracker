/**
 * The module intros an e2e user has viewed, so overlays never block a test.
 * One list for `globalSetup.ts` (the shared user) and `helpers/freshUser.ts`
 * (a user per test): a new module intro is added here, once.
 */
export const MODULE_KEYS = [
  "today",
  "pre-day",
  "after-day",
  "goals-list",
  "manage-goal",
  "projects-list",
  "intervals-list",
  "calendar",
  "journals",
];
