/**
 * Noticing `v1` — the English surface (the words).
 *
 * Realizes the locale-invariant spec. Every string here is written against
 * six guardrails (spec §5, build plan §9.2), checked by
 * `noticingGuardrails.unit.test.ts`:
 *
 * - **Never say *help* where *notice* fits.** The tool trains seeing; helping
 *   is optional, downstream, and belongs to a different pillar. The one
 *   deliberate exception is the day-one frame's recall prompt (spec §4.1),
 *   which asks about a memory of *being* helped — that is the topic of
 *   recollection, not an instruction, and the guardrail test scopes around it.
 * - **Never state the lesson.** The frame's turn (step 4) and the graduation
 *   door report what happened; they do not conclude what it means. A belief
 *   that is told is a motivational poster.
 * - **Nothing is owed.** No streak, debt or thing-left-undone language. "Not
 *   sure" and every skip are closed as warmly as a completed step.
 * - **The other person is a person, not a task.** No copy frames them as a
 *   project, a case, or an opportunity.
 * - **Every optional step names its skip in plain words.**
 * - **The catches ask, never assert** — every hint ends in a question mark,
 *   nothing is corrective, and every catch says how to wave it off.
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

/**
 * Beat-1 step 3's palette — phrased in the FIRST person, deliberately.
 * Unlike the loop's `observation` field (which is about someone else), this
 * step asks what *the person recalling the memory* was showing on the
 * outside while their own unsaid need went unsaid (spec §4.1 step 3's exact
 * chip wording).
 */
const CUES_EN: PaletteEntrySurface[] = [
  { id: "face", label: "my face" },
  { id: "went_quiet", label: "that I'd gone quiet" },
  { id: "stayed_late", label: "that I was still there late" },
  { id: "how_i_stood", label: "how I was standing" },
  { id: "said_in_passing", label: "something I said in passing" },
  { id: "kept_checking_the_time", label: "that I kept checking the time" },
];

/**
 * Noticing's own needs palette (build plan §4) — see `spec.ts` for the
 * authoring rule behind which ids repeat Module 1's and which don't.
 */
const NEEDS_EN: PaletteEntrySurface[] = [
  { id: "rest", label: "rest" },
  { id: "connection", label: "connection" },
  { id: "to_matter", label: "to matter" },
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
];

// ─── Day-one frame — the script ──────────────────────────────────────────────

const FRAME_EN: FrameSurface = {
  intro: {
    title: "Before the daily loop — one thing to try first",
    body: "A short, one-time warm-up. You'll bring back a moment, then look at it from the other side — the side of the person who read you without being told.",
    begin: "Start",
  },
  beatOne: {
    // Spec §4.1 step 1's exact prompt. "helped" here is the topic of a
    // memory, not an instruction — see the file-level note on the help/notice
    // guardrail.
    moment: {
      prompt: "Think of a time someone helped you without being asked for it. What happened?",
      helper: "One ordinary moment is enough — it doesn't have to be the biggest thing you've got.",
      reroutePrompt: "Can't think of one?",
      rerouteLabel: "a time you wished someone had",
    },
    unsaidNeed: {
      prompt: "What were you needing, that you weren't saying out loud?",
      helper: "Whatever it was — even if it sounds small now.",
      otherLabel: "other — type it",
    },
    visibleCues: {
      prompt: "They couldn't hear that. So what could they actually see?",
      helper: "Pick whatever fits. More than one is fine.",
      otherLabel: "something else — type it",
    },
    // Spec §4.1 step 4's exact line — no question, a description of what
    // they just wrote, not a claim about noticing in general.
    turn: {
      line: "They got from one to the other without you saying anything. That's the whole move.",
    },
    reverse: {
      prompt: "Yesterday — how was the person you sat nearest to?",
      knowLabel: "I know",
      noIdeaLabel: "no idea",
      knowResponse: "You were looking, then.",
      // Spec §4.1 step 5's exact line.
      noIdeaResponse:
        "That's ordinary. It's not that you don't care — you weren't looking. Looking is a thing you can get better at.",
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
      line: "Most people guess this low.",
      body: "The people who study it find the opposite: others are usually gladder than you'd guess, less bothered by being asked than you'd guess — and offering usually feels better than expected, for the one who offers too.",
    },
  },
};

// ─── The noticing loop — the script ──────────────────────────────────────────

const LOOP_EN: LoopCopySurface = {
  placePrompt: "Where were you today?",
  placePromptTerse: "where?",
  placeOtherLabel: "somewhere else — type it",
  personPrompt: "Who was there?",
  personPromptTerse: "who?",
  personThirdPartyWarning: "Someone else is in this entry. Write it as if they could read it.",
  observationPrompt: "What did you actually see or hear?",
  observationPromptTerse: "what did you see?",
  needPrompt: "If that points at something they care about — what?",
  needPromptTerse: "if it points somewhere — what?",
  needOtherLabel: "other — type it",
  needNotSure: "not sure — that's fine",
  smallThingPrompt: "Anything small you want to offer or ask?",
  smallThingSkip: "skip — noticing is enough",
  capacityPrompt: "What did you have that made that possible?",
  capacityOtherLabel: "something else — type it",
  close: "✓ noticed.",
  addAnotherAsk: "see someone else today?",
  addAnotherCapped: "That's plenty for one sitting — the rest will keep.",
  finish: "done for now",
  recapHeading: "what you noticed today",
  recapNotRelated: "Each of these stands on its own — connecting them, if that ever happens, comes later.",
};

// ─── Tier 3 catches — authored lexicons ──────────────────────────────────────
//
// Word boundaries, case-insensitive, longest-match-wins (build plan §8) — the
// matcher itself is phase 5; this file is only the closed set of words and
// the response copy. `{{word}}` is substituted with whichever trigger fired
// (`renderCatch`, `../types.ts`) — every line here quotes the person's own
// word back to them, per spec §4.4's own examples.

const CATCHES_EN: CatchLexiconSurface[] = [
  {
    // N6-a — evaluative adjectives and attributed states standing in for an
    // observation (spec §4.4). Matches `observation` only.
    type: "read",
    triggers: [
      "rude",
      "difficult",
      "lazy",
      "fine",
      "ignoring me",
      "being dramatic",
      "dramatic",
      "entitled",
      "needy",
      "selfish",
      "careless",
      "incompetent",
      "cold",
      "stuck up",
      "annoying",
    ],
    line: "'{{word}}' is your read on it. What did you actually see?",
    hints: [],
  },
  {
    // N6-b — a concrete act sitting where a need belongs (spec §4.4).
    // Matches `need` and `smallThing`. The three hints are deliberately fixed
    // rather than per-trigger — a wider spread than any one strategy needs,
    // which is what keeps them an offer rather than the "right" answer.
    type: "strategy",
    triggers: [
      "a ride",
      "money",
      "a job",
      "someone to call them",
      "a loan",
      "a place to stay",
      "someone to talk to",
      "a babysitter",
      "a lawyer",
      "a favor",
    ],
    line: "{{word}} is one way to meet it. What's underneath?",
    hints: ["rest?", "support?", "safety?"],
  },
  {
    // N6-c — the VFI protective register (spec §4.4). Matches `smallThing`
    // and `motiveNote`. No hints — this one routes to the Reflect handoff
    // instead of offering an answer, and does not argue with the person.
    type: "protective",
    triggers: [
      "should",
      "have to",
      "ought to",
      "guilty",
      "bad if i don't",
      "the least i can do",
      "i owe them",
      "obligated",
      "supposed to",
    ],
    line: "'{{word}}' is worth a look before this becomes a plan.",
    hints: [],
    routeTo: "reflect",
  },
];

const CATCH_COPY_EN: CatchCopySurface = {
  dismiss: "leave it — that's what I meant",
  note: "your words, reflected back.",
};

// ─── Capacity portrait — accreted, never shown as who was helped ────────────

const CAPACITY_EN: CapacityCopySurface = {
  prompt: "What did you have that made that possible?",
  chips: {
    head: [
      { id: "a_free_minute", label: "a free minute" },
      { id: "knew_what_to_say", label: "knew what to say" },
      { id: "wasnt_rushing", label: "wasn't rushing" },
      { id: "remembered_something_useful", label: "remembered something useful" },
      { id: "had_the_headspace", label: "had the headspace" },
      { id: "felt_clear_about_it", label: "felt clear about it" },
    ],
    hands: [
      { id: "free_hands", label: "free hands" },
      { id: "was_already_heading_that_way", label: "was already heading that way" },
      { id: "had_what_was_needed", label: "had what was needed" },
      { id: "could_spare_it", label: "could spare it" },
      { id: "was_already_there", label: "was already there" },
      { id: "nothing_else_in_my_hands", label: "nothing else in my hands" },
    ],
    heart: [
      { id: "felt_steady", label: "felt steady" },
      { id: "wanted_to", label: "wanted to" },
      { id: "had_the_patience", label: "had the patience" },
      { id: "wasnt_stretched_thin", label: "wasn't stretched thin" },
      { id: "felt_warm_toward_them", label: "felt warm toward them" },
      { id: "had_some_to_spare", label: "had some to spare" },
    ],
  },
  otherLabel: "something else — type it",
};

const GRADUATION_EN: GraduationSurface = {
  // Spec §4.5's exact line and close sentence. A capability, stated once —
  // there is nothing here that could be lost, and no number appears anywhere.
  line: "You've been looking on your own lately.",
  body: "That's the whole thing. It's yours now — the prompts were only ever the scaffolding.",
  close: "Carry on whenever you want it.",
};

export const SURFACE_EN: NoticingSurface = {
  // English is the authored language, not a translation — "reviewed" here
  // follows the Feelings & Needs convention (that field tracks translation
  // review, not copy quality).
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
  thirdPartyWarning: "Someone else is in this entry. Write it as if they could read it.",
};
