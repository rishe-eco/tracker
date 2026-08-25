import { describe, expect, it } from "vitest";
import {
  dueProbeRows,
  dueReviewRows,
  moduleHref,
  recommendNext,
  type SkillKey,
  type SkillOverview,
} from "~/components/skills/trainingLab";

/**
 * The hub's recommendation ladder (07-training-lab-hub.md §5).
 *
 * Five rules, first match wins, ties broken by canonical order. The last rule
 * is the interesting one: it names no lab at all, because the six labs' headline
 * metrics are on six different scales and a hub that picked a "weakest" one
 * would be inventing a ranking the labs themselves refuse to invent (§5a).
 */

const KEYS: SkillKey[] = ["evidence", "clarity", "decomposition", "verification", "delegation", "monitoring"];

function overview(skillKey: SkillKey, patch: Partial<SkillOverview> = {}): SkillOverview {
  return {
    skillKey,
    moduleCount: 6,
    masteredCount: 0,
    inProgressCount: 0,
    totalAttempts: 0,
    lastAttemptAt: null,
    hasBaseline: false,
    assessmentSkipped: false,
    probeReady: true,
    reviewStatus: "reviewed",
    dueModules: [],
    dueProbe: null,
    ...patch,
  };
}

/** All six, untouched, with the named ones patched. */
function board(patches: Partial<Record<SkillKey, Partial<SkillOverview>>> = {}): SkillOverview[] {
  return KEYS.map((k) => overview(k, patches[k] ?? {}));
}

describe("recommendNext", () => {
  it("rule 1: a due probe on a ready pack outranks everything", () => {
    const rec = recommendNext(
      board({
        monitoring: { dueProbe: "post", masteredCount: 6, totalAttempts: 20 },
        clarity: { dueModules: [{ moduleKey: "r1", title: "One ask" }], totalAttempts: 4 },
      })
    );

    expect(rec).toMatchObject({ kind: "probe", skillKey: "monitoring", timepoint: "post" });
  });

  it("rule 1: a due probe on a pack that is not ready is skipped, not offered", () => {
    // `dueSkillProbes` does not check readiness; the lab page does, and would
    // show `probeBlocked` instead of a start button. Recommending it would send
    // the learner to a page that refuses the thing it recommended (§5b).
    const rec = recommendNext(
      board({
        monitoring: { dueProbe: "post", probeReady: false, masteredCount: 6, totalAttempts: 20 },
        clarity: { dueModules: [{ moduleKey: "r1", title: "One ask" }], totalAttempts: 4 },
      })
    );

    expect(rec).toMatchObject({ kind: "review", skillKey: "clarity", moduleKey: "r1" });
  });

  it("rule 2: a due review outranks continuing and starting", () => {
    const rec = recommendNext(
      board({
        delegation: { dueModules: [{ moduleKey: "g4-split", title: "Split the work" }], totalAttempts: 9 },
        evidence: { totalAttempts: 3, lastAttemptAt: "2026-08-24T10:00:00.000Z" },
      })
    );

    expect(rec).toMatchObject({
      kind: "review",
      skillKey: "delegation",
      moduleKey: "g4-split",
      moduleTitle: "Split the work",
      href: "/tools/skills/delegation/session?module=g4-split&mode=review",
    });
  });

  it("rule 3: nothing started anywhere means Evidence, by name", () => {
    expect(recommendNext(board())).toEqual({
      kind: "start",
      skillKey: "evidence",
      href: "/tools/skills/evidence",
    });
  });

  it("rule 4: otherwise continue the most recently touched unfinished lab", () => {
    const rec = recommendNext(
      board({
        evidence: { totalAttempts: 8, masteredCount: 2, lastAttemptAt: "2026-08-20T10:00:00.000Z" },
        verification: { totalAttempts: 3, masteredCount: 1, lastAttemptAt: "2026-08-24T18:30:00.000Z" },
      })
    );

    expect(rec).toMatchObject({ kind: "continue", skillKey: "verification" });
  });

  it("rule 4: a finished lab is never the one to continue", () => {
    const rec = recommendNext(
      board({
        // Most recently touched, but there is nothing left in it.
        monitoring: { totalAttempts: 30, masteredCount: 6, lastAttemptAt: "2026-08-25T09:00:00.000Z" },
        clarity: { totalAttempts: 2, masteredCount: 1, lastAttemptAt: "2026-08-01T09:00:00.000Z" },
      })
    );

    expect(rec).toMatchObject({ kind: "continue", skillKey: "clarity" });
  });

  it("rule 5: all mastered and nothing due names no lab at all", () => {
    const rec = recommendNext(board(Object.fromEntries(KEYS.map((k) => [k, { masteredCount: 6, totalAttempts: 12 }]))));

    expect(rec).toEqual({ kind: "allClear" });
    expect(JSON.stringify(rec)).not.toContain("skillKey");
  });
});

describe("recommendNext — ties", () => {
  it("breaks a two-review tie by canonical order, not by array order", () => {
    const shuffled = [
      overview("monitoring", { dueModules: [{ moduleKey: "s2-explain", title: "Explain it" }], totalAttempts: 5 }),
      overview("clarity", { dueModules: [{ moduleKey: "r1-ask", title: "One ask" }], totalAttempts: 5 }),
    ];

    expect(recommendNext(shuffled)).toMatchObject({ kind: "review", skillKey: "clarity" });
  });

  it("breaks a two-probe tie by canonical order", () => {
    const shuffled = [
      overview("delegation", { dueProbe: "post", masteredCount: 6, totalAttempts: 20 }),
      overview("decomposition", { dueProbe: "delayed", masteredCount: 6, totalAttempts: 20 }),
    ];

    expect(recommendNext(shuffled)).toMatchObject({ kind: "probe", skillKey: "decomposition" });
  });

  it("falls back to canonical order when nothing unfinished has been touched", () => {
    const rec = recommendNext(
      board({
        // Finished, and the only lab with a date on it.
        monitoring: { totalAttempts: 30, masteredCount: 6, lastAttemptAt: "2026-08-25T09:00:00.000Z" },
      })
    );

    expect(rec).toMatchObject({ kind: "continue", skillKey: "evidence" });
  });
});

describe("the due-now list", () => {
  it("flattens reviews across labs in canonical order and links each in review mode", () => {
    const rows = dueReviewRows(
      board({
        monitoring: { dueModules: [{ moduleKey: "s2-explain", title: "Explain it" }] },
        evidence: { dueModules: [{ moduleKey: "e1-source", title: "Source" }] },
      })
    );

    expect(rows.map((r) => r.skillKey)).toEqual(["evidence", "monitoring"]);
    expect(rows[0].href).toBe("/tools/skills/evidence/drill?mode=review&module=e1-source");
    expect(rows[1].href).toBe("/tools/skills/monitoring/session?module=s2-explain&mode=review");
  });

  it("leaves out a due probe whose pack is not ready", () => {
    const rows = dueProbeRows(
      board({
        evidence: { dueProbe: "post", probeReady: true },
        clarity: { dueProbe: "delayed", probeReady: false },
      })
    );

    expect(rows).toEqual([{ skillKey: "evidence", timepoint: "post", href: "/tools/skills/evidence" }]);
  });
});

describe("moduleHref", () => {
  it("puts mode first for Evidence's drill and second everywhere else", () => {
    // Not cosmetic: this is the shape each lab page already links with, and two
    // spellings of the same link would make the hub and the lab page disagree.
    expect(moduleHref("evidence", "e1-source", "module")).toBe("/tools/skills/evidence/drill?mode=module&module=e1-source");
    expect(moduleHref("clarity", "r1-ask", "module")).toBe("/tools/skills/clarity/session?module=r1-ask&mode=module");
  });
});
