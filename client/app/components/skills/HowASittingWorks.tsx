import { useTranslation } from "react-i18next";

type Props = {
  /** Translation namespace holding `<ns>.title`, `.premise`, `.<step>Title/Body` and the catch pair. */
  ns: string;
  /** Step keys in order; each needs a `<key>Title` and `<key>Body`. */
  steps: string[];
  /**
   * The highlighted "one thing worth knowing" pair. Every lab has exactly one
   * fact that, unknown, makes the first sitting score badly for a reason that
   * has nothing to do with the skill.
   */
  catchKey: string;
  defaultOpen: boolean;
  /** Optional trailing note, e.g. what leaves the browser. */
  footnoteKey?: string;
};

/**
 * "What am I about to do, and what happens when I press the button."
 *
 * Evidence and Clarity each grew one of these after review passes 1 and 2; the
 * four labs built afterwards shipped with a one-line pitch and a start button
 * and nothing in between, which cost them most of their clarity-of-purpose
 * score in pass 3. Nothing in the build plans said to carry the earlier passes'
 * fixes forward — so this is one component now rather than a convention nobody
 * can see.
 *
 * Open on a first visit, one click away afterwards: a learner returning for a
 * second sitting wants the mechanics, not the pitch.
 */
export default function HowASittingWorks({ ns, steps, catchKey, defaultOpen, footnoteKey }: Props) {
  const { t } = useTranslation();

  return (
    <details open={defaultOpen} className="rounded-lg border bg-card">
      <summary className="cursor-pointer list-none p-4 text-sm font-semibold">{t(`${ns}.title`)}</summary>
      <div className="space-y-4 border-t p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{t(`${ns}.premise`)}</p>

        <ol className="space-y-2">
          {steps.map((key, i) => (
            <li key={key} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px]">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed">
                <span className="font-medium">{t(`${ns}.${key}Title`)}</span>{" "}
                <span className="text-muted-foreground">{t(`${ns}.${key}Body`)}</span>
              </p>
            </li>
          ))}
        </ol>

        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3">
          <p className="text-sm font-medium">{t(`${ns}.${catchKey}Title`)}</p>
          <p className="mt-1 text-sm leading-relaxed">{t(`${ns}.${catchKey}Body`)}</p>
        </div>

        {footnoteKey && (
          <p className="text-xs leading-relaxed text-muted-foreground">{t(`${ns}.${footnoteKey}`)}</p>
        )}
      </div>
    </details>
  );
}
