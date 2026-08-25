/**
 * Which mode a sitting is taken in, in one place rather than six.
 *
 * A module that has come due is practised in `review` mode, and that word is
 * load-bearing on the server: only a `review` submission moves the module's
 * place on the expanding review ladder (1, 3, 7, 21, 60 days) or routes a
 * failure back to the diagnose step. A due module opened as an ordinary
 * `module` sitting is scored normally and silently leaves the schedule where
 * it was — which is what every lab did before this existed.
 */

export type SessionMode = "assessment" | "review" | "module" | "calibrated_practice";

/** The mode a lab page should link a module row with, given that module's state. */
export function modeForModuleState(state: string): "review" | "module" {
  return state === "due_review" ? "review" : "module";
}

/**
 * The mode a session page should open in.
 *
 * `requested` comes from the URL, so it is only allowed to say `review`. A
 * query string must not be able to ask for `assessment` — that mode serves
 * frozen probe snapshots and stamps a probe id, and letting a link choose it
 * would put un-probed attempts into a probe's results.
 */
export function resolveSessionMode(opts: {
  isProbe: boolean;
  requested: string | null;
  moduleKey: string | undefined;
}): SessionMode {
  if (opts.isProbe) return "assessment";
  if (opts.requested === "review" && opts.moduleKey) return "review";
  return opts.moduleKey ? "module" : "calibrated_practice";
}
