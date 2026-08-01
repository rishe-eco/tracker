/**
 * Evidence Lab scoring.
 *
 * Pure functions: the resolver gathers rows, this decides what they mean. All
 * of it is either instrumented behaviour or an authored key — no model is
 * involved anywhere in this file, which is why Evidence Lab works with no LLM
 * configured at all.
 *
 * Spec: 02-evidence-lab.md §6.
 */

import type { EvidenceItemSpec, FaultTag, Verdict } from "../../content/skills/types";
import { isControl, PROFILE_FAULT_TAG as FAULT_TAG } from "../../content/skills/types";

export type CheckEventInput = {
  /** opened_sideways | search_issued | source_submitted | verdict_set | revealed */
  kind: string;
  offsetMs: number;
  payload?: string | null;
};

export type SubmittedSource = { url: string; snippet?: string | null };

export type EvidenceSubmission = {
  verdict: Verdict;
  /** 0–100. Feeds the Brier score; never gates anything. */
  confidence: number;
  faultTag: FaultTag;
  sources: SubmittedSource[];
  latencyMs: number;
};

export type EvidenceItemScore = {
  lateral: 0 | 1;
  independence: 0 | 1;
  accuracy: 0 | 1;
  traceQuality: 0 | 1 | 2;
  /** The headline measure: lateral AND independent AND accurate. */
  strict: 0 | 1;
  brier: number;
  timeToFirstCheckMs: number | null;
  isControlItem: boolean;
  /** Flagged a true claim — the failure mode that looks like diligence. */
  falseAlarm: boolean;
  /** Confident, wrong, and never checked. */
  overTrust: boolean;
};

/** Confidence at or above this counts as "confident" for over-trust. */
export const OVER_TRUST_CONFIDENCE = 70;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function firstOffset(events: CheckEventInput[], kind: string): number | null {
  const matches = events.filter((e) => e.kind === kind).map((e) => e.offsetMs);
  return matches.length ? Math.min(...matches) : null;
}

export function scoreEvidenceItem(
  spec: EvidenceItemSpec,
  submission: EvidenceSubmission,
  events: CheckEventInput[]
): EvidenceItemScore {
  const control = isControl(spec.profile);

  // The verdict boundary. A check performed after committing is not a check —
  // it is rationalisation, and it scores as non-lateral.
  const verdictAt = firstOffset(events, "verdict_set") ?? submission.latencyMs;
  const openedAt = firstOffset(events, "opened_sideways");
  const sourceSubmittedBeforeVerdict = events.some(
    (e) => e.kind === "source_submitted" && e.offsetMs < verdictAt
  );

  const lateral: 0 | 1 =
    openedAt !== null && openedAt < verdictAt && sourceSubmittedBeforeVerdict ? 1 : 0;

  // Independence: at least one returned source that is not the answer's own
  // citation or a known mirror of it. Two sources that share an origin are one.
  const blocked = new Set(spec.nonIndependentHosts.map((h) => h.toLowerCase().replace(/^www\./, "")));
  const independence: 0 | 1 = submission.sources.some((s) => {
    const host = hostOf(s.url);
    return host !== null && !blocked.has(host);
  })
    ? 1
    : 0;

  const accuracy: 0 | 1 = submission.verdict === spec.key ? 1 : 0;

  // Trace quality separates "something is off" from "this specific thing is off".
  const expectedTag = control ? "none" : FAULT_TAG[spec.profile];
  let traceQuality: 0 | 1 | 2;
  if (submission.faultTag === expectedTag) traceQuality = 2;
  else if (accuracy === 1) traceQuality = 1;
  else traceQuality = 0;

  const strict: 0 | 1 = lateral === 1 && independence === 1 && accuracy === 1 ? 1 : 0;

  const confidence = Math.min(100, Math.max(0, submission.confidence));
  const brier = Math.pow(confidence / 100 - accuracy, 2);

  return {
    lateral,
    independence,
    accuracy,
    traceQuality,
    strict,
    brier,
    timeToFirstCheckMs: openedAt,
    isControlItem: control,
    falseAlarm: control && submission.verdict !== "supported",
    overTrust: accuracy === 0 && confidence >= OVER_TRUST_CONFIDENCE && lateral === 0,
  };
}

export type SessionScore = {
  itemCount: number;
  strictCount: number;
  /** 0–1. Published instruction moves this from ~0.095 to ~0.466. */
  strictComposite: number;
  hitRate: number;
  falseAlarmRate: number;
  /**
   * Hit rate minus false-alarm rate. Reported beside the composite and never
   * below the fold: friction can shift reliance without improving the ability
   * to tell good advice from bad, and only this number can tell the difference.
   */
  discrimination: number;
  meanBrier: number;
  medianTimeToFirstCheckMs: number | null;
  overTrustRate: number;
  accuracyRate: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function scoreSession(scores: EvidenceItemScore[]): SessionScore {
  const n = scores.length;
  if (n === 0) {
    return {
      itemCount: 0,
      strictCount: 0,
      strictComposite: 0,
      hitRate: 0,
      falseAlarmRate: 0,
      discrimination: 0,
      meanBrier: 0,
      medianTimeToFirstCheckMs: null,
      overTrustRate: 0,
      accuracyRate: 0,
    };
  }

  const faulty = scores.filter((s) => !s.isControlItem);
  const controls = scores.filter((s) => s.isControlItem);

  const hitRate = faulty.length ? faulty.filter((s) => s.accuracy === 1).length / faulty.length : 0;
  const falseAlarmRate = controls.length
    ? controls.filter((s) => s.falseAlarm).length / controls.length
    : 0;

  // Speed is only meaningful on items the learner actually checked, and only on
  // faulty ones — a control needs no fault found to be answered correctly.
  const checkTimes = faulty
    .filter((s) => s.strict === 1 && s.timeToFirstCheckMs !== null)
    .map((s) => s.timeToFirstCheckMs as number);

  const strictCount = scores.filter((s) => s.strict === 1).length;

  return {
    itemCount: n,
    strictCount,
    strictComposite: strictCount / n,
    hitRate,
    falseAlarmRate,
    discrimination: hitRate - falseAlarmRate,
    meanBrier: scores.reduce((sum, s) => sum + s.brier, 0) / n,
    medianTimeToFirstCheckMs: median(checkTimes),
    overTrustRate: scores.filter((s) => s.overTrust).length / n,
    accuracyRate: scores.filter((s) => s.accuracy === 1).length / n,
  };
}
