/**
 * Weight of advice — the one number this entire tool rests on. Spec:
 * `05-delegation-lab.md` §2; build plan §4.1, §4.2.
 *
 *     WOA = (final - initial) / (advice - initial)
 *
 * Four edge cases, each with a decided rule (build plan §4.1) rather than a
 * runtime surprise. Every function here clamps for scoring but the caller is
 * responsible for retaining the raw value in `responseStructure` for export
 * — a metric that silently clamps and does not retain has thrown away its
 * most interesting learners.
 */

export type WoaResult = {
  /** Undefined (null) when advice === initial — division by zero, and a real occurrence whenever a learner guesses the advice value exactly. */
  raw: number | null;
  /** Clamped to [0, 1] for scoring. Null wherever `raw` is null. */
  clamped: number | null;
};

export function computeWoa(initial: number, advice: number, final: number): WoaResult {
  if (advice === initial) return { raw: null, clamped: null };
  const raw = (final - initial) / (advice - initial);
  const clamped = Math.max(0, Math.min(1, raw));
  return { raw, clamped };
}

/** Build plan §4.2 — the two cued benchmarks are named constants, expected to be tuned once real data exists; they are a defensible starting position, not a finding. */
export const BENCH_TRUST = 0.75;
export const BENCH_KEEP = 0.25;
export const BENCH_NONE = 0.5;

export type CueDirectionLike = "trust" | "keep" | "none";

export function benchmarkFor(cueDirection: CueDirectionLike): number {
  if (cueDirection === "trust") return BENCH_TRUST;
  if (cueDirection === "keep") return BENCH_KEEP;
  return BENCH_NONE;
}

/** G3 level (build plan §4.2): |WOA - benchmark| <= 0.2 -> 2; <= 0.4 -> 1; else 0. Null when WOA itself is undefined. */
export function scoreProportionateWeight(clampedWoa: number | null, benchmark: number): 0 | 1 | 2 | null {
  if (clampedWoa === null) return null;
  const distance = Math.abs(clampedWoa - benchmark);
  if (distance <= 0.2) return 2;
  if (distance <= 0.4) return 1;
  return 0;
}

/** Direction, for the reveal's distinct failure copies (spec §10) — never collapsed into one "your weighting was off" message. */
export type RelianceDirection = "over" | "under" | "costly" | "ok";

/**
 * Over-reliance: moved substantially toward advice that was worse than the
 * learner's own estimate. Under-reliance: barely moved toward advice that
 * was much better. Build plan §4.3's population-level thresholds, applied
 * per item for the reveal's copy.
 *
 * **`costly` is a fourth bucket added after persona review pass 3.** The two
 * thresholds above are population-level and deliberately wide, and between
 * them sat a real case the reveal called "ok": e.g. own 1100, advice 1150,
 * final 1120, truth 1105 — WOA 0.40, so under the over-reliance bar, but the
 * move went toward worse advice and lost 10 units of accuracy. The reveal
 * printed "your movement roughly matched what the advice was worth here"
 * directly beside `net gain -10`, which is the screen contradicting itself.
 * `costly` is defined by outcome rather than by a threshold — the final
 * answer is further from the truth than the initial one, i.e. net gain is
 * negative — so `ok` now means what it says. `over` and `under` keep the
 * build plan's thresholds untouched and still take precedence.
 */
export function relianceDirection(
  clampedWoa: number | null,
  initial: number,
  advice: number,
  truth: number,
  final: number
): RelianceDirection {
  if (clampedWoa === null) return "ok";
  const initialError = Math.abs(initial - truth);
  const adviceError = Math.abs(advice - truth);
  if (clampedWoa > 0.5 && adviceError > initialError) return "over";
  if (clampedWoa < 0.25 && adviceError < initialError / 2) return "under";
  if (Math.abs(final - truth) > initialError) return "costly";
  return "ok";
}
