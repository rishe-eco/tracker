/**
 * Noticing `v1` — the locale-invariant spec.
 *
 * Palette ids and catch-type structure only; the words live in
 * `surface.<locale>.ts`. See `../types.ts` for why the split exists.
 */

import type { CatchLexiconSpec, NoticingSpec, PaletteEntrySpec } from "../types";

export const CONTENT_VERSION = "noticing/v1";

/**
 * The place palette (spec §4.2, §6 `placePalette`). Five plus the `other →
 * type it` escape. Deliberately no option larger than a place you physically
 * were — the scale floor lives here.
 */
export const PLACE_SPECS: PaletteEntrySpec[] = [
  { id: "home" },
  { id: "commute" },
  { id: "work" },
  { id: "shop_or_street" },
  { id: "someones_house" },
];

/**
 * The observable-cue chips (spec §8.3b) — beat-1 step 3's one-time palette,
 * the frame's only new palette. What a person had to go on, seeing someone
 * else from the outside.
 */
export const CUE_SPECS: PaletteEntrySpec[] = [
  { id: "face" },
  { id: "went_quiet" },
  { id: "stayed_late" },
  { id: "how_i_stood" },
  { id: "said_in_passing" },
  { id: "kept_checking_the_time" },
];

/**
 * The needs palette — Noticing's own (build plan §4), authored for reading a
 * need FROM OUTSIDE rather than naming one from the inside. Wider than Module
 * 1's twelve, across three directions the inside-facing set has no reason to
 * cover, plus the ids Noticing shares in meaning with Module 1 — carrying
 * Module 1's id is the authoring rule that keeps two independent palettes
 * from coining two words for one need (asserted in the phase-2 content
 * suite, which imports Module 1's `NEED_IDS` read-only).
 *
 * Pool of 20; the on-screen selection (`DIALS.needs.displayCount`) is a
 * service-layer concern (phase 3), not a content one, and is NOT narrowed by
 * the chosen place (build plan §4 — pruning the answer is worse than
 * pre-seeding the question).
 *
 * Phase-1 review (coordinator, 2026-09-20) restored `to_matter` — one of the
 * most legible-from-outside needs there is (being talked over, being the one
 * nobody asks) — and cut `privacy` for overlapping `to_be_left_alone` in the
 * one category where precision matters most. `to_be_left_alone` (a state
 * they want) and `nothing_right_now` (a response to *you*, specifically) are
 * kept as the two genuinely different invite-no-offer needs.
 */
export const NEED_SPECS: PaletteEntrySpec[] = [
  // ── Shared with Module 1 — same meaning, same id ──────────────────────────
  { id: "rest" },
  { id: "connection" },
  { id: "to_matter" },
  { id: "safety" },
  { id: "space" },
  { id: "ease" },
  { id: "to_be_seen" },
  { id: "understanding" },
  { id: "support" },
  { id: "respect" },
  { id: "autonomy" },

  // ── Practical and physical — legible from outside, no inside counterpart ──
  { id: "warmth" },
  { id: "food" },
  { id: "a_seat" },
  { id: "a_hand" },

  // ── Informational — visible as confusion, asking twice, standing in the
  //    wrong queue ────────────────────────────────────────────────────────────
  { id: "to_know_whats_going_on" },
  { id: "to_know_its_not_just_them" },
  { id: "direction" },

  // ── Needs that invite no offer — the category Module 1 had no reason to
  //    carry (you do not offer yourself a hand). Without these the palette
  //    itself argues for intervention (build plan §4, spec §5 savior framing).
  //    Two, not three — see the note above on `privacy`.
  { id: "to_be_left_alone" },
  { id: "nothing_right_now" },
];

/**
 * The ids Noticing shares in meaning with Module 1's twelve — the authoring
 * rule from build plan §4: where both palettes mean the same need, they
 * carry the same id, so two independent content versions never coin two
 * words for one need. Checked against `content/feelings-needs/v1/spec`'s
 * `NEED_IDS` in the phase-2 content suite (read-only import — an assertion
 * about authoring, not a runtime dependency).
 */
export const SHARED_WITH_MODULE1_NEED_IDS = [
  "rest",
  "connection",
  "to_matter",
  "safety",
  "space",
  "ease",
  "to_be_seen",
  "understanding",
  "support",
  "respect",
  "autonomy",
];

/**
 * The three Tier 3 catches (spec §4.4, build plan §8) — one authored lexicon
 * per type, not families of concepts like Module 1's faux-feelings.
 * `hintSlots` is 0 for `protective`, which routes to the Reflect handoff
 * instead of offering an answer (spec §4.4, N6-c). `matchesFields` is the
 * field contract (build plan §8): the only fields the phase-5 matcher may
 * read this catch type against. `"person"` must never appear in any of them.
 */
export const CATCH_SPECS: CatchLexiconSpec[] = [
  { type: "read", hintSlots: 0, matchesFields: ["observation"] },
  { type: "strategy", hintSlots: 3, matchesFields: ["need", "smallThing"] },
  { type: "protective", hintSlots: 0, matchesFields: ["smallThing", "motiveNote"] },
];

export const SPEC: NoticingSpec = {
  contentVersion: CONTENT_VERSION,
  places: PLACE_SPECS,
  cues: CUE_SPECS,
  needs: NEED_SPECS,
  catches: CATCH_SPECS,
};

/** All palette ids, for the parity validator and quick membership checks. */
export const PLACE_IDS = PLACE_SPECS.map((p) => p.id);
export const CUE_IDS = CUE_SPECS.map((c) => c.id);
export const NEED_IDS = NEED_SPECS.map((n) => n.id);
export const CATCH_TYPE_IDS = CATCH_SPECS.map((c) => c.type);
