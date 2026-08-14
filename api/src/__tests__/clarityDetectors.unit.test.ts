import { describe, expect, it } from "vitest";
import {
  detectR1,
  detectR4,
  detectR6,
  isVoid,
  runDetectors,
  splitSentences,
} from "../services/skills/clarity/detectors";
import { ITEM_SPEC_BY_ID, detectorCriteriaFor } from "../content/skills/clarity/v1";
import { buildClarityPack } from "../content/skills/clarity/v1/index";

const surfaceOf = (itemId: string) =>
  buildClarityPack("en").items.find((i) => i.itemId === itemId)!.surface;

describe("splitSentences", () => {
  it("splits on terminal punctuation and newlines", () => {
    expect(splitSentences("One. Two! Three?")).toHaveLength(3);
    expect(splitSentences("")).toEqual([]);
  });
});

describe("R1 · ask placement and singularity", () => {
  it("awards level 2 to a single request led from the front", () => {
    const r = detectR1("Find why CSV export is slow and tell me the cause. Exports over 10k rows time out.");
    expect(r.level).toBe(2);
    expect(r.findings).toEqual([]);
  });

  it("does not read a supporting instruction as a second request", () => {
    // "Write X. Include Y." is one ask with a constraint. Counting it as two
    // would mark down a well-formed request, and the judge can only lower a
    // detector level, never raise it — so a false negative here is unfixable.
    const r = detectR1("Write the incident summary. Include a timeline. Keep it under 400 words.");
    expect(r.level).toBe(2);
  });

  it("marks down a request that arrives late", () => {
    const r = detectR1(surfaceOf("cl-a3").weakText!);
    expect(r.level).toBe(1);
    expect(r.findings.join(" ")).toMatch(/arrives in sentence 4/);
  });

  it("marks down two co-equal requests with no priority", () => {
    const r = detectR1("Refactor the exporter. Also write the migration guide.");
    expect(r.level).toBe(1);
    expect(r.findings.join(" ")).toMatch(/2 separate requests/);
  });

  it("recognises a question and a modal request as asks", () => {
    expect(detectR1("Why does the nightly sync fail?").level).toBe(2);
    expect(detectR1("Could you look at the exporter? It times out.").level).toBe(2);
  });

  it("gives level 0 when there is no request at all", () => {
    const r = detectR1("The export has been slow since the migration. Support has had complaints.");
    expect(r.level).toBe(0);
  });

  it("recognises everyday asks the verb list does not name", () => {
    // The failure this guards against is specific and bad: an ordinary request
    // scored 0 with "no identifiable request", on the screen teaching people how
    // to make requests. It cannot depend on someone having thought of the verb.
    for (const text of [
      "Read clause 14 of the attached lease and tell me whether I am allowed to keep a cat.",
      "Please tidy the garage this weekend so that the car fits inside.",
      "Redeliver the parcel by Friday 5pm or refund the order.",
      "Shortlist three venues under 4000 and send them to me by Thursday.",
    ]) {
      expect(detectR1(text).level, text).toBe(2);
    }
  });

  it("recognises light-verb requests", () => {
    // The verb carries no meaning here, the noun does — and `have` is an
    // auxiliary everywhere else, so it cannot just be added to the verb list.
    const r = detectR1("Please have a look at our gas oven next time you're round.");
    expect(r.level).toBe(2);
    expect(r.findings).toEqual([]);
  });

  it("does not read a plain statement as a command", () => {
    // The permissive imperative test earns its keep only if it still knows a
    // subject when it sees one.
    for (const text of [
      "Exports over 10k rows time out.",
      "Deadline is Friday and the budget is fixed.",
      "Hey — hope the sprint is going okay.",
      "Attached is the report from last quarter.",
    ]) {
      expect(detectR1(text).level, text).toBe(0);
    }
  });
});

describe("script coverage", () => {
  it("scores nothing rather than scoring zero on a script it cannot tokenise", () => {
    // Every routine here tokenises through an [a-z] class, so Persian reduced to
    // an empty token list and R1 returned a confident 0/2 — "No identifiable
    // request", in English, on a sentence opening with an explicit imperative.
    // The only criterion Persian was routed to always returned zero.
    const persian = "لطفاً فر گازی آشپزخانه را بررسی کن و تا پنج‌شنبه نتیجه را بفرست.";
    expect(runDetectors(persian, ["R1", "R4", "R6"])).toEqual([]);
  });

  it("routes every Persian criterion to the judge", () => {
    // Listing a criterion here is a claim that a detector can score it in that
    // language. Nothing can, yet — so the honest list is empty.
    expect(detectorCriteriaFor("fa")).toEqual([]);
    expect(detectorCriteriaFor("en")).toEqual(["R1", "R4", "R6"]);
  });

  it("still scores text that merely contains some non-Latin characters", () => {
    const mixed = 'Rewrite the résumé summary in 80 words — drop the "naïve" phrasing.';
    expect(runDetectors(mixed, ["R1"]).length).toBe(1);
  });
});

describe("R4 · referent resolution", () => {
  it("awards level 2 to fully bound text", () => {
    const r = detectR4("Update the CSV exporter so it accepts the v2 schema with nested `line_items`.");
    // "it" is bound — "the CSV exporter" precedes it. Flagging this would
    // punish exactly the sentence the module teaches.
    expect(r.level).toBe(2);
    expect(r.findings).toEqual([]);
  });

  it("catches dangling pointers in the seeded repair drill", () => {
    const r = detectR4(surfaceOf("cl-a4").weakText!);
    expect(r.level).toBe(0);
    expect(r.findings.length).toBeGreaterThanOrEqual(2);
  });

  it("catches unbounded quantifiers in the seeded repair drill", () => {
    const r = detectR4(surfaceOf("cl-a5").weakText!);
    expect(r.level).toBe(0);
    expect(r.findings.join(" ")).toMatch(/a few|a bit|soon/);
  });

  it("flags a bare comparative but not one paired with a target", () => {
    expect(detectR4("Make the dashboard query faster.").level).toBeLessThan(2);
    expect(detectR4("Bring the dashboard query under 200 ms at p95.").level).toBe(2);
  });

  it("flags an opening pronoun with nothing behind it", () => {
    const r = detectR4("It fails when they run the import.");
    expect(r.findings.join(" ")).toMatch(/no antecedent/);
  });

  it("grades one fault as partial and two as absent", () => {
    expect(detectR4("Rewrite the onboarding guide a bit.").level).toBe(1);
    expect(detectR4("Fix this. Make it better.").level).toBe(0);
  });
});

describe("R6 · economy and order", () => {
  it("catches a constraint buried at the end of a clause chain", () => {
    // Order is a fault inside a sentence too, and the sentence-level check
    // cannot see it — four clauses are still one sentence. Items built to teach
    // this used to fail R6 only because their deadline went unrecognised as a
    // constraint at all: the right level for the wrong reason.
    const late = detectR6(surfaceOf("cl-p19").weakText!);
    expect(late.level).toBeLessThan(2);
    expect(late.findings.join(" ")).toMatch(/last clause/);

    // …and the authored fix clears it, which is what makes the drill winnable.
    expect(detectR6(surfaceOf("cl-p19").exemplarFix!).level).toBe(2);
  });

  it("counts a deadline as a constraint", () => {
    // The commonest real constraint in an ordinary request, and the one most
    // likely to carry no digit and no keyword — just a day.
    for (const text of [
      "Take a look at the lease before Friday.",
      "Send the draft by Thursday.",
      "Pick a venue by the end of the week.",
    ]) {
      expect(detectR6(text).findings.join(" "), text).not.toMatch(/constrains the answer/);
    }
  });

  it("never bills the request itself as padding", () => {
    // R6 used to compute its asks only when R1 had already found one, and with a
    // different test. So a request R1 missed was quoted back by R6 as a sentence
    // that "adds no constraint, input, or criterion" — the learner penalised
    // twice for the one thing they got right.
    const r = detectR6("Please have a look at our gas oven next time you're round.");
    expect(r.findings.join(" ")).not.toMatch(/have a look/);
  });

  it("awards level 2 to a request where every sentence carries weight", () => {
    const r = detectR6(
      "Optimise the dashboard query so p95 is under 1 second on staging. Don't touch the shared cache."
    );
    expect(r.level).toBe(2);
  });

  it("catches padding and a buried constraint in the seeded drill", () => {
    const r = detectR6(surfaceOf("cl-a6").weakText!);
    expect(r.level).toBe(0);
    expect(r.findings.join(" ")).toMatch(/add no constraint/);
  });

  it("catches actions hidden in nouns", () => {
    const r = detectR6(surfaceOf("cl-a7").weakText!);
    expect(r.level).toBeLessThan(2);
    expect(r.findings.join(" ")).toMatch(/hiding in nouns/);
  });

  it("passes the rewrite the module teaches", () => {
    // If the model answer failed our own detector, the drill would be teaching
    // something the tool then marks wrong.
    const r = detectR6("The team should assess the caching layer and recommend improvements.");
    expect(r.level).toBe(2);
  });
});

describe("repair drills agree with their own rubric", () => {
  // Each repair item declares the level its fix must reach. The weak text must
  // fail that bar and a competent fix must clear it — otherwise the drill is
  // unwinnable or trivially passed.
  const REPAIR_FIXES: Record<string, string> = {
    "cl-a4": "Update the CSV exporter so it accepts the v2 schema with nested `line_items`.",
    "cl-a5": "Three dashboard queries take over 2 seconds. Bring each under 300 ms by Friday.",
    "cl-a6": "Search needs to tolerate typos: `recieve` currently returns nothing.",
    "cl-a7": "The team should assess the caching layer and recommend improvements.",
  };

  for (const [itemId, fix] of Object.entries(REPAIR_FIXES)) {
    it(`${itemId}: weak text fails and the fix clears the bar`, () => {
      const spec = ITEM_SPEC_BY_ID.get(itemId)!;
      const check = spec.repairCheck!;
      const weak = surfaceOf(itemId).weakText!;

      const before = runDetectors(weak, [check.criterion])[0];
      const after = runDetectors(fix, [check.criterion])[0];

      expect(before.level).toBeLessThan(check.requiredLevel);
      expect(after.level).toBeGreaterThanOrEqual(check.requiredLevel);
    });
  }
});

describe("void detection", () => {
  it("treats an empty or near-empty response as void, not as zero", () => {
    expect(isVoid("")).toBe(true);
    expect(isVoid("ok")).toBe(true);
    expect(isVoid("Find why CSV export is slow and tell me the cause.")).toBe(false);
  });

  it("treats a restatement of the prompt as void", () => {
    const scenario = "Write the request you would actually send about the outage.";
    expect(isVoid("Write the request you would actually send", scenario)).toBe(true);
  });
});

describe("runDetectors", () => {
  it("returns only the criteria asked for", () => {
    const results = runDetectors("Fix this.", ["R1", "R4", "R6"]);
    expect(results.map((r) => r.criterion)).toEqual(["R1", "R4", "R6"]);
    // R2/R3/R5 have no honest heuristic and must not silently return a level.
    expect(runDetectors("Fix this.", ["R2", "R3", "R5"])).toEqual([]);
  });
});
