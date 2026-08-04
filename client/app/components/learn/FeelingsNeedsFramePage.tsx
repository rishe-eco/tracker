import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { COMPLETE_FEELINGS_NEEDS_FRAME, GET_FEELINGS_NEEDS_CONTENT } from "~/api/queries";
import { useArrows } from "./arrows";

/**
 * The Day-1 frame — felt, not told (P1).
 *
 * Recall a mild off-moment → find it in the body → try a word on it → notice
 * that naming gave a handle though nothing else changed.
 *
 * The whole design constraint is what this screen refuses to do. It never tells
 * the reader that emotions are workable; the payoff reports what just happened
 * and leaves the conclusion to them, because a belief that is asserted is a
 * motivational poster and a belief that is felt is a belief. So: no slogan, no
 * "great job", no explanation of the mechanism afterwards.
 *
 * Nothing here is persisted except the fact of completion. The texture and word
 * are the experience, not data — keeping them would turn a felt moment into an
 * entry, and the frame is deliberately not an entry.
 */

type Palette = { id: string; label: string };
type Beat = { prompt: string; helper: string };
type Frame = {
  intro: { title: string; body: string; begin: string };
  recall: Beat & { ready: string };
  place: Beat & { locationIds: string[] };
  texture: Beat & { textureIds: string[] };
  name: Beat & { feelingIds: string[] };
  payoff: { line: string; body: string; close: string };
};

type Step = "intro" | "recall" | "place" | "texture" | "name" | "payoff";

export default function FeelingsNeedsFramePage() {
  const { t } = useTranslation();
  const { back } = useArrows();
  const navigate = useNavigate();
  const { call } = useApi();

  const [frame, setFrame] = useState<Frame | null>(null);
  const [locations, setLocations] = useState<Palette[]>([]);
  const [textures, setTextures] = useState<Palette[]>([]);
  const [feelings, setFeelings] = useState<Palette[]>([]);
  const [step, setStep] = useState<Step>("intro");
  const [place, setPlace] = useState<Palette | null>(null);
  const [texture, setTexture] = useState<Palette | null>(null);
  const [word, setWord] = useState<Palette | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await call({ query: GET_FEELINGS_NEEDS_CONTENT });
    if (!res?.feelingsNeedsContent) {
      setFailed(true);
      return;
    }
    setFrame(res.feelingsNeedsContent.frame);
    setLocations(res.feelingsNeedsContent.locations);
    setTextures(res.feelingsNeedsContent.textures);
    setFeelings(res.feelingsNeedsContent.feelings);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <InternalPageLayout title={t("learn.feelingsNeeds.frame.cardTitle")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("learn.feelingsNeeds.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("learn.feelingsNeeds.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!frame) return <LoadingBlock />;

  const pick = (pool: Palette[], ids: string[]) =>
    ids.map((id) => pool.find((p) => p.id === id)).filter(Boolean) as Palette[];

  const finish = async () => {
    setBusy(true);
    const res = await call({ query: COMPLETE_FEELINGS_NEEDS_FRAME });
    setBusy(false);
    if (!res?.completeFeelingsNeedsFrame) {
      setFailed(true);
      return;
    }
    navigate("/tools/learn/feelings-needs");
  };

  return (
    <InternalPageLayout title={t("learn.feelingsNeeds.frame.cardTitle")}>
      <div className="mx-auto flex min-h-[22rem] max-w-md flex-col justify-center gap-6 py-4">
        {step === "intro" && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium">{frame.intro.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{frame.intro.body}</p>
            <Button onClick={() => setStep("recall")}>{frame.intro.begin}</Button>
          </section>
        )}

        {/* No input here on purpose. The recall beat asks for something that
            happens in the person, not on the screen — giving it a text field
            would turn remembering into reporting. */}
        {step === "recall" && (
          <section className="space-y-4">
            <p className="text-sm leading-relaxed">{frame.recall.prompt}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{frame.recall.helper}</p>
            <Button onClick={() => setStep("place")}>{frame.recall.ready}</Button>
          </section>
        )}

        {/* Where it sits, then what it's like there. These were one step that
            asked the first question and offered answers to the second. */}
        {step === "place" && (
          <section className="space-y-4">
            <p className="text-sm leading-relaxed">{frame.place.prompt}</p>
            <p className="text-sm text-muted-foreground">{frame.place.helper}</p>
            <Chips
              options={pick(locations, frame.place.locationIds)}
              selectedId={place?.id ?? null}
              onPick={(o) => {
                setPlace(o);
                setStep("texture");
              }}
            />
          </section>
        )}

        {step === "texture" && (
          <section className="space-y-4">
            <p className="text-sm leading-relaxed">{frame.texture.prompt}</p>
            <p className="text-sm text-muted-foreground">{frame.texture.helper}</p>
            <Chips
              options={pick(textures, frame.texture.textureIds)}
              selectedId={texture?.id ?? null}
              onPick={(o) => {
                setTexture(o);
                setStep("name");
              }}
            />
          </section>
        )}

        {step === "name" && (
          <section className="space-y-4">
            {texture && (
              <p className="text-xs text-muted-foreground">
                {t("learn.feelingsNeeds.frame.thatFeeling", { texture: texture.label })}
              </p>
            )}
            <p className="text-sm leading-relaxed">{frame.name.prompt}</p>
            <p className="text-sm text-muted-foreground">{frame.name.helper}</p>
            <Chips
              options={pick(feelings, frame.name.feelingIds)}
              selectedId={word?.id ?? null}
              onPick={(o) => {
                setWord(o);
                setStep("payoff");
              }}
            />
            <button
              className="-my-2 inline-flex min-h-11 items-center py-2 text-xs text-muted-foreground"
              onClick={() => setStep("texture")}
            >
              {back} {t("learn.feelingsNeeds.nav.back")}
            </button>
          </section>
        )}

        {step === "payoff" && (
          <section className="space-y-5">
            {/* Their own two words, handed back. This is the evidence the
                payoff line refers to — the "shape and a word" is literally on
                screen, in the words they chose, not ours. */}
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-muted/60 px-3 py-1">{texture?.label}</span>
              <span className="text-muted-foreground">·</span>
              <span className="rounded-full bg-muted/60 px-3 py-1">{word?.label}</span>
            </div>
            <p className="text-sm leading-relaxed">{frame.payoff.line}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{frame.payoff.body}</p>
            <p className="text-sm leading-relaxed">{frame.payoff.close}</p>
            <Button disabled={busy} onClick={() => void finish()}>
              {t("learn.feelingsNeeds.frame.done")}
            </Button>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

function Chips({
  options,
  selectedId,
  onPick,
}: {
  options: Palette[];
  selectedId: string | null;
  onPick: (o: Palette) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onPick(o)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            selectedId === o.id
              ? "border-primary bg-primary/10 text-primary"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
