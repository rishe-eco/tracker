/**
 * The Noticing guardrails, as tests.
 *
 * Six rules (coordinator brief, phase 2; spec §5's failure-mode table is the
 * underlying source): never say *help* where *notice* fits; never state the
 * lesson; nothing is owed; the other person is a person, not a task; every
 * optional step names its skip in plain words; the catches ask, never assert.
 *
 * Mirrors `feelingsNeedsGuardrails.unit.test.ts`'s structure exactly: each
 * test names the guardrail and the failure it prevents, checked against the
 * authored pack rather than the intent. **Two locales, two kinds of check** —
 * structural guardrails hold in any language; lexical ones ("never says why")
 * are checked by looking for a word, and the word is different in Persian, so
 * the English sweeps below are restated with Persian evidence in their own
 * block rather than sharing a regex (which would check one language twice).
 */

import { describe, expect, it } from "vitest";
import { DIALS } from "../content/noticing/dials";
import { buildNoticingPack } from "../content/noticing/v1";
import { SURFACE_EN } from "../content/noticing/v1/surface.en";
import { SURFACE_FA } from "../content/noticing/v1/surface.fa";

const pack = buildNoticingPack("en");
const loop = SURFACE_EN.loop;
const frame = SURFACE_EN.frame;

/** Every authored string in the pack, with a dotted path, for sweeping checks. */
function allStrings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => allStrings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => allStrings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const STRINGS_EN = allStrings(SURFACE_EN);

/**
 * `catches[].triggers[].match` holds words a *person* might type — several
 * of them are exactly the corrective, demanding or judgmental language the
 * app's own voice must avoid ("should", "lazy", "have to"). Sweeping them as
 * if they were app copy would be checking the wrong thing; they are the
 * material the catches exist to notice, not the app noticing out loud.
 * Excluded from every general sweep below. **Not** excluded: `.hints` beneath
 * a trigger — those ARE the app's voice (the offered questions) and stay
 * covered by every sweep, including the question-mark check in
 * `noticingContent`.
 */
const isTriggerPath = (path: string) => /\.triggers\[\d+\]\.match$/.test(path);

const offendingEN = (re: RegExp, only?: (path: string) => boolean) =>
  STRINGS_EN.filter(([p, v]) => !isTriggerPath(p) && (only ? only(p) : true) && re.test(v)).map(
    ([p, v]) => `${p}: ${v}`
  );

describe("never say help where notice fits", () => {
  it("keeps 'help' out of the app's own voice", () => {
    // The one deliberate exception: the day-one frame's recall prompt asks
    // about a memory of BEING helped (spec §4.1's own quoted line) — that is
    // the topic of recollection, not an instruction, so it is scoped out
    // here rather than weakening the rule everywhere else.
    const offenders = offendingEN(/\bhelp(ed|ing|s)?\b/i, (p) => !p.startsWith("frame.beatOne.moment"));
    expect(offenders).toEqual([]);
  });

  it("frames the day-one recall as a memory, not an instruction to help someone", () => {
    // The exemption above is narrow on purpose — confirm it is exactly the
    // recall prompt and nothing broader that still says "help".
    expect(frame.beatOne.moment.prompt.toLowerCase()).toContain("helped");
  });

  it("never frames the loop's own action step as 'who can I help'", () => {
    expect(loop.smallThingPrompt.toLowerCase()).not.toContain("help");
    expect(loop.smallThingPrompt).toMatch(/\b(offer|ask)\b/i);
  });
});

describe("never state the lesson", () => {
  it("the frame's turn reports what was written, not a general claim", () => {
    // P1-equivalent failure mode: asserting the mechanism instead of letting
    // the person's own two answers make the point. Both variants — the
    // ordinary line and the wishedInstead reroute's — are checked, since a
    // fix that only touched one would leave the same failure mode standing
    // in the other.
    const claim =
      /\b(this (shows|proves|means)|that's what noticing (means|is)|the lesson (is|here)|always works this way)\b/i;
    expect(frame.beatOne.turn.line).not.toMatch(claim);
    expect(frame.beatOne.turn.wishedLine).not.toMatch(claim);
  });

  it("the graduation door reports a capability rather than concluding a moral", () => {
    const g = [pack.graduation.line, pack.graduation.body, pack.graduation.close].join(" ");
    expect(g).not.toMatch(/\b(this proves|this means|the lesson|you have learned)\b/i);
  });

  it("the welcome-prediction correction stays a finding, not a verdict on the person", () => {
    const correction = frame.beatTwo.correction.body;
    expect(correction).not.toMatch(/\byou (always|never)\b/i);
  });
});

describe("nothing is owed", () => {
  it("has no streak, debt or scoring language anywhere in the pack", () => {
    expect(
      offendingEN(
        /\b(streak|in a row|keep it up|don't break|scores?|badges?|level up|earn points|\d+ points|owe|overdue|behind|catch up)\b/i
      )
    ).toEqual([]);
  });

  it("closes 'not sure' as warmly as any other complete answer", () => {
    expect(loop.needNotSure.trim()).not.toBe("");
    expect(loop.needNotSure).not.toMatch(/\b(sorry|failed|missed|should)\b/i);
  });

  it("never demands, only invites", () => {
    expect(offendingEN(/\b(you must|you need to|required|mandatory|complete this)\b/i)).toEqual([]);
  });

  it("closes the soft-capped repeat warmly rather than as a rule", () => {
    expect(DIALS.repeat.softCap).toBeLessThanOrEqual(4);
    expect(loop.addAnotherCapped).not.toMatch(/\b(limit|maximum|max|cannot|not allowed|only \d)\b/i);
  });

  it("frames graduation as a capability, with no number anywhere in it", () => {
    const g = [pack.graduation.line, pack.graduation.body, pack.graduation.close].join(" ");
    expect(g).not.toMatch(/\b(congratulations|achievement|unlocked|earned|milestone)\b|\d/);
  });
});

describe("the other person is a person, not a task", () => {
  it("never frames them as a project, case, or opportunity", () => {
    expect(offendingEN(/\b(project|case file|opportunity|target|prospect)\b/i)).toEqual([]);
  });

  it("the person field's warning treats them as a reader, not a record", () => {
    expect(loop.personThirdPartyWarning.toLowerCase()).toMatch(/\bread\b/);
  });

  it("the capacity portrait is framed around what the person HAD, never who they helped", () => {
    // Spec §5 (instrumentalized relationships): the portrait stores no names
    // and is built only from the offerer's own resources.
    const capacityCopy = [SURFACE_EN.capacity.prompt, SURFACE_EN.capacity.otherLabel].join(" ");
    expect(capacityCopy).not.toMatch(/\b(who|them|they)\b/i);
  });
});

describe("every optional step names its skip in plain words", () => {
  it("the small thing and 'not sure' both say so outright", () => {
    expect(loop.smallThingSkip.trim()).not.toBe("");
    expect(loop.needNotSure.trim()).not.toBe("");
  });

  it("the day-one recall names its own reroute rather than a dead end", () => {
    expect(frame.beatOne.moment.reroutePrompt.trim()).not.toBe("");
    expect(frame.beatOne.moment.rerouteLabel.trim()).not.toBe("");
  });

  it("keeps the need conditional, in both the full and the withdrawn prompt", () => {
    expect(loop.needPrompt).toMatch(/\bif\b/i);
    expect(loop.needPromptTerse).toMatch(/\bif\b/i);
  });
});

describe("the reroute doesn't presuppose that help ever arrived", () => {
  // The escape at step 1 ("can't think of one") lands on "a time you wished
  // someone had" (spec §4.1) — by construction, nobody made the connection
  // on that path. `moment.wishedPrompt` legitimately names the wished-for
  // help (it's recalling the wish, same exemption as the ordinary
  // `moment.prompt` — both are the topic of recollection, not the app's own
  // voice); `turn.wishedLine` is the one that must never claim the
  // connection itself actually happened, since that's the one fact that's
  // false on this path by construction.

  it("the turn's reroute line never claims anyone made the connection", () => {
    expect(frame.beatOne.turn.wishedLine).not.toMatch(
      /\b(helped|got from one to the other|read it|noticed it|they saw and understood)\b/i
    );
  });

  it("the wished-instead prompt signals a wish, not a memory of it happening", () => {
    expect(frame.beatOne.moment.wishedPrompt.toLowerCase()).toMatch(/\bwish/);
  });

  it("the reroute's turn line reports two true things, not a connection anyone made", () => {
    expect(frame.beatOne.turn.wishedLine.trim()).not.toBe("");
    expect(frame.beatOne.turn.wishedLine).not.toBe(frame.beatOne.turn.line);
  });
});

describe("the catches ask, never assert", () => {
  it("phrases every hint as a question — every trigger's own, and the fallback", () => {
    const asserted = SURFACE_EN.catches
      .flatMap((c) => [
        ...c.triggers.flatMap((t) => t.hints.map((h) => ({ type: c.type, h }))),
        ...c.fallbackHints.map((h) => ({ type: c.type, h })),
      ])
      .filter(({ h }) => !h.trim().endsWith("?"))
      .map(({ type, h }) => `${type}: ${h}`);
    expect(asserted).toEqual([]);
  });

  it("never tells the person they are wrong", () => {
    const catchCopy = SURFACE_EN.catches
      .map((c) => c.line)
      .concat([SURFACE_EN.catchCopy.note, SURFACE_EN.catchCopy.dismiss]);
    const corrective = catchCopy.filter((s) =>
      /\b(wrong|incorrect|mistake|should(n't)? (be|say|feel)|actually,? that)\b/i.test(s)
    );
    expect(corrective).toEqual([]);
  });

  it("always offers a way to decline", () => {
    expect(SURFACE_EN.catchCopy.dismiss.trim()).not.toBe("");
  });

  it("the note states their own material plainly, without counselling register", () => {
    // Phase-2 review defect: "reflected back" is counselling register and
    // inaccurate — the catch contrasts, it doesn't reflect.
    expect(SURFACE_EN.catchCopy.note).not.toMatch(/reflect(ed|s|ion)?/i);
  });

  it("the protective catch does not argue — it routes instead of countering", () => {
    const protective = SURFACE_EN.catches.find((c) => c.type === "protective")!;
    expect(protective.triggers.every((t) => t.hints.length === 0)).toBe(true);
    expect(protective.fallbackHints).toEqual([]);
    expect(protective.routeTo).toBeTruthy();
    expect(protective.line).not.toMatch(/\b(no|instead you should|that's not true)\b/i);
  });

  it("the strategy catch's hints are sharp to the trigger, not one generic set", () => {
    const strategy = SURFACE_EN.catches.find((c) => c.type === "strategy")!;
    const aRide = strategy.triggers.find((t) => t.match === "a ride")!;
    const aLawyer = strategy.triggers.find((t) => t.match === "a lawyer")!;
    // Not a blanket "no two triggers may ever share a hint" (some overlap
    // between genuinely similar acts is fine) — this pins the specific case
    // the review called out: offering the same three hints under every
    // trigger regardless of what was actually typed.
    expect(new Set(strategy.triggers.map((t) => t.hints.join("|"))).size).toBeGreaterThan(1);
    expect(aRide.hints).not.toEqual(aLawyer.hints);
  });
});

describe("beat 2's correction is keyed on the guess, not a standing statistic", () => {
  const optionIds = frame.beatTwo.options.map((o) => o.id);

  it("supplies a line for every option the person can actually pick", () => {
    for (const id of optionIds) {
      expect(frame.beatTwo.correction.lineByGuess[id]?.trim()).toBeTruthy();
    }
  });

  it("never tells the very-guesser they were wrong about the one thing they got right", () => {
    // The phase-2 review defect, pinned directly: whoever picked `very` must
    // not be told people guess low, and must not be told they were simply
    // right — the finding confirms them, it doesn't award them.
    const veryLine = frame.beatTwo.correction.lineByGuess.very;
    expect(veryLine).not.toMatch(/\bguess(es)? (this )?low\b/i);
    expect(veryLine).not.toMatch(/\byou('re| were) right\b/i);
  });

  it("keeps the finding itself constant regardless of the guess", () => {
    // The body is the research and doesn't change; only the framing does.
    expect(frame.beatTwo.correction.body.trim()).toBeTruthy();
  });
});

describe("keeps moving — no rumination prompts", () => {
  it("never asks why", () => {
    expect(offendingEN(/\bwhy\b/i)).toEqual([]);
  });

  it("never asks the person to analyse or explain themselves", () => {
    expect(offendingEN(/\b(analy[sz]e|figure out|work out what caused|explain why|unpack)\b/i)).toEqual([]);
  });

  it("the repeat stays parallel — says outright that connecting them comes later", () => {
    expect(loop.recapNotRelated).toMatch(/\blater\b/i);
  });
});

describe("the scale floor holds", () => {
  it("the place palette never offers anything larger than a place you were", () => {
    // No option resembling a group, a city, or an aggregate — the scale
    // floor spec §4.2 puts the loop's whole design weight on.
    const offenders = SURFACE_EN.places.filter((p) =>
      /\b(everyone|the city|the world|society|community|people in general)\b/i.test(p.label)
    );
    expect(offenders).toEqual([]);
  });

  it("the person prompt asks for one person, never a category", () => {
    expect(loop.personPrompt).not.toMatch(/\b(everyone|people|group|team)\b/i);
  });
});

// ─── The same six, in Persian ─────────────────────────────────────────────────

/**
 * Every guardrail again, against the Persian surface — restated with the
 * Persian evidence rather than shared regexes, per the same reasoning as
 * `feelingsNeedsGuardrails.unit.test.ts`'s Persian block. Where a guardrail
 * cannot be checked lexically without guessing at phrasing, it is checked
 * structurally instead.
 */
describe("the guardrails in Persian", () => {
  const faPack = buildNoticingPack("fa");
  const faLoop = SURFACE_FA.loop;
  const faFrame = SURFACE_FA.frame;
  const faStrings = allStrings(SURFACE_FA);
  const faOffending = (re: RegExp, only?: (path: string) => boolean) =>
    faStrings
      .filter(([p, v]) => !isTriggerPath(p) && (only ? only(p) : true) && re.test(v))
      .map(([p, v]) => `${p}: ${v}`);

  it("never says help/کمک where the app is describing the loop's own offer", () => {
    // «کمک» is used once, deliberately, in the day-one recall prompt (the
    // same exemption as English — recalling being helped, not an
    // instruction). It must not appear in the loop's own offer step.
    expect(faLoop.smallThingPrompt).not.toMatch(/کمک/);
    expect(faFrame.beatOne.moment.prompt).toMatch(/کمک/);
  });

  it("never states the lesson — the turn reports, the graduation names a capability", () => {
    // «یعنی» means, «ثابت می‌کند» proves, «همیشه» always (as a sweeping claim).
    expect(faFrame.beatOne.turn.line).not.toMatch(/یعنی|ثابت می‌کند/);
    expect(faFrame.beatOne.turn.wishedLine).not.toMatch(/یعنی|ثابت می‌کند/);
    const g = [faPack.graduation.line, faPack.graduation.body, faPack.graduation.close].join(" ");
    expect(g).not.toMatch(/ثابت می‌کند|درسش|یاد گرفتی/);
  });

  it("the reroute doesn't presuppose help arrived — «آرزو» (wish), never a claim it happened", () => {
    expect(faFrame.beatOne.moment.wishedPrompt).toMatch(/آرزو/);
    // «کمک کرد» helped (as a completed act) and «متوجه شد» realized/understood
    // (as something someone else actually did) would both claim the
    // connection was made — the reroute's own line must not.
    expect(faFrame.beatOne.turn.wishedLine).not.toMatch(/کمک کرد|متوجه شد/);
    expect(faFrame.beatOne.turn.wishedLine.trim()).not.toBe("");
  });

  it("counts nothing — no streak language, and no digit in the graduation copy", () => {
    // «پشت سر هم» in a row, «امتیاز» points, «رکورد» record, «بدهکار» indebted.
    expect(faOffending(/پشت سر هم|امتیاز|رکورد|مدال|بدهکار|عقب افتاد/)).toEqual([]);
    const g = [faPack.graduation.line, faPack.graduation.body, faPack.graduation.close].join(" ");
    expect(g).not.toMatch(/[0-9۰-۹]/);
    expect(g).not.toMatch(/تبریک|جایزه|دستاورد/);
  });

  it("the other person stays a person — no 'پرونده' (case file) or 'هدف' (target) framing", () => {
    expect(faOffending(/پرونده|هدف‌گذاری|فرصت‌طلبانه/)).toEqual([]);
  });

  it("offers, never forces — the conditional survives, every skip is named", () => {
    expect(faLoop.needPrompt).toContain("اگر");
    expect(faLoop.needPromptTerse).toContain("اگر");
    expect(faLoop.needNotSure.trim()).not.toBe("");
    expect(faLoop.smallThingSkip.trim()).not.toBe("");
    // «باید انجام» must-do, «الزامی» mandatory, «حتماً باید» absolutely must.
    expect(faOffending(/باید انجام دهی|الزامی|حتماً باید/)).toEqual([]);
  });

  it("the catches ask, never assert — declinable, and never says you are wrong", () => {
    expect(SURFACE_FA.catchCopy.dismiss.trim()).not.toBe("");
    const catchCopy = SURFACE_FA.catches
      .map((c) => c.line)
      .concat([SURFACE_FA.catchCopy.note, SURFACE_FA.catchCopy.dismiss])
      .join(" ");
    // «غلط» / «اشتباه» wrong, «نباید» you shouldn't, «درست نیست» that's not right.
    expect(catchCopy).not.toMatch(/غلط|اشتباه|نباید|درست نیست/);
    const protective = SURFACE_FA.catches.find((c) => c.type === "protective")!;
    expect(protective.triggers.every((t) => t.hints.length === 0)).toBe(true);
    expect(protective.routeTo).toBeTruthy();
  });

  it("keeps the welcome-prediction correction keyed on the guess, not one line for everyone", () => {
    // The same defect, checked in Persian: the very-guesser must not be told
    // people guess low.
    for (const id of ["not_very", "somewhat", "very"] as const) {
      expect(faFrame.beatTwo.correction.lineByGuess[id]?.trim()).toBeTruthy();
    }
  });

  it("keeps moving — never asks why or for an explanation", () => {
    expect(faOffending(/چرا/)).toEqual([]);
    // «تحلیل» analyse, «بررسی کن» examine it, «دلیلش» its reason.
    expect(faOffending(/تحلیل|بررسی کن|دلیلش|ریشه‌اش/)).toEqual([]);
    expect(faLoop.recapNotRelated).toMatch(/بعداً/);
  });

  it("the place palette and person prompt hold the scale floor", () => {
    // «همه» everyone, «جامعه» society, «مردم» people (in the aggregate sense).
    const placesText = SURFACE_FA.places.map((p) => p.label).join(" ");
    expect(placesText).not.toMatch(/همه|جامعه|دنیا/);
    expect(faLoop.personPrompt).not.toMatch(/همه|گروه|تیم/);
  });
});
