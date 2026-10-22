import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ReflectFooter, ReflectNotSaved } from "./ReflectShell";
import { ReflectTextInput } from "./ReflectTextInput";
import type { ReflectContent, ReflectEntry, ReflectInterpretationOffer } from "./types";
import type { useReflectAutosave } from "./useReflectAutosave";

type Autosave = ReturnType<typeof useReflectAutosave>;
type Pair = { reading: string; camera: string };

/** Cut at `max` UTF-16 units, never between the halves of a surrogate pair. */
function cut(s: string, max: number) {
  if (s.length <= max) return s;
  let out = s.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out;
}

/** The offer's line holds one `{word}` slot; the word is isolated, left to right (the lexicon's form, PD-13). */
function OfferLine({ line, word }: { line: string; word: string }) {
  const at = line.indexOf("{word}");
  if (at < 0) return <>{line}</>;
  return (
    <>
      {line.slice(0, at)}
      <bdi dir="ltr">{word}</bdi>
      {line.slice(at + "{word}".length)}
    </>
  );
}

/**
 * The story, shown back read-only (W9). Folded to three lines, with *Show all*;
 * a tap anywhere on it toggles, and nothing in it is a control. The trigger
 * word is never marked: the offer names it, the person's text stays as written.
 */
function ShownBackStory({ story }: { story: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-testid="reflect-story-shown"
      onClick={() => setExpanded((v) => !v)}
      className="cursor-pointer space-y-1 rounded-md border bg-card p-3"
    >
      <p dir="auto" className={cn("whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]", !expanded && "line-clamp-3")}>
        {story}
      </p>
      {/* The button is the keyboard's way to the same toggle; its click bubbles to the box, which does it once. */}
      <button type="button" aria-expanded={expanded} className="text-sm underline underline-offset-4">
        {expanded ? t("reflect.reality.showLess") : t("reflect.reality.showAll")}
      </button>
    </div>
  );
}

/**
 * The reality check (spec §4.6, plate 6). The story is shown back, the prompt
 * follows, then up to three reading pairs, either half optional. The pairs
 * wait, dimmed, while the move that opens the step is still out (`waiting`), so
 * an offer can't arrive under a half-typed reading.
 *
 * The offer sits above the pairs, from the move's result, and acts only on
 * itself (the story's tap only expands it). *Use this* fills the first empty
 * reading with the sentence and moves focus to that pair's camera half (W10);
 * *Not this one* hides the offer. Neither sends anything beyond the ordinary
 * save of the reading (AC-30).
 *
 * Positions as in the feelings step: *Add another* shows only when every pair
 * has a stored row and the count is under three.
 */
export function RealityStep({
  entry,
  content,
  autosave,
  storedReadings,
  offer,
  onDismissOffer,
  waiting,
  onBack,
  onNext,
  failed,
  onRetry,
  busy,
}: {
  entry: ReflectEntry;
  content: ReflectContent;
  autosave: Autosave;
  storedReadings: number;
  offer: ReflectInterpretationOffer | null;
  onDismissOffer: () => void;
  waiting: boolean;
  onBack: () => void;
  onNext: () => void;
  failed: boolean;
  onRetry: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { reality, interpretation } = content.prompts;
  const { limits } = content;
  const [pairs, setPairs] = useState<Pair[]>(() =>
    entry.readings.length > 0
      ? entry.readings.map((r) => ({ reading: r.reading ?? "", camera: r.camera ?? "" }))
      : [{ reading: "", camera: "" }]
  );
  const [focusCamera, setFocusCamera] = useState<number | null>(null);
  const cameras = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (focusCamera == null) return;
    cameras.current[focusCamera]?.focus();
    setFocusCamera(null);
  }, [focusCamera]);

  const set = (i: number, field: keyof Pair, v: string) => {
    setPairs((all) => all.map((p, j) => (j === i ? { ...p, [field]: v } : p)));
    autosave.setField(`reading:${i}:${field}`, v);
  };

  const useSentence = () => {
    if (!offer) return;
    let i = pairs.findIndex((p) => p.reading === "");
    let next = pairs;
    if (i < 0 && pairs.length < limits.readingsCap && storedReadings >= pairs.length) {
      next = [...pairs, { reading: "", camera: "" }];
      i = pairs.length;
    }
    onDismissOffer();
    if (i < 0) return; // every pair is full: nothing to fill
    const sentence = cut(offer.sentence, limits.reading);
    setPairs(next.map((p, j) => (j === i ? { ...p, reading: sentence } : p)));
    void autosave.commit(`reading:${i}:reading`, sentence);
    setFocusCamera(i);
  };

  const canAdd = pairs.length < limits.readingsCap && storedReadings >= pairs.length;

  return (
    <div className="space-y-6">
      {entry.story && <ShownBackStory story={entry.story} />}

      <p dir="auto" className="text-sm leading-relaxed">
        {reality.prompt}
      </p>

      {offer && (
        <div
          data-testid="reflect-interpretation-offer"
          className="space-y-3 rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-sm"
        >
          <p dir="auto" className="leading-relaxed [overflow-wrap:anywhere]">
            <OfferLine line={interpretation.offerLine} word={offer.word} />
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={useSentence}>
              <span dir="auto">{interpretation.useLabel}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onDismissOffer}>
              <span dir="auto">{interpretation.dismissLabel}</span>
            </Button>
          </div>
        </div>
      )}

      <div
        data-testid="reflect-pairs"
        aria-busy={waiting}
        className={cn("space-y-4", waiting && "opacity-50")}
      >
        {pairs.map((p, i) => (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
            <ReflectTextInput
              id={`reflect-reading-${i}`}
              label={reality.readingLabel}
              value={p.reading}
              max={limits.reading}
              disabled={waiting}
              onChange={(v) => set(i, "reading", v)}
            />
            <ReflectTextInput
              id={`reflect-camera-${i}`}
              label={reality.cameraLabel}
              value={p.camera}
              max={limits.camera}
              disabled={waiting}
              inputRef={(el) => {
                cameras.current[i] = el;
              }}
              onChange={(v) => set(i, "camera", v)}
            />
          </div>
        ))}
        {canAdd && !waiting && (
          <Button
            variant="link"
            className="h-auto px-0"
            onClick={() => setPairs((all) => [...all, { reading: "", camera: "" }])}
          >
            {t("reflect.reality.addPair")}
          </Button>
        )}
      </div>

      {failed && <ReflectNotSaved onRetry={onRetry} />}
      <ReflectFooter onBack={onBack} backDisabled={busy} onNext={onNext} nextDisabled={failed || busy || waiting} />
    </div>
  );
}
