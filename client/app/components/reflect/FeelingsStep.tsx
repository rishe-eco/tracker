import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Chip } from "./PrecheckStep";
import { ReflectFooter, ReflectNotSaved } from "./ReflectShell";
import { ReflectTextInput } from "./ReflectTextInput";
import type {
  ReflectContent,
  ReflectEntry,
  ReflectFauxOffer,
  ReflectMet,
  ReflectWordSource,
  SaveValue,
} from "./types";
import type { useReflectAutosave } from "./useReflectAutosave";

type Autosave = ReturnType<typeof useReflectAutosave>;

/** A moment as the page holds it. `ownFeeling` and `ownNeed` only say whether the one-line field is open. */
type Draft = {
  whenText: string;
  feeling: string;
  feelingSource: ReflectWordSource | null;
  need: string;
  needSource: ReflectWordSource | null;
  met: ReflectMet | null;
  ownFeeling: boolean;
  ownNeed: boolean;
};

const BLANK: Draft = {
  whenText: "",
  feeling: "",
  feelingSource: null,
  need: "",
  needSource: null,
  met: null,
  ownFeeling: false,
  ownNeed: false,
};

function fromEntry(entry: ReflectEntry): Draft[] {
  const drafts = entry.moments.map(
    (m): Draft => ({
      whenText: m.whenText ?? "",
      feeling: m.feeling ?? "",
      feelingSource: m.feelingSource,
      need: m.need ?? "",
      needSource: m.needSource,
      met: m.met,
      ownFeeling: m.feelingSource === "OWN" && !!m.feeling,
      ownNeed: m.needSource === "OWN" && !!m.need,
    })
  );
  // One blank card to start with; a card with no stored row has no position yet (B2).
  return drafts.length > 0 ? drafts : [{ ...BLANK }];
}

/** A hint comes back as a question ("hurt?"): the word is what the person keeps. */
const stripQuestion = (hint: string) => hint.replace(/[?؟]+\s*$/u, "").trim();

const key = (i: number, field: string) => `moment:${i}:${field}`;

/**
 * The faux-feeling offer (spec §4.5, W8), inside its moment and under the
 * feeling. It lives in the page, from the save result that carried it, and is
 * dropped on any move or reload (G11). *Use one* shows the feeling hints; a
 * tap on one replaces the feeling. *Keep mine* hides the offer. Neither sends
 * anything the follow-up save doesn't (AC-25).
 */
function FauxOffer({
  offer,
  onUse,
  onKeep,
  busy,
}: {
  offer: ReflectFauxOffer;
  onUse: (hint: string) => void;
  onKeep: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [choosing, setChoosing] = useState(false);
  return (
    <div
      data-testid="reflect-faux-offer"
      className="space-y-3 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm"
    >
      <p dir="auto" className="leading-relaxed [overflow-wrap:anywhere]">
        {offer.line}
      </p>
      {choosing && (
        <div className="space-y-2">
          <p dir="ltr" className="text-xs uppercase tracking-wide text-muted-foreground">
            {offer.feelingHintsLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {offer.feelingHints.map((hint) => (
              <Chip key={hint} on={false} dir="ltr" disabled={busy} onClick={() => onUse(hint)}>
                {hint}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!choosing && (
          <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
            {t("reflect.faux.useOne")}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onKeep}>
          {t("reflect.faux.keepMine")}
        </Button>
      </div>
      <p dir="ltr" className="text-xs text-muted-foreground">
        {offer.note}
      </p>
    </div>
  );
}

/**
 * One palette: its words as chips (`dir="ltr"`, English inside a Persian page),
 * *other…* opening a one-line field in place. A chip saves at once; a second
 * tap on the chosen chip clears it. An own word is held and saved on blur, on
 * Enter or on `flush()`, never on the pause, so a half-typed word can't surface
 * the faux offer (AC-25, card decision 2).
 */
function WordPalette({
  groupId,
  label,
  words,
  otherLabel,
  maxOwn,
  value,
  source,
  ownOpen,
  onPick,
  onOpenOwn,
  onOwnChange,
  onOwnCommit,
}: {
  groupId: string;
  label: string;
  words: { id: string; label: string }[];
  otherLabel: string;
  maxOwn: number;
  value: string;
  source: ReflectWordSource | null;
  ownOpen: boolean;
  onPick: (word: string | null) => void;
  onOpenOwn: () => void;
  onOwnChange: (v: string) => void;
  onOwnCommit: () => void;
}) {
  return (
    <div role="group" aria-labelledby={groupId} className="space-y-2">
      <p id={groupId} className="text-sm font-medium">
        <span dir="auto">{label}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => {
          const on = source === "PALETTE" && value === w.label;
          return (
            <Chip key={w.id} on={on} dir="ltr" onClick={() => onPick(on ? null : w.label)}>
              {w.label}
            </Chip>
          );
        })}
        <Chip on={ownOpen} dir="ltr" onClick={onOpenOwn}>
          {otherLabel}
        </Chip>
      </div>
      {ownOpen && (
        <Input
          dir="auto"
          aria-label={label}
          value={value}
          maxLength={maxOwn}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e) => onOwnChange(e.target.value)}
          onBlur={onOwnCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onOwnCommit();
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Feelings and needs (spec §4.5, plate 5). Moments one at a time, up to three:
 * the open one is a card, earlier ones fold to *when · feeling · need* and
 * reopen on tap (W7). Next with no moment is the skip.
 *
 * Positions (B2): a card with no stored row has no position yet, so *Add
 * another moment* shows only when every card has a stored row and the count is
 * under three, and the first write of a new card is always the next free
 * position. At three the control is gone, with nothing in its place (AC-24).
 *
 * Reloading rebuilds every card from the entry (AC-11).
 */
export function FeelingsStep({
  entry,
  content,
  autosave,
  storedMoments,
  fauxOffer,
  onDismissFaux,
  onBack,
  onNext,
  failed,
  onRetry,
  busy,
}: {
  entry: ReflectEntry;
  content: ReflectContent;
  autosave: Autosave;
  /** How many moment rows the server holds (positions 0..n-1). */
  storedMoments: number;
  fauxOffer: ReflectFauxOffer | null;
  onDismissFaux: () => void;
  onBack: () => void;
  onNext: () => void;
  failed: boolean;
  onRetry: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Draft[]>(() => fromEntry(entry));
  const [open, setOpen] = useState(() => Math.max(0, entry.moments.length - 1));
  const { feelings: copy } = content.prompts;
  const { limits } = content;

  const patch = (i: number, p: Partial<Draft>) =>
    setDrafts((all) => all.map((d, j) => (j === i ? { ...d, ...p } : d)));

  const metOptions: { value: ReflectMet; label: string }[] = [
    { value: "MET", label: copy.metOptions.met },
    { value: "UNMET", label: copy.metOptions.unmet },
    { value: "NOT_SURE", label: copy.metOptions.notSure },
  ];

  const pick = (i: number, kind: "feeling" | "need", word: string | null) => {
    const source: ReflectWordSource = "PALETTE";
    patch(i, kind === "feeling"
      ? { feeling: word ?? "", feelingSource: word == null ? null : source, ownFeeling: false }
      : { need: word ?? "", needSource: word == null ? null : source, ownNeed: false });
    const value: SaveValue = { text: word ?? "", source };
    void autosave.commit(key(i, kind), value);
  };

  const ownChange = (i: number, kind: "feeling" | "need", v: string) => {
    patch(i, kind === "feeling" ? { feeling: v, feelingSource: "OWN" } : { need: v, needSource: "OWN" });
    autosave.hold(key(i, kind), { text: v, source: "OWN" });
  };

  const useHint = (i: number, hint: string) => {
    const word = stripQuestion(hint);
    const inPalette = content.feelings.some((w) => w.label.toLowerCase() === word.toLowerCase());
    const source: ReflectWordSource = inPalette ? "PALETTE" : "OWN";
    patch(i, { feeling: word, feelingSource: source, ownFeeling: source === "OWN" });
    void autosave.commit(key(i, "feeling"), { text: word, source });
    onDismissFaux();
  };

  const canAdd = drafts.length < limits.momentsCap && storedMoments >= drafts.length;

  return (
    <div className="space-y-6">
      <p dir="auto" className="text-sm leading-relaxed">
        {copy.prompt}
      </p>

      {drafts.map((d, i) => {
        if (i !== open) {
          const line = [d.whenText, d.feeling, d.need].filter(Boolean).join(" · ");
          return (
            <button
              key={i}
              type="button"
              aria-expanded={false}
              onClick={() => setOpen(i)}
              className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-start text-sm"
            >
              <span dir="auto" className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {line || t("reflect.feelings.emptyMoment")}
              </span>
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            </button>
          );
        }
        return (
          <div key={i} data-testid="reflect-moment-card" className="space-y-4 rounded-lg border bg-card p-4">
            <ReflectTextInput
              id={`reflect-moment-${i}-when`}
              label={copy.whenLabel}
              placeholder={copy.whenPlaceholder}
              value={d.whenText}
              max={limits.whenText}
              onChange={(v) => {
                patch(i, { whenText: v });
                autosave.setField(key(i, "whenText"), v);
              }}
            />

            <WordPalette
              groupId={`reflect-moment-${i}-feeling`}
              label={copy.feelingLabel}
              words={content.feelings}
              otherLabel={content.otherLabel}
              maxOwn={limits.ownWord}
              value={d.feeling}
              source={d.feelingSource}
              ownOpen={d.ownFeeling}
              onPick={(w) => pick(i, "feeling", w)}
              onOpenOwn={() => patch(i, { ownFeeling: true })}
              onOwnChange={(v) => ownChange(i, "feeling", v)}
              onOwnCommit={() => void autosave.commit(key(i, "feeling"))}
            />

            {fauxOffer && fauxOffer.position === i && (
              <FauxOffer
                offer={fauxOffer}
                busy={busy}
                onUse={(hint) => useHint(i, hint)}
                onKeep={onDismissFaux}
              />
            )}

            <WordPalette
              groupId={`reflect-moment-${i}-need`}
              label={copy.needLabel}
              words={content.needs}
              otherLabel={content.otherLabel}
              maxOwn={limits.ownWord}
              value={d.need}
              source={d.needSource}
              ownOpen={d.ownNeed}
              onPick={(w) => pick(i, "need", w)}
              onOpenOwn={() => patch(i, { ownNeed: true })}
              onOwnChange={(v) => ownChange(i, "need", v)}
              onOwnCommit={() => void autosave.commit(key(i, "need"))}
            />

            <div role="group" aria-labelledby={`reflect-moment-${i}-met`} className="space-y-2">
              <p id={`reflect-moment-${i}-met`} className="text-sm font-medium">
                <span dir="auto">{copy.metLabel}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {metOptions.map((o) => (
                  <Chip
                    key={o.value}
                    on={d.met === o.value}
                    dir="ltr"
                    onClick={() => {
                      const next = d.met === o.value ? null : o.value;
                      patch(i, { met: next });
                      void autosave.commit(key(i, "met"), next);
                    }}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {canAdd && (
        <Button
          variant="link"
          className="h-auto px-0"
          onClick={() => {
            setDrafts((all) => [...all, { ...BLANK }]);
            setOpen(drafts.length);
          }}
        >
          {t("reflect.feelings.addMoment")}
        </Button>
      )}

      {failed && <ReflectNotSaved onRetry={onRetry} />}
      <ReflectFooter onBack={onBack} backDisabled={busy} onNext={onNext} nextDisabled={failed || busy} />
    </div>
  );
}
