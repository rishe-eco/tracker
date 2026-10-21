/**
 * Reflect `v1`: the English surface.
 *
 * `reviewStatus: "reviewed"`: the plan ships `en` reviewed; `verify` reads
 * this copy before merge.
 *
 * Register, for the next author: plain and quiet. The tool asks what could be
 * seen and heard before it asks what was felt, and it never says why anything
 * happened: no prompt contains the word "why" or "deepest" (AC-19, held by
 * `reflectContent.unit.test.ts`). Noticing a reading is never framed as
 * having been wrong.
 *
 * The lexicon is matched server-side against the person's own story and never
 * reaches a browser. Every trigger is lower case; the matcher normalizes.
 */

import type { LexiconFamily, ReflectSurface } from "../types";

const LEXICON_EN: LexiconFamily[] = [
  {
    family: "absolute",
    triggers: [
      "always",
      "never",
      "everyone",
      "no one",
      "nobody",
      "every time",
      "all the time",
      "constantly",
      "not once",
      "nothing ever",
    ],
  },
  {
    family: "mind_reading",
    triggers: [
      "on purpose",
      "wanted to",
      "meant to",
      "didn't care",
      "she knew",
      "he knew",
      "they knew",
      "knew exactly",
      "was trying to",
      "decided to",
      "wanted me to",
      "pretended",
    ],
  },
  {
    family: "label",
    triggers: [
      "selfish",
      "rude",
      "lazy",
      "controlling",
      "cold",
      "manipulative",
      "arrogant",
      "disrespectful",
      "pathetic",
      "dismissive",
    ],
  },
  {
    family: "verdict",
    triggers: [
      "ignored me",
      "dismissed me",
      "blamed me",
      "shut me down",
      "humiliated me",
      "used me",
      "walked all over me",
      "talked down to me",
      "put me down",
      "brushed me off",
    ],
  },
];

export const SURFACE_EN: ReflectSurface = {
  reviewStatus: "reviewed",

  story: {
    scenePrompt: "Where were you, and who was there?",
    scenePlaceholder: "the kitchen, my sister and me",
    storyPrompt:
      "Tell it as if you were watching from across the room: what each person said and did, one thing after another.",
    softLine: "Try keeping it to one scene. What came after can be its own entry.",
  },

  feelings: {
    prompt: "Where in the story did a feeling come up?",
    whenLabel: "When",
    whenPlaceholder: "when she closed the door",
    feelingLabel: "The feeling",
    needLabel: "What you needed",
    metLabel: "Was it met?",
    metOptions: { met: "Met", unmet: "Unmet", not_sure: "Not sure" },
  },

  reality: {
    prompt:
      "Read it back. Which parts would a camera have recorded, and which parts are your reading of it? Noticing a reading isn't saying it's wrong.",
    readingLabel: "A reading in it",
    cameraLabel: "What a camera would have caught there",
  },

  close: {
    prompt: "Looking at it now, what do you see that you didn't when you started?",
  },

  interpretation: {
    offerLine: "“{word}” might be a reading of what happened. Want to look at it as one?",
    useLabel: "Use this",
    dismissLabel: "Not this one",
  },

  lexicon: LEXICON_EN,
};
