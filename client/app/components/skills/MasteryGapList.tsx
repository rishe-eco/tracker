import { useTranslation } from "react-i18next";

/**
 * One unmet mastery requirement, as the server states it.
 *
 * The server sends a code and its numbers rather than a sentence. It used to
 * send finished English, which meant the one panel that says how to finish a
 * module — the last place a learner can afford not to understand — arrived in
 * English no matter what language the rest of the screen was in.
 */
export type MasteryGap = {
  code: string;
  count?: number | null;
  required?: number | null;
  seconds?: number | null;
  minTotal?: number | null;
};

/**
 * `ns` picks the wording set: the two labs measure different things and phrase
 * their gates differently, so `skills.mastery.*` and `clarity.mastery.*` are
 * separate rather than one shared list of near-synonyms.
 */
export default function MasteryGapList({
  gaps,
  ns,
}: {
  gaps: MasteryGap[];
  ns: "skills" | "clarity";
}) {
  const { t } = useTranslation();
  if (gaps.length === 0) return null;

  return (
    <ul className="list-disc space-y-0.5 ps-5 text-xs text-muted-foreground">
      {gaps.map((gap) => (
        <li key={gap.code}>{describe(t, ns, gap)}</li>
      ))}
    </ul>
  );
}

function describe(t: (k: string, o?: any) => string, ns: string, gap: MasteryGap): string {
  // `done` rather than `count`: i18next reads a `count` option as a plural
  // selector and goes looking for `_one`/`_other` variants of the key.
  const values = {
    done: gap.count ?? 0,
    required: gap.required ?? 0,
    seconds: gap.seconds ?? 0,
    minTotal: gap.minTotal ?? 0,
  };
  const key = gap.code === "speed" && gap.seconds == null ? "speedUnknown" : gap.code;
  return t(`${ns}.mastery.${key}`, { ...values, defaultValue: gap.code });
}
