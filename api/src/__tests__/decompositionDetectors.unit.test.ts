import { describe, expect, it } from "vitest";
import { isBounded, scoreD4FreeAuthoring, scoreWholeStatement } from "../services/skills/decomposition/detectors";

describe("scoreWholeStatement (D1)", () => {
  const itemPrompt = "Move to a new apartment across town.";

  it("is level 0 when no statement is given", () => {
    const result = scoreWholeStatement({ statement: "", doneWhen: "", itemPrompt, pieceExistedFirst: false, locale: "en" });
    expect(result.level).toBe(0);
  });

  it("is level 0 when a piece was added before the whole was stated, regardless of text quality", () => {
    const result = scoreWholeStatement({
      statement: "Everything is moved and both jobs start on time.",
      doneWhen: "Last box unpacked by Friday.",
      itemPrompt,
      pieceExistedFirst: true,
      locale: "en",
    });
    expect(result.level).toBe(0);
  });

  it("is level 1 when the statement is a near-copy of the item prompt", () => {
    const result = scoreWholeStatement({
      statement: "Move to a new apartment across town",
      doneWhen: "Everything moved by Friday.",
      itemPrompt,
      pieceExistedFirst: false,
      locale: "en",
    });
    expect(result.level).toBe(1);
  });

  it("is level 1 with no done condition, or an unbounded one", () => {
    const reframed = "Everything we own is in the new place and both of us can work from day one";
    expect(scoreWholeStatement({ statement: reframed, doneWhen: "", itemPrompt, pieceExistedFirst: false, locale: "en" }).level).toBe(1);
    expect(
      scoreWholeStatement({ statement: reframed, doneWhen: "it feels done", itemPrompt, pieceExistedFirst: false, locale: "en" }).level
    ).toBe(1);
  });

  it("is level 2 with a reframed statement and a bounded done condition", () => {
    const result = scoreWholeStatement({
      statement: "Everything we own is in the new place and both of us can work from day one",
      doneWhen: "Done when the last box is unpacked by Friday.",
      itemPrompt,
      pieceExistedFirst: false,
      locale: "en",
    });
    expect(result.level).toBe(2);
  });

  it("scores a Persian statement and done condition the same way", () => {
    const faPrompt = "به یه آپارتمان دیگه تو همون شهر نقل مکان کن.";
    const result = scoreWholeStatement({
      statement: "همه‌ی وسایلمون رفته خونه‌ی جدید و از روز اول هر دومون می‌تونیم کار کنیم",
      doneWhen: "همه‌ی 4 جعبه تا جمعه جابه‌جا شد.",
      itemPrompt: faPrompt,
      pieceExistedFirst: false,
      locale: "fa",
    });
    expect(result.level).toBe(2);
  });
});

describe("isBounded (D4 half)", () => {
  it("recognises a date/weekday deadline", () => {
    expect(isBounded("by the 12th", "en")).toBe(true);
    expect(isBounded("before Friday", "en")).toBe(true);
    expect(isBounded("it feels done", "en")).toBe(false);
  });

  it("recognises a numeric bound", () => {
    expect(isBounded("all 4 boxes unpacked", "en")).toBe(true);
    expect(isBounded("make it better", "en")).toBe(false);
  });

  it("recognises a state-change verb, including a multi-word one", () => {
    expect(isBounded("the parcel is booked for pickup", "en")).toBe(true);
    expect(isBounded("keys handed back to the landlord", "en")).toBe(true);
  });

  it("does not match a state-change verb across an internal word boundary it shouldn't", () => {
    // "handed back" should match as a phrase, but a word that merely contains
    // "sent" as a substring (e.g. "consented") must not false-positive — this
    // is exactly the class of bug \b would hide/introduce.
    expect(isBounded("everyone consented to the plan", "en")).toBe(false);
  });

  it("scores Persian boundedness via the Persian lexicon, not by falling through to English", () => {
    expect(isBounded("رزرو شد", "fa")).toBe(true);
    expect(isBounded("۴ جعبه باز شد".replace("۴", "4"), "fa")).toBe(true); // Western digits only, per conventions §7d
    expect(isBounded("حس خوبیه", "fa")).toBe(false);
  });

  it("Persian word boundaries use Unicode property escapes, not \\b — the Feelings & Needs bug this guards", () => {
    // If this regressed to \b, every Persian character being a "non-word"
    // character to \b would make the lexicon match nothing, silently.
    expect(isBounded("قرارداد امضا شد", "fa")).toBe(true);
    // Ordinary Persian punctuation must not block a match ending a sentence.
    expect(isBounded("امضا شد.", "fa")).toBe(true);
  });
});

describe("scoreD4FreeAuthoring", () => {
  it("is level 2 when every leaf is bounded and nothing atomic was split", () => {
    const result = scoreD4FreeAuthoring(
      [
        { id: "a", doneWhen: "booked by Friday", splitAnAtomicPiece: false },
        { id: "b", doneWhen: "signed and returned", splitAnAtomicPiece: false },
      ],
      "en"
    );
    expect(result.level).toBe(2);
  });

  it("is level 1 with exactly one fault, level 0 with two or more", () => {
    const oneFault = scoreD4FreeAuthoring(
      [
        { id: "a", doneWhen: "booked by Friday", splitAnAtomicPiece: false },
        { id: "b", doneWhen: "make it good", splitAnAtomicPiece: false },
      ],
      "en"
    );
    expect(oneFault.level).toBe(1);

    const twoFaults = scoreD4FreeAuthoring(
      [
        { id: "a", doneWhen: "make it good", splitAnAtomicPiece: false },
        { id: "b", doneWhen: "make it better", splitAnAtomicPiece: false },
      ],
      "en"
    );
    expect(twoFaults.level).toBe(0);
  });

  it("counts a split atomic piece as its own fault alongside boundedness", () => {
    const result = scoreD4FreeAuthoring(
      [
        { id: "a", doneWhen: "booked by Friday", splitAnAtomicPiece: true },
        { id: "b", doneWhen: "signed and returned", splitAnAtomicPiece: false },
      ],
      "en"
    );
    expect(result.level).toBe(1);
  });
});
