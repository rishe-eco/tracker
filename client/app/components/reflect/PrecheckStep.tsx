import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ReflectFooter } from "./ReflectShell";

/** The stored values of the API's `ReflectPrecheckWhen` and `ReflectPrecheckBefore` enums. */
export type PrecheckWhen = "DAYS" | "WEEKS" | "LONGER";
export type PrecheckBefore = "YES" | "NO";

const WHEN_OPTIONS: { value: PrecheckWhen; key: string }[] = [
  { value: "DAYS", key: "reflect.precheck.when.days" },
  { value: "WEEKS", key: "reflect.precheck.when.weeks" },
  { value: "LONGER", key: "reflect.precheck.when.longer" },
];

const BEFORE_OPTIONS: { value: PrecheckBefore; key: string }[] = [
  { value: "YES", key: "reflect.precheck.before.yes" },
  { value: "NO", key: "reflect.precheck.before.no" },
];

/** AC-13: the advisory shows for "the last few days" or "Yes". */
export function precheckNeedsAdvisory(when: PrecheckWhen | null, before: PrecheckBefore | null) {
  return when === "DAYS" || before === "YES";
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

/**
 * The pre-check (spec §4.3, plate 3). Two optional single-choice questions; a
 * second tap on a chosen chip clears it (W4). The answers live in the page
 * until the person leaves the step, and are sent once, by the entry page, as
 * one `saveReflectEntry` (PD-6). They are never returned by the API, so this
 * step always opens blank, and it has no Back (D-3).
 *
 * The interface strings are `common.json` keys, in the interface language
 * (G6, AC-63), not the practice pack.
 */
export function PrecheckStep({
  when,
  before,
  onWhen,
  onBefore,
  onNext,
  onKeepGoing,
  onNotNow,
  busy,
  blocked,
}: {
  when: PrecheckWhen | null;
  before: PrecheckBefore | null;
  onWhen: (v: PrecheckWhen | null) => void;
  onBefore: (v: PrecheckBefore | null) => void;
  onNext: () => void;
  onKeepGoing: () => void;
  onNotNow: () => void;
  busy: boolean;
  /** A failed commit holds every way out until it is retried. */
  blocked: boolean;
}) {
  const { t } = useTranslation();
  const advisory = precheckNeedsAdvisory(when, before);
  const held = busy || blocked;

  return (
    <div className="space-y-6">
      <div role="group" aria-labelledby="reflect-when-q" className="space-y-2">
        <p id="reflect-when-q" className="text-sm font-medium">
          {t("reflect.precheck.when.question")}
        </p>
        <div className="flex flex-wrap gap-2">
          {WHEN_OPTIONS.map((o) => (
            <Chip key={o.value} on={when === o.value} onClick={() => onWhen(when === o.value ? null : o.value)}>
              {t(o.key)}
            </Chip>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="reflect-before-q" className="space-y-2">
        <p id="reflect-before-q" className="text-sm font-medium">
          {t("reflect.precheck.before.question")}
        </p>
        <div className="flex flex-wrap gap-2">
          {BEFORE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              on={before === o.value}
              onClick={() => onBefore(before === o.value ? null : o.value)}
            >
              {t(o.key)}
            </Chip>
          ))}
        </div>
      </div>

      {advisory && (
        <div role="note" className="rounded-md border bg-card p-3 text-sm leading-relaxed">
          {t("reflect.precheck.advisory")}
        </div>
      )}

      {advisory ? (
        <ReflectFooter>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onNotNow} disabled={held}>
              {t("reflect.precheck.notNow")}
            </Button>
            <Button onClick={onKeepGoing} disabled={held}>
              {t("reflect.precheck.keepGoing")}
            </Button>
          </div>
        </ReflectFooter>
      ) : (
        <ReflectFooter onNext={onNext} nextDisabled={held} />
      )}
    </div>
  );
}
