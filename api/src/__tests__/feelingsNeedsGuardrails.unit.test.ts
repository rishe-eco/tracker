/**
 * The guardrails, as tests.
 *
 * Plan §10 lists eight of these and is explicit that they are "pass/fail for the
 * demo, not nice-to-haves". They are also the easiest thing in the build to lose
 * by accident: every one of them is a property of *copy*, and copy gets edited
 * by people who are thinking about how a sentence reads rather than which
 * mechanism it was protecting.
 *
 * So they live here instead of in a review checklist. Each test names the
 * guardrail and the failure it prevents, and each is written against the
 * authored pack rather than the intent — the question is always what the person
 * will actually meet on screen.
 *
 * **Two locales, one set of guardrails, two kinds of check.** A guardrail like
 * "the breath promises no duration" is structural and holds in any language. One
 * like "never asks why" is enforced by looking for a word, and the word is
 * different in Persian — so the sweeps below are English, and the Persian block
 * at the bottom restates each guardrail with the evidence that applies to it.
 * Sharing a regex between the two would mean a green suite that had checked one
 * language twice.
 */

import { describe, expect, it } from "vitest";
import { DIALS } from "../content/feelings-needs/dials";
import { buildFeelingsNeedsPack } from "../content/feelings-needs/v1";
import { SURFACE_EN } from "../content/feelings-needs/v1/surface.en";
import { SURFACE_FA } from "../content/feelings-needs/v1/surface.fa";

const pack = buildFeelingsNeedsPack("en");
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

const STRINGS = allStrings(SURFACE_EN);
const offending = (re: RegExp, only?: (path: string) => boolean) =>
  STRINGS.filter(([p, v]) => (only ? only(p) : true) && re.test(v)).map(([p, v]) => `${p}: ${v}`);

describe("the loop keeps moving", () => {
  it("never asks why", () => {
    // "Why am I like this" is the rumination the loop is structurally designed
    // to route around — the whole reason P2 puts the body before the words.
    // A single "why" prompt would undo that.
    expect(offending(/\bwhy\b/i)).toEqual([]);
  });

  it("does not invite the person to analyse or explain themselves", () => {
    expect(offending(/\b(analy[sz]e|figure out|work out what caused|explain why|unpack)\b/i)).toEqual(
      []
    );
  });
});

describe("don't oversell vocabulary", () => {
  it("keeps the on-screen palette small", () => {
    // Granularity is built in context; it is not word-count. A wall of words
    // becomes a menu to browse, which breaks the keep-moving loop.
    expect(DIALS.palette.feelingDisplayCount).toBeLessThanOrEqual(8);
    expect(DIALS.palette.textureDisplayCount).toBeLessThanOrEqual(8);
    expect(DIALS.palette.locationDisplayCount).toBeLessThanOrEqual(8);
    expect(DIALS.palette.needDisplayCount).toBeLessThanOrEqual(8);
  });

  it("never congratulates the person on a word or frames the palette as a lesson", () => {
    expect(offending(/\b(vocabulary|well done|good job|nice work|correct word|right word)\b/i)).toEqual(
      []
    );
  });
});

describe("catch, don't quiz", () => {
  it("always offers a way to decline", () => {
    // A catch you cannot decline is a quiz, and a quiz produces defensiveness
    // instead of looking — the contrast then lands nowhere.
    expect(SURFACE_EN.catch.dismiss.trim()).not.toBe("");
  });

  it("phrases every hint as a question, never an assertion", () => {
    const asserted = SURFACE_EN.lexicon.flatMap((c) =>
      [...c.feelingHints, ...c.needHints].filter((h) => !h.trim().endsWith("?")).map((h) => `${c.id}: ${h}`)
    );
    expect(asserted).toEqual([]);
  });

  it("never tells the person they are wrong", () => {
    const catchCopy = [
      ...SURFACE_EN.lexiconCategories.map((c) => c.catchTemplate),
      SURFACE_EN.catch.genericTemplate,
      SURFACE_EN.catch.note,
      SURFACE_EN.catch.dismiss,
    ];
    const corrective = catchCopy.filter((s) =>
      /\b(wrong|incorrect|mistake|should(n't)? (be|say|feel)|actually,? that)\b/i.test(s)
    );
    expect(corrective).toEqual([]);
  });
});

describe("offer, never force", () => {
  it("keeps the need conditional, in both the full and the withdrawn prompt", () => {
    // The "if" is the guardrail, not scaffolding — a need the person recites
    // instead of recognizes is worse than no need at all. It has to survive the
    // fade (P7).
    expect(loop.needPrompt).toMatch(/\bif\b/i);
    expect(loop.needPromptTerse).toMatch(/\bif\b/i);
  });

  it("names a skip in plain words for every optional step", () => {
    expect(loop.needSkip.trim()).not.toBe("");
    expect(loop.smallStepSkip.trim()).not.toBe("");
    expect(loop.breatheSkip.trim()).not.toBe("");
  });

  it("never demands, only invites", () => {
    const demanding = offending(/\b(you must|you need to|required|mandatory|complete this)\b/i);
    expect(demanding).toEqual([]);
  });
});

describe("no streaks", () => {
  it("has no streak or scoring language anywhere in the pack", () => {
    // Note "points" is deliberately not a bare term here: the need prompt says
    // "if it points at something you care about", which is the verb and exactly
    // the phrasing P4 wants. Match the gamified senses instead.
    expect(
      offending(
        /\b(streak|in a row|keep it up|don't break|scores?|badges?|level up|earn points|\d+ points)\b/i
      )
    ).toEqual([]);
  });

  it("frames graduation as a capability rather than an achievement", () => {
    // Detect, don't count. A door you have walked through cannot be lost, which
    // is what sidesteps the streak-cliff a counter would create.
    const g = [pack.graduation.line, pack.graduation.body, pack.graduation.close].join(" ");
    expect(g).not.toMatch(/\b(congratulations|achievement|unlocked|earned|milestone|\d+)\b/i);
  });
});

describe("felt, not told", () => {
  it("never states the lesson the Day-1 frame exists to produce", () => {
    // P1's first failure mode: asserting malleability instead of eliciting it
    // reads as a motivational slogan and can backfire. The payoff must report
    // what happened and leave the realization to the reader.
    const payoff = [frame.payoff.line, frame.payoff.body, frame.payoff.close].join(" ");
    expect(payoff).not.toMatch(
      /\b(emotions? (are|can be)|feelings? (are|can be)|you can (control|change|manage)|this (shows|proves|means that)|the lesson)\b/i
    );
  });

  it("steers the first attempt somewhere a word can actually land", () => {
    // P1's second failure mode: an early attempt that lands nothing teaches
    // that feelings are opaque and fixed — the opposite of the install.
    expect(frame.recall.helper).toMatch(/\b(ordinary|small|not the (heaviest|hardest|biggest))\b/i);
  });
});

describe("the repeat stays parallel", () => {
  it("says outright that connecting them comes later", () => {
    expect(loop.recapNotRelated).toMatch(/\b(later|comes later)\b/i);
  });

  it("never asks how the feelings relate", () => {
    // Relating, ranking or connecting is storytelling (P6, tier 4) and is
    // deferred. Letting it in here would smuggle a whole tier into the demo.
    expect(
      offending(/\b(how (do|does) (they|these)|relate|connect(ed|ion between)|rank|which matters most|compare)\b/i,
        (p) => p.startsWith("loop.")
      ).filter((s) => !s.includes("recapNotRelated"))
    ).toEqual([]);
  });

  it("bounds the repeat and closes it warmly rather than as a rule", () => {
    expect(DIALS.repeat.softCap).toBeLessThanOrEqual(4);
    // Announcing a limit invites the completionism the cap exists to prevent.
    expect(loop.addAnotherCapped).not.toMatch(/\b(limit|maximum|max|cannot|not allowed|only \d)\b/i);
  });
});

describe("the breath settles, it doesn't lengthen", () => {
  it("promises no duration and nothing to complete", () => {
    const breath = [loop.breathePrompt, loop.breatheHint, loop.breatheSkip]
      .filter(Boolean)
      .join(" ");
    expect(breath).not.toMatch(/\b(\d+\s*(seconds?|minutes?)|timer|countdown|hold (for|it)|inhale for)\b/i);
  });

  it("stays skippable", () => {
    expect(DIALS.breath.skippable).toBe(true);
  });
});

// ─── The same eight, in Persian ───────────────────────────────────────────────

/**
 * Every guardrail again, against the Persian surface.
 *
 * Split by what kind of evidence each one needs: the structural checks are the
 * same assertion (a skip exists; no digit appears), the lexical ones are the
 * Persian words for the things the English sweeps look for. Where a guardrail
 * cannot be checked lexically in Persian without guessing at phrasing, it is
 * checked structurally or not at all rather than checked badly — a test that
 * passes because its regex never matches anything is worse than no test.
 */
describe("the guardrails in Persian", () => {
  const faPack = buildFeelingsNeedsPack("fa");
  const faLoop = SURFACE_FA.loop;
  const faFrame = SURFACE_FA.frame;
  const faStrings = allStrings(SURFACE_FA);
  const faOffending = (re: RegExp, only?: (path: string) => boolean) =>
    faStrings.filter(([p, v]) => (only ? only(p) : true) && re.test(v)).map(([p, v]) => `${p}: ${v}`);

  it("keeps moving — never asks why, and never asks for an explanation", () => {
    expect(faOffending(/چرا/)).toEqual([]);
    // «تحلیل» analyse, «بررسی» examine, «دلیلش» its reason, «ریشه‌اش» its root.
    expect(faOffending(/تحلیل|بررسی کن|دلیلش|ریشه‌اش/)).toEqual([]);
  });

  it("doesn't oversell vocabulary — no praise, no lesson framing", () => {
    // «آفرین» well done, «عالی بود» excellent, «واژگان» vocabulary,
    // «کلمهٔ درست» the correct word, «درس» lesson, «یاد گرفتی» you learned.
    //
    // `catch.dismiss` is exempt, and the exemption is the point rather than a
    // convenience: «همان کلمه درست است» is the app conceding that the person's
    // own word stands. Calling a word right when *declining* to correct it is
    // the opposite of grading vocabulary — and the wave-off has to be able to
    // say so plainly, or it stops being a real way out (P5).
    expect(
      faOffending(/آفرین|عالی بود|واژگان|کلمهٔ درست|کلمه درست|درسِ|یاد گرفتی/,
        (p) => p !== "catch.dismiss"
      )
    ).toEqual([]);
  });

  it("catches without quizzing — declinable, and never says you are wrong", () => {
    expect(SURFACE_FA.catch.dismiss.trim()).not.toBe("");
    const catchCopy = [
      ...SURFACE_FA.lexiconCategories.map((c) => c.catchTemplate),
      SURFACE_FA.catch.genericTemplate,
      SURFACE_FA.catch.note,
      SURFACE_FA.catch.dismiss,
    ].join(" ");
    // «غلط» / «اشتباه» wrong, «نباید» you shouldn't, «درست نیست» that's not right.
    expect(catchCopy).not.toMatch(/غلط|اشتباه|نباید|درست نیست/);
  });

  it("offers, never forces — the conditional survives, every skip is named", () => {
    expect(faLoop.needPrompt).toContain("اگر");
    expect(faLoop.needPromptTerse).toContain("اگر");
    expect(faLoop.needSkip.trim()).not.toBe("");
    expect(faLoop.smallStepSkip.trim()).not.toBe("");
    expect(faLoop.breatheSkip.trim()).not.toBe("");
    // «باید» must, «الزامی» required, «حتماً» definitely/without fail.
    expect(faOffending(/باید انجام|الزامی|حتماً باید/)).toEqual([]);
  });

  it("counts nothing — no streaks, and no number in the graduation copy", () => {
    // «پشت سر هم» in a row, «امتیاز» points, «رکورد» record, «نشان» badge,
    // «ادامه بده» is fine (it is the graduation's close), «از دست دادن» losing it.
    expect(faOffending(/پشت سر هم|امتیاز|رکورد|مدال|نشانِ|روز متوالی/)).toEqual([]);
    const g = [faPack.graduation.line, faPack.graduation.body, faPack.graduation.close].join(" ");
    // Structural, so it holds regardless of phrasing: a capability has no count,
    // in Persian or ASCII digits.
    expect(g).not.toMatch(/[0-9\u06F0-\u06F9]/);
    expect(g).not.toMatch(/تبریک|جایزه|دستاورد/);
  });

  it("felt, not told — the payoff reports and does not conclude", () => {
    const payoff = [faFrame.payoff.line, faFrame.payoff.body, faFrame.payoff.close].join(" ");
    // «یعنی» means, «نشان می‌دهد» shows, «ثابت می‌کند» proves, «درسش» its lesson —
    // each one would turn the report into the assertion P1 must not make.
    expect(payoff).not.toMatch(/یعنی|نشان می‌دهد|ثابت می‌کند|درسش|پس می‌توانی/);
  });

  it("felt, not told — steers the first attempt small enough to land", () => {
    // P1 failure mode (b), and the one place the Persian has to carry a specific
    // instruction: «معمولی» ordinary, «کوچک» small, «نه سنگین‌ترین» not the heaviest.
    expect(faFrame.recall.helper).toMatch(/معمولی|کوچک|نه سنگین‌ترین/);
  });

  it("the repeat stays parallel — later is said outright, and nothing relates them", () => {
    expect(faLoop.recapNotRelated).toMatch(/بعد/);
    // «ربط» connection, «رابطه» relationship, «مقایسه» compare, «مهم‌ترین» most
    // important — all four would pull the sitting into storytelling (P6, tier 4).
    const loopCopy = allStrings(faLoop)
      .filter(([p]) => !p.includes("recapNotRelated"))
      .map(([, v]) => v)
      .join(" ");
    expect(loopCopy).not.toMatch(/ربطشان|رابطه‌شان|مقایسه|مهم‌ترین کدام/);
  });

  it("the repeat stays parallel — the cap closes warmly, not as a rule", () => {
    // «حداکثر» maximum, «محدودیت» limit, «بیشتر نمی‌شود» no more allowed.
    expect(faLoop.addAnotherCapped).not.toMatch(/حداکثر|محدودیت|بیشتر نمی‌شود|اجازه/);
  });

  it("the breath settles — no duration promised, nothing to complete", () => {
    const breath = [faLoop.breathePrompt, faLoop.breatheHint, faLoop.breatheSkip]
      .filter(Boolean)
      .join(" ");
    // Digits in either numeral system, and the words that would turn a threshold
    // into a timer: «ثانیه» second, «دقیقه» minute, «نگه دار» hold, «بشمار» count.
    expect(breath).not.toMatch(/[0-9\u06F0-\u06F9]/);
    expect(breath).not.toMatch(/ثانیه|دقیقه|نگه دار|بشمار|تایمر/);
  });
});
