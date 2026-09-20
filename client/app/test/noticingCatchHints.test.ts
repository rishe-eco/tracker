import { describe, expect, it } from "vitest";
import { catchHintsBlockedByExistingNeed } from "~/components/impact/NoticingLoopPage";

/**
 * Coordinator review, phase 5: `commitEntry({ need: stripQuestion(hint) },
 * followUp)` writes `need` unconditionally, which is correct when a strategy
 * catch fires on the `need` field itself (there's nothing to protect — the
 * current value IS the trigger phrase) but wrong when it fires on
 * `smallThing` while `need` already holds a separate, previously-chosen
 * answer: a hint tap would then silently overwrite that answer with a
 * suggestion about a different field. `catchHintsBlockedByExistingNeed` is
 * the guard that keeps a hint a fill, never a replace.
 */
describe("a hint may only fill need, never replace it", () => {
  it("blocks hints when a strategy catch fires on smallThing and need is already answered", () => {
    expect(catchHintsBlockedByExistingNeed("smallThing", "connection")).toBe(true);
  });

  it("allows hints when smallThing fires but need was never answered", () => {
    expect(catchHintsBlockedByExistingNeed("smallThing", null)).toBe(false);
  });

  it("allows hints when the catch fired on need itself — there is no separate answer to protect", () => {
    // need's current value IS the trigger phrase the catch just read
    // ("a ride"), not a prior answer a hint would be clobbering.
    expect(catchHintsBlockedByExistingNeed("need", "a ride")).toBe(false);
  });

  it("never blocks when there is no triggering field on record", () => {
    expect(catchHintsBlockedByExistingNeed(null, "connection")).toBe(false);
    expect(catchHintsBlockedByExistingNeed("observation", "connection")).toBe(false);
  });
});
