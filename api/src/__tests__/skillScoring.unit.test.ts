import { describe, expect, it } from "vitest";
import { ITEM_SPEC_BY_ID } from "../content/skills/evidence/v2";
import {
  evaluateMastery,
  evaluateTestedOut,
  MASTERY_MAX_MEDIAN_TTFC_MS,
  type ScoredAttempt,
} from "../services/skills/mastery";
import {
  jitterDays,
  nextReviewAt,
  onReviewFailed,
  onReviewPassed,
  REVIEW_INTERVAL_DAYS,
  delayedProbeDueAt,
} from "../services/skills/scheduler";
import {
  scoreEvidenceItem,
  scoreSession,
  type CheckEventInput,
  type EvidenceItemScore,
  type EvidenceSubmission,
} from "../services/skills/scoring";

// ev2-a4: plausible_nonexistent, key "unsupported", fault tag "existence".
const FAULTY = ITEM_SPEC_BY_ID.get("ev2-a4")!;
// ev2-a3: control (true_cited), key "supported", nature.com is a non-independent host.
const CONTROL = ITEM_SPEC_BY_ID.get("ev2-a3")!;

const submission = (over: Partial<EvidenceSubmission> = {}): EvidenceSubmission => ({
  verdict: "unsupported",
  confidence: 80,
  faultTag: "existence",
  sources: [{ url: "https://www.fda.gov/food/buy-store-serve-safe-food" }],
  latencyMs: 45_000,
  ...over,
});

/** A learner who checked properly: opened, brought a source back, then committed. */
const goodEvents = (checkAt = 8_000): CheckEventInput[] => [
  { kind: "opened_sideways", offsetMs: checkAt },
  { kind: "search_issued", offsetMs: checkAt + 500 },
  { kind: "source_submitted", offsetMs: checkAt + 20_000 },
  { kind: "verdict_set", offsetMs: checkAt + 30_000 },
];

describe("scoreEvidenceItem", () => {
  it("scores a proper check as strict", () => {
    const s = scoreEvidenceItem(FAULTY, submission(), goodEvents());
    expect(s).toMatchObject({ lateral: 1, independence: 1, accuracy: 1, traceQuality: 2, strict: 1 });
    expect(s.timeToFirstCheckMs).toBe(8_000);
  });

  it("does not count a check made after the verdict was committed", () => {
    // Checking after committing is rationalisation, not verification — the
    // ordering is the measurement.
    const events: CheckEventInput[] = [
      { kind: "verdict_set", offsetMs: 5_000 },
      { kind: "opened_sideways", offsetMs: 6_000 },
      { kind: "source_submitted", offsetMs: 12_000 },
    ];
    const s = scoreEvidenceItem(FAULTY, submission(), events);
    expect(s.lateral).toBe(0);
    expect(s.accuracy).toBe(1); // right answer...
    expect(s.strict).toBe(0); // ...but not by checking
  });

  it("rejects a source that is not independent of the answer's own citation", () => {
    const s = scoreEvidenceItem(
      CONTROL,
      submission({
        verdict: "supported",
        faultTag: "none",
        sources: [{ url: "https://www.nature.com/articles/201993a0" }],
      }),
      goodEvents()
    );
    // Two sources that share an origin are one source.
    expect(s.independence).toBe(0);
    expect(s.accuracy).toBe(1);
    expect(s.strict).toBe(0);
  });

  it("gives partial trace credit for the right verdict with the wrong fault located", () => {
    const s = scoreEvidenceItem(FAULTY, submission({ faultTag: "figure" }), goodEvents());
    expect(s.accuracy).toBe(1);
    expect(s.traceQuality).toBe(1);
  });

  it("records a false alarm when a true claim is flagged", () => {
    const s = scoreEvidenceItem(
      CONTROL,
      submission({ verdict: "unsupported", faultTag: "citation" }),
      goodEvents()
    );
    expect(s.falseAlarm).toBe(true);
    expect(s.accuracy).toBe(0);
  });

  it("flags over-trust only when confident, wrong, and unchecked", () => {
    const unchecked: CheckEventInput[] = [{ kind: "verdict_set", offsetMs: 3_000 }];
    const s = scoreEvidenceItem(FAULTY, submission({ verdict: "supported", confidence: 90 }), unchecked);
    expect(s.overTrust).toBe(true);

    const humble = scoreEvidenceItem(
      FAULTY,
      submission({ verdict: "supported", confidence: 20 }),
      unchecked
    );
    expect(humble.overTrust).toBe(false);
  });

  it("scores the Brier component from confidence and correctness", () => {
    const confidentRight = scoreEvidenceItem(FAULTY, submission({ confidence: 100 }), goodEvents());
    expect(confidentRight.brier).toBe(0);

    const confidentWrong = scoreEvidenceItem(
      FAULTY,
      submission({ verdict: "supported", confidence: 100 }),
      goodEvents()
    );
    expect(confidentWrong.brier).toBe(1);
  });
});

describe("scoreSession", () => {
  const score = (over: Partial<EvidenceItemScore>): EvidenceItemScore => ({
    lateral: 1,
    independence: 1,
    accuracy: 1,
    traceQuality: 2,
    strict: 1,
    brier: 0,
    timeToFirstCheckMs: 10_000,
    isControlItem: false,
    falseAlarm: false,
    overTrust: false,
    ...over,
  });

  it("gives a discriminating learner a high discrimination score", () => {
    const session = scoreSession([
      score({}),
      score({}),
      score({ isControlItem: true }),
      score({ isControlItem: true }),
    ]);
    expect(session.hitRate).toBe(1);
    expect(session.falseAlarmRate).toBe(0);
    expect(session.discrimination).toBe(1);
  });

  it("gives a uniformly suspicious learner a discrimination near zero", () => {
    // This is the assertion the whole instrument turns on. Someone who flags
    // everything catches every faulty item — and every true one. High hit rate,
    // no skill. If discrimination didn't catch this, the tool would be handing
    // out good scores for distrust.
    const session = scoreSession([
      score({}),
      score({}),
      score({ isControlItem: true, accuracy: 0, falseAlarm: true, strict: 0 }),
      score({ isControlItem: true, accuracy: 0, falseAlarm: true, strict: 0 }),
    ]);
    expect(session.hitRate).toBe(1);
    expect(session.falseAlarmRate).toBe(1);
    expect(session.discrimination).toBe(0);
    // ...and the composite alone would have looked respectable.
    expect(session.strictComposite).toBe(0.5);
  });

  it("measures reflex speed only on faulty items that were actually checked", () => {
    const session = scoreSession([
      score({ timeToFirstCheckMs: 10_000 }),
      score({ timeToFirstCheckMs: 30_000 }),
      score({ isControlItem: true, timeToFirstCheckMs: 90_000 }),
      score({ strict: 0, timeToFirstCheckMs: 120_000 }),
    ]);
    expect(session.medianTimeToFirstCheckMs).toBe(20_000);
  });

  it("handles an empty session without dividing by zero", () => {
    expect(scoreSession([]).strictComposite).toBe(0);
  });
});

describe("evaluateMastery", () => {
  const attempt = (over: Partial<ScoredAttempt> = {}): ScoredAttempt => ({
    lateral: 1,
    independence: 1,
    accuracy: 1,
    traceQuality: 2,
    strict: 1,
    brier: 0,
    timeToFirstCheckMs: 20_000,
    isControlItem: false,
    falseAlarm: false,
    overTrust: false,
    dayKey: "2026-07-26",
    ...over,
  });

  const acrossTwoDays = () => [
    attempt({ dayKey: "2026-07-26" }),
    attempt({ dayKey: "2026-07-26" }),
    attempt({ dayKey: "2026-07-26" }),
    attempt({ dayKey: "2026-07-27" }),
    attempt({ dayKey: "2026-07-27" }),
    attempt({ dayKey: "2026-07-27" }),
  ];

  it("grants mastery when all four clauses are met", () => {
    const verdict = evaluateMastery(acrossTwoDays());
    expect(verdict.mastered).toBe(true);
    expect(verdict.unmetCriteria).toEqual([]);
  });

  it("refuses mastery earned entirely in one sitting", () => {
    const sameDay = acrossTwoDays().map((a) => ({ ...a, dayKey: "2026-07-26" }));
    const verdict = evaluateMastery(sameDay);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.join(" ")).toContain("required days");
  });

  it("refuses mastery when a true claim was flagged", () => {
    const withFalseAlarm = acrossTwoDays();
    withFalseAlarm[5] = attempt({ dayKey: "2026-07-27", isControlItem: true, falseAlarm: true, strict: 1 });
    const verdict = evaluateMastery(withFalseAlarm);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.join(" ")).toContain("flagged as faulty");
  });

  it("refuses mastery when checking is accurate but slow", () => {
    const slow = acrossTwoDays().map((a) => ({
      ...a,
      timeToFirstCheckMs: MASTERY_MAX_MEDIAN_TTFC_MS + 30_000,
    }));
    const verdict = evaluateMastery(slow);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.join(" ")).toContain("median time to first check");
  });

  it("reports every unmet clause rather than only the first", () => {
    const verdict = evaluateMastery([attempt({ strict: 0, timeToFirstCheckMs: null })]);
    expect(verdict.mastered).toBe(false);
    expect(verdict.unmetCriteria.length).toBeGreaterThan(1);
  });

  it("tests a learner out only on a clean, strong baseline", () => {
    const strong = Array.from({ length: 5 }, () => attempt());
    expect(evaluateTestedOut(strong)).toBe(true);

    const withFalseAlarm = [...strong, attempt({ isControlItem: true, falseAlarm: true })];
    expect(evaluateTestedOut(withFalseAlarm)).toBe(false);
    expect(evaluateTestedOut([])).toBe(false);
  });
});

describe("scheduler", () => {
  const now = new Date("2026-07-26T09:00:00.000Z");

  it("keeps jitter deterministic and within one day", () => {
    for (const seed of ["u1:e1-stop", "u1:e2-source", "u2:e6-reflex"]) {
      expect(jitterDays(seed)).toBe(jitterDays(seed));
      expect([-1, 0, 1]).toContain(jitterDays(seed));
    }
  });

  it("never schedules a review inside the same day", () => {
    // Interval 0 is one day; a -1 jitter would otherwise land it in the same
    // sitting and defeat the spacing it exists to create.
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const due = nextReviewAt(0, now, seed);
      expect(due.getTime()).toBeGreaterThanOrEqual(now.getTime() + 24 * 60 * 60 * 1000);
    }
  });

  it("advances the ladder on a pass and holds at the last rung", () => {
    expect(onReviewPassed(0, now, "s").intervalIndex).toBe(1);
    const last = REVIEW_INTERVAL_DAYS.length - 1;
    expect(onReviewPassed(last, now, "s").intervalIndex).toBe(last);
  });

  it("sends a failed review back to diagnose, not back to the concept", () => {
    const outcome = onReviewFailed(3, now, "s");
    expect(outcome.resumeAtStep).toBe(5);
    expect(outcome.intervalIndex).toBe(0);
  });

  it("schedules the delayed probe a week after the post probe", () => {
    const due = delayedProbeDueAt(now);
    expect(due.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
