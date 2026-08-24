/**
 * Keyed/instrumented detectors for V1, V2, V5 and V6.
 *
 * The spec (`04-verification-lab.md` §4) states what each level *means* but,
 * unlike V3/V4 (build plan §4.1-§4.3), does not spell out the exact decision
 * rule — the same gap Decomposition's build plan left for a few criteria.
 * Resolved here, deterministically, against the authored key and
 * instrumented event order; documented so the choice is visible rather than
 * buried in a conditional.
 */

import type { BenchEntry, FaultProfile, Verdict, VerificationElement } from "../../../content/skills/verification/types";
import type { Locale } from "../../../content/skills/types";
import { verificationEvidence as ev } from "../../../content/skills/verification/v1/evidence";

export type RubricLevel = 0 | 1 | 2;
export type CriterionResult = { level: RubricLevel; evidence: string };

/**
 * V1 — oracle named. Level 2 requires the oracle to be named *before* any
 * check is run (enforced upstream by the session service's lock, not here)
 * and to actually lead somewhere: at least one of the checks the learner
 * went on to run bears on the claim. A `NO_ORACLE` item inverts what "bears
 * on the claim" can mean — nothing on its bench ever does, by the content
 * validator's own rule — so there the correct oracle *is* recognising that,
 * and V1 is scored against the eventual verdict instead.
 */
export function scoreOracleNamed(input: {
  oracleText: string;
  namedBeforeAnyCheck: boolean;
  selected: BenchEntry[];
  profile: FaultProfile;
  verdict: Verdict;
  keyVerdict: Verdict;
  locale: Locale;
}): CriterionResult {
  const { locale } = input;
  const text = input.oracleText.trim();
  if (!text || !input.namedBeforeAnyCheck) {
    return { level: 0, evidence: ev(locale, "v1.none") };
  }

  if (input.profile === "NO_ORACLE") {
    if (input.verdict === input.keyVerdict) {
      return { level: 2, evidence: ev(locale, "v1.noOracleItemCorrect") };
    }
    return { level: 1, evidence: ev(locale, "v1.noOracleItemWrong") };
  }

  const bearsOnClaim = input.selected.some((c) => c.bearsOnClaim);
  if (bearsOnClaim && text.length >= 8) {
    return { level: 2, evidence: ev(locale, "v1.ok") };
  }
  return { level: 1, evidence: ev(locale, "v1.noBearing") };
}

/**
 * V2 — independence. Scored against which checks were actually run, not the
 * oracle statement. The rubric's tail clause — "where independence is
 * unobtainable, say so" — is honoured for `NO_ORACLE` items by scoring on the
 * verdict alone: closing on 'cannot verify' already is the independence-
 * respecting move, regardless of what non-independent checks were poked at
 * alongside it.
 */
export function scoreIndependence(input: {
  selected: BenchEntry[];
  profile: FaultProfile;
  verdict: Verdict;
  keyVerdict: Verdict;
  locale: Locale;
}): CriterionResult {
  const { locale } = input;
  if (input.profile === "NO_ORACLE" && input.verdict === input.keyVerdict) {
    return { level: 2, evidence: ev(locale, "v2.noOracleItem") };
  }

  const independent = input.selected.filter((c) => c.independent);
  const nonIndependent = input.selected.filter((c) => !c.independent);

  if (independent.length === 0) {
    return { level: 0, evidence: ev(locale, "v2.none") };
  }
  if (nonIndependent.length === 0) {
    return { level: 2, evidence: ev(locale, "v2.all") };
  }
  return { level: 1, evidence: ev(locale, "v2.mixed") };
}

/**
 * V5 — localisation. `null` on control items: nothing fails on `CORRECT` or
 * `NO_ORACLE`, so there is no element to locate and the criterion doesn't
 * apply, the same "unscored, not zero" treatment Decomposition gives an
 * inapplicable criterion.
 */
export function scoreLocalisation(input: {
  failingElementId: string | null;
  chosenElementId: string | null;
  verdict: Verdict;
  keyVerdict: Verdict;
  locale: Locale;
}): CriterionResult | null {
  if (input.failingElementId === null) return null;
  const { locale } = input;

  if (input.chosenElementId === input.failingElementId) {
    return { level: 2, evidence: ev(locale, "v5.exact") };
  }
  if (input.verdict === input.keyVerdict) {
    return { level: 1, evidence: ev(locale, "v5.wrongElement") };
  }
  return { level: 0, evidence: ev(locale, "v5.none") };
}

/**
 * V6 — honest closure. Level 0 whenever the verdict itself is wrong: an
 * unverifiable artifact reported as verified, or a verifiable one abandoned
 * as unverifiable, are both exactly "verdict doesn't match the key." A
 * correct verdict then needs a residual-risk statement that isn't empty and
 * isn't a bare restatement of the answer or the verdict word itself — the
 * detector build plan §9 calls for.
 */
export function scoreHonestClosure(input: {
  verdict: Verdict;
  keyVerdict: Verdict;
  residualRisk: string;
  answerText: string;
  locale: Locale;
}): CriterionResult {
  const { locale } = input;
  if (input.verdict !== input.keyVerdict) {
    return { level: 0, evidence: ev(locale, "v6.wrongVerdict") };
  }
  const risk = input.residualRisk.trim();
  const isRestatement =
    risk.length < 8 ||
    risk.toLowerCase() === input.answerText.trim().toLowerCase() ||
    risk.toLowerCase() === input.verdict.toLowerCase();
  if (risk && !isRestatement) {
    return { level: 2, evidence: ev(locale, "v6.withResidual") };
  }
  return { level: 1, evidence: ev(locale, "v6.noResidual") };
}

/** Whichever of the item's enumerated elements is the correct answer, for the reveal — never sent before commit. */
export function labelFor(elements: VerificationElement[], elementId: string | null): VerificationElement | null {
  if (elementId === null) return null;
  return elements.find((e) => e.elementId === elementId) ?? null;
}
