/**
 * Feelings & Needs `v1` — the English surface (the words).
 *
 * Realizes the locale-invariant spec. A later Persian surface (`surface.fa.ts`)
 * is authored against the same spec, with native review — deferred, not dropped
 * (plan §7).
 *
 * Every string here is written against four guardrails (plan §10, `learn.md` §5):
 *
 * - **Keep moving.** Prompts point forward. Nothing anywhere asks "why do you
 *   think that is" — that question is the rumination the loop exists to route
 *   around.
 * - **Don't oversell vocabulary.** No copy congratulates the person on a word or
 *   frames the palette as a lesson. The words are tools, not curriculum.
 * - **Offer, never force.** Every need prompt is conditional ("if it points at
 *   something…") and every optional step names its skip in plain words.
 * - **Felt, not told.** The frame reports what happened; it never states the
 *   principle. Nothing counts, and nothing praises persistence.
 */

import type {
  CatchCopySurface,
  FeelingsNeedsSurface,
  FrameSurface,
  GraduationSurface,
  LexiconCategorySurface,
  LexiconConceptSurface,
  LoopCopySurface,
  PaletteEntrySurface,
} from "../types";

// ─── Palettes ────────────────────────────────────────────────────────────────

/**
 * `carryLabel` here is the whole prepositional phrase, because the carry
 * template is bare (`"{{place}} —"`). The preposition belongs to the word rather
 * than the sentence: seven of these take "in your", and `hard_to_place` takes
 * none at all — "in your hard to place —" is not English. Putting it in the
 * template instead is what produced that line.
 */
const LOCATIONS_EN: PaletteEntrySurface[] = [
  { id: "chest", label: "chest", carryLabel: "in your chest" },
  { id: "throat", label: "throat", carryLabel: "in your throat" },
  { id: "stomach", label: "stomach", carryLabel: "in your stomach" },
  { id: "shoulders", label: "shoulders", carryLabel: "in your shoulders" },
  { id: "jaw", label: "jaw", carryLabel: "in your jaw" },
  { id: "head", label: "head", carryLabel: "in your head" },
  { id: "all_over", label: "all over", carryLabel: "all over" },
  // Phrased as an answer, not an apology. "hard to place" is information about
  // the state; "I don't know" would frame it as a failure to comply. The carry
  // keeps that stance — it repeats the answer back without turning it into a
  // shrug ("wherever it is").
  {
    id: "hard_to_place",
    label: "hard to place",
    carryLabel: "somewhere you can't quite pin down",
  },
];

const TEXTURES_EN: PaletteEntrySurface[] = [
  { id: "tight", label: "tight" },
  { id: "heavy", label: "heavy" },
  { id: "jittery", label: "jittery" },
  { id: "warm", label: "warm" },
  { id: "buzzy", label: "buzzy" },
  { id: "hollow", label: "hollow" },
  { id: "light", label: "light" },
  { id: "tense", label: "tense" },
  { id: "knotted", label: "knotted" },
  { id: "sinking", label: "sinking" },
  { id: "cold", label: "cold" },
  { id: "fluttery", label: "fluttery" },
];

const FEELINGS_EN: PaletteEntrySurface[] = [
  { id: "at_ease", label: "at ease" },
  { id: "glad", label: "glad" },
  { id: "calm", label: "calm" },
  { id: "content", label: "content" },
  { id: "grateful", label: "grateful" },
  { id: "hopeful", label: "hopeful" },
  { id: "relieved", label: "relieved" },
  { id: "curious", label: "curious" },

  { id: "uneasy", label: "uneasy" },
  { id: "restless", label: "restless" },
  { id: "disappointed", label: "disappointed" },
  { id: "drained", label: "drained" },
  { id: "lonely", label: "lonely" },
  { id: "hurt", label: "hurt" },
  { id: "sad", label: "sad" },
  { id: "irritated", label: "irritated" },
  { id: "anxious", label: "anxious" },
  { id: "overwhelmed", label: "overwhelmed" },
  { id: "ashamed", label: "ashamed" },
  { id: "tender", label: "tender" },
];

const NEEDS_EN: PaletteEntrySurface[] = [
  { id: "rest", label: "rest" },
  { id: "connection", label: "connection" },
  { id: "to_matter", label: "to matter" },
  { id: "safety", label: "safety" },
  { id: "space", label: "space" },
  { id: "ease", label: "ease" },
  { id: "to_be_seen", label: "to be seen" },
  { id: "autonomy", label: "autonomy" },
  { id: "trust", label: "trust" },
  { id: "understanding", label: "understanding" },
  { id: "respect", label: "respect" },
  { id: "support", label: "support" },
];

// ─── Day-1 frame (P1) — felt, not told ───────────────────────────────────────

const FRAME_EN: FrameSurface = {
  intro: {
    title: "Before the daily practice — one thing to try",
    // States what will happen, not what it will prove. The claim that emotions
    // are workable is the one thing this screen must not make.
    body: "It takes a couple of minutes. You'll bring back a recent moment, find where it sits in your body, and try a word on it. That's all — there's nothing to get right.",
    begin: "Start",
  },
  recall: {
    prompt: "Bring back a moment from the last day or two when you felt a little off.",
    // Steering small is a mechanism requirement, not gentleness: the first
    // attempt has to land, and the hardest thing available is the least likely
    // to land.
    helper: "Something ordinary — a small snag, not the heaviest thing you've got. Take a second to get it back.",
    ready: "Got it",
  },
  place: {
    prompt: "Where does it sit in your body?",
    helper: "Pick whatever's closest — and if it won't pin down anywhere, that's an answer too.",
    locationIds: ["chest", "throat", "stomach", "shoulders", "jaw", "hard_to_place"],
  },
  texture: {
    prompt: "And what's it like there?",
    helper: "Not what it means — just how it feels from the inside.",
    textureIds: ["heavy", "tight", "hollow", "knotted", "light", "warm"],
  },
  name: {
    prompt: "Now try a word on it.",
    helper: "Not the perfect one — just hold each against what you noticed and see which fits best.",
    feelingIds: ["uneasy", "drained", "disappointed", "restless", "irritated", "sad"],
  },
  payoff: {
    // Reports; does not conclude. The realization is the reader's to have.
    line: "Nothing about the situation changed.",
    body: "It's the same moment it was two minutes ago. But it's got a shape now, and a word — and that's usually enough to do something with.",
    close: "That's the whole move. The daily loop is this, shorter.",
  },
};

// ─── The daily loop (P2 → P3 → P4) ───────────────────────────────────────────

const LOOP_EN: LoopCopySurface = {
  // A threshold, not a timer. No duration is promised and no completion is
  // recorded, because a breath you can fail at is not a settling breath.
  breathePrompt: "One slow breath.",
  breatheHint: "in… and out",
  breatheSkip: "skip",

  placePrompt: "Where is it sitting?",
  placeHelper: "Body first. The word comes after.",

  // Bare: the location supplies its own preposition. See LOCATIONS_EN.
  textureCarry: "{{place}} —",
  texturePrompt: "what's the texture?",
  textureHelper: "Just the feel of it, not what it's about.",

  nameCarry: "on that {{texture}} feeling —",
  namePrompt: "reach for a word, try it on.",
  nameOther: "other → type it",
  nameOwnPlaceholder: "your word for it…",

  needCarry: "this {{feeling}} —",
  // Conditional by construction: "if" is doing real work here. A need the person
  // recites instead of recognizes is worse than no need at all.
  needPrompt: "if it points at something you care about, what?",
  needSkip: "not sure — skip",

  // The withdrawn forms (P7). Each keeps the *move* and drops the instruction,
  // because by this point the person knows the move — what they still want is
  // the beat, not the coaching. The need's terse form keeps its "if", since the
  // conditional is the guardrail and not part of the scaffolding.
  placePromptTerse: "where?",
  texturePromptTerse: "what texture?",
  namePromptTerse: "a word for it?",
  needPromptTerse: "if it points somewhere — where?",

  smallStepPrompt: "anything small you want to do or ask for?",
  smallStepPlaceholder: "one small thing…",
  smallStepSkip: "skip",

  done: "done. that's the loop.",

  addAnotherAsk: "feeling more than one thing?",
  addAnother: "add another",
  // The cap closes the sitting warmly. It never says "limit" or "maximum" —
  // the bound exists to stop an emotional inventory forming, and announcing it
  // as a rule would invite exactly the completionism it prevents.
  addAnotherCapped: "that's plenty for one sitting.",
  finish: "finish",

  recapHeading: "this sitting",
  recapLead: "side by side —",
  // The explicit refusal to relate them. Relating is storytelling (P6, tier 4),
  // and letting it in here would smuggle a deferred tier into the demo.
  recapNotRelated: "seeing how they connect comes later.",

  repeatLead: "no need to settle again — straight in.",
  repeatPrompt: "and the other thing — where's that one sitting?",
};

// ─── Distinction catch (P5) ──────────────────────────────────────────────────

/**
 * The catch line, per family. Each names the move the word makes — a read on
 * someone's behaviour — and then opens the door downward. None of them says the
 * person is wrong, because "gentle, not corrective" is a mechanism requirement:
 * a person who feels caught out defends instead of looking.
 */
const LEXICON_CATEGORIES_EN: LexiconCategorySurface[] = [
  {
    id: "excluded",
    catchTemplate: "“{{word}}” is a read on what someone did — or didn't do. Underneath it —",
  },
  {
    id: "diminished",
    catchTemplate: "“{{word}}” is a read on how someone treated you. Underneath it —",
  },
  {
    id: "betrayed",
    catchTemplate: "“{{word}}” is about what someone did. Underneath it —",
  },
  {
    id: "pressured",
    catchTemplate: "“{{word}}” describes the spot you were put in. Underneath it —",
  },
  {
    id: "threatened",
    catchTemplate: "“{{word}}” is a read on what someone did. Underneath it —",
  },
];

const CATCH_EN: CatchCopySurface = {
  genericTemplate: "“{{word}}” is more a read on what someone did than a feeling. Underneath it —",
  feelingHintsLabel: "the feeling",
  needHintsLabel: "the need",
  // Load-bearing. A catch you can't wave off is a quiz.
  dismiss: "leave it — that word fits",
  note: "your words, your call.",
};

/**
 * The detection list. Triggers are matched case-insensitively against the
 * feeling field and free text; multi-word triggers are matched as phrases.
 *
 * Hints are always offered as questions. A hint that asserted ("you're hurt")
 * would be the app substituting its taxonomy for the person's own reading —
 * off-pillar by the `learn.md` §8 decision test.
 */
const LEXICON_EN: LexiconConceptSurface[] = [
  // ── excluded ──────────────────────────────────────────────────────────────
  {
    id: "ignored",
    word: "ignored",
    triggers: ["ignored", "overlooked"],
    feelingHints: ["hurt?", "lonely?"],
    needHints: ["to matter?", "to be included?"],
  },
  {
    id: "left_out",
    word: "left out",
    triggers: ["left out", "excluded", "left behind"],
    feelingHints: ["lonely?", "sad?"],
    needHints: ["to belong?", "to be included?"],
  },
  {
    id: "invisible",
    word: "invisible",
    triggers: ["invisible", "unseen"],
    feelingHints: ["lonely?", "hurt?"],
    needHints: ["to be seen?", "to matter?"],
  },
  {
    id: "unheard",
    word: "unheard",
    triggers: ["unheard", "not heard", "not listened to"],
    feelingHints: ["frustrated?", "lonely?"],
    needHints: ["to be heard?", "to matter?"],
  },
  {
    id: "abandoned",
    word: "abandoned",
    triggers: ["abandoned", "deserted"],
    feelingHints: ["scared?", "lonely?"],
    needHints: ["security?", "connection?"],
  },
  {
    id: "neglected",
    word: "neglected",
    triggers: ["neglected"],
    feelingHints: ["lonely?", "sad?"],
    needHints: ["care?", "connection?"],
  },
  {
    id: "rejected",
    word: "rejected",
    triggers: ["rejected"],
    feelingHints: ["hurt?", "sad?"],
    needHints: ["belonging?", "acceptance?"],
  },
  {
    id: "isolated",
    word: "isolated",
    triggers: ["isolated", "shut out"],
    feelingHints: ["lonely?", "restless?"],
    needHints: ["connection?", "company?"],
  },
  {
    id: "misunderstood",
    word: "misunderstood",
    triggers: ["misunderstood"],
    feelingHints: ["frustrated?", "lonely?"],
    needHints: ["to be understood?", "connection?"],
  },
  {
    id: "unsupported",
    word: "unsupported",
    triggers: ["unsupported", "on my own with it"],
    feelingHints: ["drained?", "overwhelmed?"],
    needHints: ["support?", "partnership?"],
  },

  // ── diminished ────────────────────────────────────────────────────────────
  {
    id: "dismissed",
    word: "dismissed",
    triggers: ["dismissed", "brushed off", "waved off"],
    feelingHints: ["hurt?", "frustrated?"],
    needHints: ["to be heard?", "to matter?"],
  },
  {
    id: "belittled",
    word: "belittled",
    triggers: ["belittled", "made small"],
    feelingHints: ["hurt?", "angry?"],
    needHints: ["respect?", "dignity?"],
  },
  {
    id: "patronized",
    word: "patronized",
    triggers: ["patronized", "patronised", "talked down to", "condescended"],
    feelingHints: ["irritated?", "hurt?"],
    needHints: ["respect?", "to be taken seriously?"],
  },
  {
    id: "criticized",
    word: "criticized",
    triggers: ["criticized", "criticised", "picked apart"],
    feelingHints: ["hurt?", "ashamed?"],
    needHints: ["acceptance?", "understanding?"],
  },
  {
    id: "judged",
    word: "judged",
    triggers: ["judged"],
    feelingHints: ["ashamed?", "tense?"],
    needHints: ["acceptance?", "understanding?"],
  },
  {
    id: "put_down",
    word: "put down",
    triggers: ["put down", "humiliated"],
    feelingHints: ["hurt?", "angry?"],
    needHints: ["respect?", "dignity?"],
  },
  {
    id: "insulted",
    word: "insulted",
    triggers: ["insulted"],
    feelingHints: ["angry?", "hurt?"],
    needHints: ["respect?", "dignity?"],
  },
  {
    id: "invalidated",
    word: "invalidated",
    triggers: ["invalidated", "made to feel crazy"],
    feelingHints: ["frustrated?", "hurt?"],
    needHints: ["to be believed?", "understanding?"],
  },
  {
    id: "unappreciated",
    word: "unappreciated",
    triggers: ["unappreciated", "underappreciated"],
    feelingHints: ["disheartened?", "tired?"],
    needHints: ["to be seen?", "acknowledgement?"],
  },
  {
    id: "taken_for_granted",
    word: "taken for granted",
    triggers: ["taken for granted"],
    feelingHints: ["tired?", "resentful?"],
    needHints: ["acknowledgement?", "to matter?"],
  },
  {
    id: "disrespected",
    word: "disrespected",
    triggers: ["disrespected", "disrespect"],
    feelingHints: ["angry?", "hurt?"],
    needHints: ["respect?", "to be taken seriously?"],
  },

  // ── betrayed ──────────────────────────────────────────────────────────────
  {
    id: "let_down",
    word: "let down",
    triggers: ["let down", "let me down", "failed by"],
    feelingHints: ["disappointed?", "hurt?"],
    needHints: ["to rely on someone?", "trust?"],
  },
  {
    id: "betrayed",
    word: "betrayed",
    triggers: ["betrayed", "stabbed in the back"],
    feelingHints: ["hurt?", "angry?"],
    needHints: ["trust?", "loyalty?"],
  },
  {
    id: "cheated",
    word: "cheated",
    triggers: ["cheated", "cheated on", "short-changed"],
    feelingHints: ["hurt?", "angry?"],
    needHints: ["trust?", "fairness?"],
  },
  {
    id: "lied_to",
    word: "lied to",
    triggers: ["lied to", "deceived", "misled"],
    feelingHints: ["angry?", "hurt?"],
    needHints: ["honesty?", "trust?"],
  },
  {
    id: "distrusted",
    word: "distrusted",
    triggers: ["distrusted", "not trusted", "doubted"],
    feelingHints: ["hurt?", "frustrated?"],
    needHints: ["to be trusted?", "respect?"],
  },
  {
    id: "used",
    word: "used",
    triggers: ["used", "taken advantage of"],
    feelingHints: ["angry?", "hurt?"],
    needHints: ["mutuality?", "respect?"],
  },
  {
    id: "manipulated",
    word: "manipulated",
    triggers: ["manipulated", "played"],
    feelingHints: ["angry?", "uneasy?"],
    needHints: ["honesty?", "autonomy?"],
  },

  // ── pressured ─────────────────────────────────────────────────────────────
  {
    id: "pressured",
    word: "pressured",
    triggers: ["pressured", "pushed into"],
    feelingHints: ["tense?", "anxious?"],
    needHints: ["space?", "choice?"],
  },
  {
    id: "coerced",
    word: "coerced",
    triggers: ["coerced", "forced"],
    feelingHints: ["angry?", "scared?"],
    needHints: ["autonomy?", "choice?"],
  },
  {
    id: "cornered",
    word: "cornered",
    triggers: ["cornered", "trapped", "backed into"],
    feelingHints: ["anxious?", "angry?"],
    needHints: ["space?", "freedom?"],
  },
  {
    id: "obligated",
    word: "obligated",
    triggers: ["obligated", "obliged", "guilt-tripped"],
    feelingHints: ["resentful?", "tired?"],
    needHints: ["choice?", "autonomy?"],
  },
  {
    id: "overworked",
    word: "overworked",
    triggers: ["overworked", "run into the ground"],
    feelingHints: ["drained?", "resentful?"],
    needHints: ["rest?", "balance?"],
  },

  // ── threatened ────────────────────────────────────────────────────────────
  {
    id: "attacked",
    word: "attacked",
    triggers: ["attacked", "went after me"],
    feelingHints: ["scared?", "angry?"],
    needHints: ["safety?", "respect?"],
  },
  {
    id: "threatened",
    word: "threatened",
    triggers: ["threatened"],
    feelingHints: ["scared?", "tense?"],
    needHints: ["safety?", "security?"],
  },
  {
    id: "intimidated",
    word: "intimidated",
    triggers: ["intimidated"],
    feelingHints: ["scared?", "anxious?"],
    needHints: ["safety?", "confidence?"],
  },
  {
    id: "bullied",
    word: "bullied",
    triggers: ["bullied", "picked on"],
    feelingHints: ["scared?", "angry?"],
    needHints: ["safety?", "respect?"],
  },
  {
    id: "harassed",
    word: "harassed",
    triggers: ["harassed", "hounded"],
    feelingHints: ["angry?", "scared?"],
    needHints: ["safety?", "peace?"],
  },
  {
    id: "blamed",
    word: "blamed",
    triggers: ["blamed", "scapegoated"],
    feelingHints: ["ashamed?", "angry?"],
    needHints: ["fairness?", "understanding?"],
  },
];

// ─── Self-initiation (P7) ────────────────────────────────────────────────────

const GRADUATION_EN: GraduationSurface = {
  // Capability, stated once. No number appears anywhere in this copy, and there
  // is nothing here that could be lost — a door you've walked through stays
  // walked through.
  line: "You've been running this on your own lately.",
  body: "That's the point of it. It's yours now — the app was only ever the scaffolding.",
  close: "Carry on whenever you want it.",
};

// ─── Assembly ────────────────────────────────────────────────────────────────

export const SURFACE_EN: FeelingsNeedsSurface = {
  reviewStatus: "reviewed",
  locations: LOCATIONS_EN,
  textures: TEXTURES_EN,
  feelings: FEELINGS_EN,
  needs: NEEDS_EN,
  frame: FRAME_EN,
  loop: LOOP_EN,
  catch: CATCH_EN,
  graduation: GRADUATION_EN,
  lexiconCategories: LEXICON_CATEGORIES_EN,
  lexicon: LEXICON_EN,
};
