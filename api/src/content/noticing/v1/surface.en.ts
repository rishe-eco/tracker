/**
 * Noticing `v1` — the English surface.
 *
 * // PHASE 2: every string in this file is placeholder copy — short, plain,
 * obviously provisional. It exists so the pack builds and the plumbing
 * (query, pages, i18n) can be exercised end to end in phase 1. Phase 2
 * authors the real words against spec §8, guarded by the content and
 * guardrail suites (build plan §9.1, §9.2). Do not treat any string below as
 * reviewed copy — none of it has been checked against the failure-mode table
 * in spec §5.
 */

import type {
  CapacityCopySurface,
  CatchCopySurface,
  CatchLexiconSurface,
  FrameSurface,
  GraduationSurface,
  LoopCopySurface,
  NoticingSurface,
  PaletteEntrySurface,
} from "../types";

// ─── Palettes ────────────────────────────────────────────────────────────────

const PLACES_EN: PaletteEntrySurface[] = [
  { id: "home", label: "home" },
  { id: "commute", label: "a commute" },
  { id: "work", label: "work" },
  { id: "shop_or_street", label: "a shop or street" },
  { id: "someones_house", label: "someone's house" },
];

const CUES_EN: PaletteEntrySurface[] = [
  { id: "face", label: "their face" },
  { id: "went_quiet", label: "that they'd gone quiet" },
  { id: "stayed_late", label: "that they were still there late" },
  { id: "how_i_stood", label: "how they were standing" },
  { id: "said_in_passing", label: "something they said in passing" },
  { id: "kept_checking_the_time", label: "that they kept checking the time" },
];

const NEEDS_EN: PaletteEntrySurface[] = [
  { id: "rest", label: "rest" },
  { id: "connection", label: "connection" },
  { id: "safety", label: "safety" },
  { id: "space", label: "space" },
  { id: "ease", label: "ease" },
  { id: "to_be_seen", label: "to be seen" },
  { id: "understanding", label: "understanding" },
  { id: "support", label: "support" },
  { id: "respect", label: "respect" },
  { id: "autonomy", label: "autonomy" },
  { id: "warmth", label: "warmth" },
  { id: "food", label: "food" },
  { id: "a_seat", label: "a seat" },
  { id: "a_hand", label: "a hand" },
  { id: "to_know_whats_going_on", label: "to know what's going on" },
  { id: "to_know_its_not_just_them", label: "to know it isn't just them" },
  { id: "direction", label: "direction" },
  { id: "to_be_left_alone", label: "to be left alone" },
  { id: "nothing_right_now", label: "nothing from anyone right now" },
  { id: "privacy", label: "privacy" },
];

// ─── Day-one frame — placeholder script ──────────────────────────────────────

const FRAME_EN: FrameSurface = {
  intro: {
    title: "Before the daily practice — one thing to try",
    body: "[placeholder] A short warm-up: a moment someone read you right, and what you'd have missed if they hadn't.",
    begin: "Start",
  },
  beatOne: {
    moment: {
      prompt: "Think of a time someone helped you without being asked. What happened?",
      reroutePrompt: "Can't think of one?",
      rerouteLabel: "a time you wished someone had",
    },
    unsaidNeed: {
      prompt: "What were you needing, that you weren't saying out loud?",
      otherLabel: "other — type it",
    },
    visibleCues: {
      prompt: "They couldn't hear that. So what could they actually see?",
      otherLabel: "something else — type it",
    },
    turn: {
      line: "[placeholder] They got from one to the other without you saying anything.",
    },
    reverse: {
      prompt: "Yesterday — how was the person you sat nearest to?",
      knowLabel: "I know",
      noIdeaLabel: "no idea",
      noIdeaResponse: "[placeholder] That's ordinary. You weren't looking — yet.",
    },
  },
  beatTwo: {
    prompt: "If you offered someone a small hand today, how glad would they be?",
    options: [
      { id: "not_very", label: "not very" },
      { id: "somewhat", label: "somewhat" },
      { id: "very", label: "very" },
    ],
    correction: {
      line: "[placeholder] People underestimate this.",
      body: "[placeholder] Helpers overestimate the inconvenience and underestimate how glad the other person will be.",
    },
  },
};

// ─── The noticing loop — placeholder script ──────────────────────────────────

const LOOP_EN: LoopCopySurface = {
  placePrompt: "Where were you today?",
  placeOtherLabel: "somewhere else — type it",
  personPrompt: "Who was there?",
  personThirdPartyWarning: "You're writing about someone else. Write as if they could read it.",
  observationPrompt: "What did you actually see or hear?",
  needPrompt: "If that points at something they care about — what?",
  needOtherLabel: "other — type it",
  needNotSure: "not sure — that's fine",
  smallThingPrompt: "Anything small you want to offer or ask?",
  smallThingSkip: "skip — noticing is enough",
  capacityPrompt: "What did you have that made that possible?",
  capacityOtherLabel: "something else — type it",
  close: "noticed.",
  addAnotherAsk: "see someone else today?",
  addAnotherCapped: "[placeholder] That's a good stopping point for today.",
  finish: "done for now",
  recapHeading: "what you noticed today",
  recapNotRelated: "[placeholder] Each of these stands on its own.",
};

// ─── Tier 3 catches — placeholder lexicons ────────────────────────────────────
//
// // PHASE 2 authors the real trigger lists (spec §8.5) and their response
// copy. These placeholders exist only so the pack shape and the field
// contract (build plan §8) can be typechecked and unit-tested before the
// matcher itself lands in phase 5.

const CATCHES_EN: CatchLexiconSurface[] = [
  {
    type: "read",
    triggers: ["rude", "difficult", "lazy"],
    line: "[placeholder] That's your read on it. What did you actually see?",
    hints: [],
  },
  {
    type: "strategy",
    triggers: ["a ride", "money", "a job"],
    line: "[placeholder] That's one way to meet it. What's underneath?",
    hints: ["rest", "support", "safety"],
  },
  {
    type: "protective",
    triggers: ["should", "have to", "ought"],
    line: "[placeholder] Worth a look before this becomes a plan.",
    hints: [],
    routeTo: "reflect",
  },
];

const CATCH_COPY_EN: CatchCopySurface = {
  dismiss: "not now",
  note: "[placeholder] Just your own words, reflected back.",
};

// ─── Capacity portrait — placeholder chips ───────────────────────────────────

const CAPACITY_EN: CapacityCopySurface = {
  prompt: "What did you have that made that possible?",
  chips: {
    head: [
      { id: "a_free_minute", label: "a free minute" },
      { id: "knew_what_to_say", label: "knew what to say" },
    ],
    hands: [
      { id: "free_hands", label: "free hands" },
      { id: "was_already_going_that_way", label: "was already going that way" },
    ],
    heart: [
      { id: "felt_steady", label: "felt steady" },
      { id: "wanted_to", label: "wanted to" },
    ],
  },
  otherLabel: "something else — type it",
};

const GRADUATION_EN: GraduationSurface = {
  line: "You've been looking on your own lately.",
  body: "[placeholder] That's the whole thing.",
  close: "keep going",
};

export const SURFACE_EN: NoticingSurface = {
  // English is the authored language, not a translation — "reviewed" here
  // follows the Feelings & Needs convention (that field tracks translation
  // review, not copy quality). The placeholder status of this phase-1 copy is
  // the docblock's job, not this field's.
  reviewStatus: "reviewed",
  places: PLACES_EN,
  cues: CUES_EN,
  needs: NEEDS_EN,
  frame: FRAME_EN,
  loop: LOOP_EN,
  catches: CATCHES_EN,
  catchCopy: CATCH_COPY_EN,
  capacity: CAPACITY_EN,
  graduation: GRADUATION_EN,
  thirdPartyWarning: "You're writing about someone else. Write as if they could read it.",
};
