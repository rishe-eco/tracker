import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";

export type AfterAnswer = "DIFFERENTLY" | "SAME" | "MORE_CAUGHT_UP";

const ANSWERS: { value: AfterAnswer; key: string }[] = [
  { value: "DIFFERENTLY", key: "reflect.after.differently" },
  { value: "SAME", key: "reflect.after.same" },
  { value: "MORE_CAUGHT_UP", key: "reflect.after.moreCaughtUp" },
];

/**
 * The after-entry question (spec §4.8, plate 8): three equal full-width buttons
 * in the spec's order, no number, no colour scale, and *Skip* as a link under
 * them. No Stop here and no Back: the entry is already closed (W12).
 *
 * The page holds the one lock the answer buttons and Skip share (it is never
 * released), so an answer is sent at most once however the person taps: the
 * server refuses a second answer, and that refusal would show as an error. A tap
 * moves on at once; nothing reacts to the answer.
 */
export function AfterEntryQuestion({
  onAnswer,
  onSkip,
}: {
  onAnswer: (answer: AfterAnswer) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {ANSWERS.map((a) => (
        <Button key={a.value} variant="outline" className="h-auto w-full whitespace-normal py-3" onClick={() => onAnswer(a.value)}>
          {t(a.key)}
        </Button>
      ))}
      <div className="text-center">
        <Button variant="link" onClick={onSkip}>
          {t("reflect.after.skip")}
        </Button>
      </div>
    </div>
  );
}

/** The done line (AC-35): no count, streak or total, and nothing to do next but go back. */
export function ReflectDone({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-card p-5 text-sm leading-relaxed">{t("reflect.after.done")}</p>
      <Button className="w-full" onClick={onBack}>
        {t("reflect.after.back")}
      </Button>
    </div>
  );
}
