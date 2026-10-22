/**
 * Reflect: the shapes the client reads. Mirrors the documents in `queries.ts`
 * (`GET_REFLECT_*`), which select only the fields below.
 */

export type ReflectStep = "PRECHECK" | "STORY" | "FEELINGS" | "REALITY" | "CLOSE";

/** The stored values of the API's `ReflectWordSource` and `ReflectMet` enums. */
export type ReflectWordSource = "PALETTE" | "OWN";
export type ReflectMet = "MET" | "UNMET" | "NOT_SURE";

export type ReflectMoment = {
  id: string;
  position: number;
  whenText: string | null;
  feeling: string | null;
  feelingSource: ReflectWordSource | null;
  need: string | null;
  needSource: ReflectWordSource | null;
  met: ReflectMet | null;
};

export type ReflectReading = {
  id: string;
  position: number;
  reading: string | null;
  camera: string | null;
};

export type ReflectEntry = {
  id: string;
  step: ReflectStep;
  scene: string | null;
  story: string | null;
  close: string | null;
  createdAt: string;
  moments: ReflectMoment[];
  readings: ReflectReading[];
};

export type ReflectHome = {
  openEntry: { id: string; createdAt: string; hasStory: boolean } | null;
  hasPast: boolean;
  practiceLocale: string;
  reviewStatus: string;
};

export type ReflectLimits = {
  scene: number;
  story: number;
  storySoftLine: number;
  whenText: number;
  reading: number;
  camera: number;
  ownWord: number;
  close: number;
  momentsCap: number;
  readingsCap: number;
};

export type ReflectWord = { id: string; label: string };

export type ReflectContent = {
  locale: string;
  reviewStatus: string;
  prompts: {
    story: { scenePrompt: string; scenePlaceholder: string; storyPrompt: string };
    feelings: {
      prompt: string;
      whenLabel: string;
      whenPlaceholder: string;
      feelingLabel: string;
      needLabel: string;
      metLabel: string;
      metOptions: { met: string; unmet: string; notSure: string };
    };
    reality: { prompt: string; readingLabel: string; cameraLabel: string };
    close: { prompt: string };
    interpretation: { offerLine: string; useLabel: string; dismissLabel: string };
  };
  feelings: ReflectWord[];
  needs: ReflectWord[];
  otherLabel: string;
  limits: ReflectLimits;
};

/** The faux-feeling offer, as `saveReflectMoment` returns it. Held in page state only (G11). */
export type ReflectFauxOffer = {
  position: number;
  conceptId: string;
  line: string;
  feelingHints: string[];
  needHints: string[];
  feelingHintsLabel: string;
  needHintsLabel: string;
  dismiss: string;
  note: string;
};

/** The interpretation offer, as `moveReflectEntry` returns it. Held in page state only (G11). */
export type ReflectInterpretationOffer = { word: string; sentence: string };

/** The text fields `saveReflectEntry` takes one at a time. */
export type ReflectTextField = "scene" | "story" | "close";

/**
 * What the autosave queue holds for one key: a plain string, a word with the
 * source it came from (a feeling or a need), or a Met choice (null clears it).
 * Keys: `scene` | `story` | `close`, `moment:<i>:<field>`, `reading:<i>:<field>`.
 */
export type SaveValue = string | { text: string; source: ReflectWordSource } | ReflectMet | null;

/**
 * AC-56, G5: does the entry hold any written text? A non-empty scene, story or
 * close, any moment's when, feeling or need, any reading's reading or camera.
 * Read from the entry the server returns, never from what the page last typed.
 * (The pre-check answers are not text and are never returned.)
 */
export function holdsWrittenText(entry: ReflectEntry): boolean {
  const has = (v: string | null | undefined) => v != null && v !== "";
  return (
    has(entry.scene) ||
    has(entry.story) ||
    has(entry.close) ||
    entry.moments.some((m) => has(m.whenText) || has(m.feeling) || has(m.need)) ||
    entry.readings.some((r) => has(r.reading) || has(r.camera))
  );
}
