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
 * `ns` picks the wording set: the three labs measure different things and
 * phrase their gates differently, so `skills.mastery.*`, `clarity.mastery.*`
 * and `decomposition.mastery.*` are separate rather than one shared list of
 * near-synonyms.
 */
export default function MasteryGapList({
  gaps,
  ns,
}: {
  gaps: MasteryGap[];
  ns: "skills" | "clarity" | "decomposition" | "verification" | "delegation" | "monitoring";
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
  // `done` carries the number into the sentence; `count` is passed alongside
  // purely as i18next's plural selector. A key with no `_one`/`_other` variant
  // falls back to its bare form, so only the gates that actually need to agree
  // a noun — "1 false alarm" vs "2 false alarms" — declare the variants.
  const values = {
    done: gap.count ?? 0,
    count: gap.count ?? 0,
    required: gap.required ?? 0,
    seconds: gap.seconds ?? 0,
    minTotal: gap.minTotal ?? 0,
  };
  const key = gap.code === "speed" && gap.seconds == null ? "speedUnknown" : gap.code;
  return t(`${ns}.mastery.${key}`, { ...values, defaultValue: gap.code });
}
