import { useTranslation } from "react-i18next";

type Props = {
  level: number | null | undefined;
  /** Copy differs per lab ("not scored" plus that lab's own reason), so it is passed in. */
  unscoredLabel: string;
  unscoredHint: string;
};

/**
 * The level display for one rubric row: a numeral plus two pips.
 *
 * Shared by all five rails. It was five copies of the same function before,
 * which is how three separate bugs shipped in parallel (persona review pass 3):
 *
 * 1. **The scored row was the least legible one.** Level 0–2 was drawn as
 *    pips and nothing else, while an *unscored* row got the words "not
 *    scored" — so on a Delegation or Monitoring reveal, where exactly one
 *    criterion scores and five don't, the one row carrying the result was the
 *    only row with no words on it. The numeral is now always spelled out.
 * 2. The pips' `aria-label` was hardcoded English in every copy.
 * 3. `null` and `undefined` mean different things here and are easy to
 *    conflate — `null` is "nothing scored this" (an absence of data, drawn as
 *    words), `undefined` is "no attempt yet" (drawn as empty pips, no label).
 *    Neither is ever drawn like a zero, which is a real score.
 */
export default function RubricPips({ level, unscoredLabel, unscoredHint }: Props) {
  const { t } = useTranslation();

  if (level === null) {
    return (
      <span className="text-[10px] text-muted-foreground" title={unscoredHint}>
        {unscoredLabel}
      </span>
    );
  }

  const scored = level !== undefined;

  return (
    <span className="flex items-center gap-1.5">
      {scored && (
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {t("skills.levelOutOfTwo", { level })}
        </span>
      )}
      <span className="flex gap-1" aria-label={scored ? t("skills.levelOutOfTwoAria", { level }) : undefined}>
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-[2px] border ${
              scored && i < level ? "border-primary bg-primary" : "border-muted-foreground/40"
            }`}
          />
        ))}
      </span>
    </span>
  );
}
