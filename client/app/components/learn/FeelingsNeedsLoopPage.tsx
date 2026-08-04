import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { useArrows } from "./arrows";
import {
  ACKNOWLEDGE_GRADUATION,
  ADD_LOOP_PASS,
  FINISH_LOOP_SITTING,
  GET_ACTIVE_LOOP_SITTING,
  GET_FEELINGS_NEEDS_CONTENT,
  SET_LOOP_BREATH,
  START_LOOP_SITTING,
  UPDATE_LOOP_ENTRY,
} from "~/api/queries";

/**
 * The daily loop — the spine of the module (plan §4.2).
 *
 * breathe → notice the body → name the feeling → the need underneath → an
 * optional small step, then close. Optionally repeat for a second distinct
 * feeling, then a side-by-side recap.
 *
 * Two things this component deliberately does not do. It never holds a finished
 * loop in local state waiting for a submit — every step fires its own mutation
 * (convention #8), so closing the tab loses at most the step in progress. And it
 * never puts two passes in the same sentence: the recap lays them out beside one
 * another and says outright that connecting them comes later, because relating
 * them is storytelling (tier 4, deferred).
 */

type PaletteEntry = {
  id: string;
  label: string;
  /** The form used inside a carried prompt; falls back to `label`. */
  carryLabel?: string | null;
  tier?: string | null;
};
type LoopEntry = {
  id: string;
  passIndex: number;
  bodyLocation: string | null;
  bodyTexture: string | null;
  feelingWord: string | null;
  feelingSource: string | null;
  need: string | null;
  needSource: string | null;
  smallAction: string | null;
};
type Sitting = {
  id: string;
  breathTaken: boolean;
  completedAt: string | null;
  entries: LoopEntry[];
};
type Content = {
  repeatSoftCap: number;
  breathSkippable: boolean;
  locations: PaletteEntry[];
  textures: PaletteEntry[];
  feelings: PaletteEntry[];
  needs: PaletteEntry[];
  display: { locationIds: string[]; textureIds: string[]; feelingIds: string[]; needIds: string[] };
  loop: LoopCopy;
};

/**
 * Mirrors the served loop copy. Only the two helper lines are nullable: those
 * are what the server withdraws as the scaffold fades (P7), and it stops
 * sending them rather than sending an empty string. The prompts themselves
 * always arrive — already in their terse form when the fade calls for it.
 */
type LoopCopy = {
  breathePrompt: string;
  breatheHint: string | null;
  breatheSkip: string;
  placePrompt: string;
  placeHelper: string | null;
  textureCarry: string;
  texturePrompt: string;
  textureHelper: string | null;
  nameCarry: string;
  namePrompt: string;
  nameOther: string;
  nameOwnPlaceholder: string;
  needCarry: string;
  needPrompt: string;
  needSkip: string;
  smallStepPrompt: string;
  smallStepPlaceholder: string;
  smallStepSkip: string;
  done: string;
  addAnother: string;
  addAnotherAsk: string;
  addAnotherCapped: string;
  finish: string;
  recapHeading: string;
  recapLead: string;
  recapNotRelated: string;
  repeatLead: string;
  repeatPrompt: string;
};

type Graduation = { line: string; body: string; close: string };

type SurfacedCatch = {
  conceptId: string;
  line: string;
  feelingHints: string[];
  needHints: string[];
  feelingHintsLabel: string;
  needHintsLabel: string;
  dismiss: string;
  note: string;
};

type Step =
  | "breathe"
  | "place"
  | "texture"
  | "name"
  | "catch"
  | "need"
  | "small"
  | "close"
  | "recap"
  | "graduated";

// The catch is not a step of the loop — it is an interruption that sometimes
// happens inside one — so it gets no dot. Showing progress "pausing" would
// frame it as an extra hoop rather than an aside.
const STEP_DOTS: Step[] = ["place", "texture", "name", "need", "small"];

export default function FeelingsNeedsLoopPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [content, setContent] = useState<Content | null>(null);
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [step, setStep] = useState<Step>("breathe");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ownWord, setOwnWord] = useState("");
  const [typingOwn, setTypingOwn] = useState(false);
  const [smallText, setSmallText] = useState("");
  const [pendingCatch, setPendingCatch] = useState<SurfacedCatch | null>(null);
  const [graduation, setGraduation] = useState<Graduation | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [c, a] = await Promise.all([
      call({ query: GET_FEELINGS_NEEDS_CONTENT }),
      call({ query: GET_ACTIVE_LOOP_SITTING }),
    ]);
    if (!c?.feelingsNeedsContent) {
      setFailed(true);
      return;
    }
    setContent(c.feelingsNeedsContent);

    const existing: Sitting | null = a?.activeLoopSitting ?? null;
    if (existing) {
      setSitting(existing);
      setStep(resumeStep(existing));
      return;
    }
    const started = await call({ query: START_LOOP_SITTING, variables: { wasPrompted: false } });
    if (!started?.startLoopSitting) {
      setFailed(true);
      return;
    }
    setSitting(started.startLoopSitting);
    setStep(started.startLoopSitting.breathTaken ? "place" : "breathe");
  }, [call]);

  // Opening a sitting is a write, so this effect must fire exactly once. React
  // double-invokes mount effects in development, and two concurrent opens each
  // see no active sitting — the server closes that race too, but not paying for
  // it is better than recovering from it.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void load();
  }, [load]);

  const pass = useMemo(
    () => (sitting ? sitting.entries[sitting.entries.length - 1] : null),
    [sitting]
  );

  /** Every mutation returns the whole sitting, so there is one place to apply it. */
  const commit = useCallback(
    async (query: string, variables: Record<string, unknown>, key: string, next?: Step) => {
      setBusy(true);
      const res = await call({ query, variables });
      setBusy(false);
      if (!res?.[key]) {
        setFailed(true);
        return null;
      }
      setSitting(res[key]);
      if (next) setStep(next);
      return res[key] as Sitting;
    },
    [call]
  );

  /**
   * Commit one step of the current pass.
   *
   * Separate from `commit` because this is the one mutation that can answer with
   * something other than state: naming a feeling may surface a distinction catch
   * (P5), and when it does the catch takes precedence over wherever the step was
   * headed. It never blocks — the catch step always offers a way past.
   */
  const commitEntry = useCallback(
    async (fields: Record<string, unknown>, next?: Step) => {
      if (!pass) return null;
      setBusy(true);
      const res = await call({
        query: UPDATE_LOOP_ENTRY,
        variables: { entryId: pass.id, ...fields },
      });
      setBusy(false);
      if (!res?.updateLoopEntry?.sitting) {
        setFailed(true);
        return null;
      }
      const { sitting: updated, catch: surfaced } = res.updateLoopEntry;
      setSitting(updated);
      if (surfaced) {
        setPendingCatch(surfaced);
        setStep("catch");
      } else if (next) {
        setStep(next);
      }
      return updated as Sitting;
    },
    [call, pass]
  );

  /**
   * Close the sitting and decide where it lands.
   *
   * Three destinations, in order of precedence: the recap when the sitting held
   * more than one pass, the capability door when this run is the one that
   * earned it, and otherwise straight home. The door is held back until after
   * the recap so a plural sitting still gets its side-by-side view first.
   */
  const finishSitting = useCallback(async () => {
    if (!sitting) return;
    setBusy(true);
    const res = await call({ query: FINISH_LOOP_SITTING, variables: { sittingId: sitting.id } });
    setBusy(false);
    if (!res?.finishLoopSitting?.sitting) {
      setFailed(true);
      return;
    }
    const { sitting: done, graduation: earned } = res.finishLoopSitting;
    setSitting(done);
    if (earned) setGraduation(earned);

    if (done.entries.length > 1) setStep("recap");
    else if (earned) setStep("graduated");
    else navigate("/tools/learn/feelings-needs");
  }, [call, sitting, navigate]);

  /** Walk through the door. Acknowledged so closing the tab cannot spend it. */
  const leaveGraduation = useCallback(async () => {
    await call({ query: ACKNOWLEDGE_GRADUATION });
    navigate("/tools/learn/feelings-needs");
  }, [call, navigate]);

  if (failed) {
    return (
      <InternalPageLayout title={t("learn.feelingsNeeds.loop.cardTitle")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("learn.feelingsNeeds.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("learn.feelingsNeeds.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!content || !sitting || !pass) return <LoadingBlock />;

  const c = content.loop;
  const labelOf = (pool: PaletteEntry[], id: string | null) =>
    (id && pool.find((e) => e.id === id)?.label) || id || "";
  /**
   * The word as it reads inside a carried sentence. Differs from the chip label
   * where the chip is a phrase ("hard to place") or where the language inflects
   * it — see the note on PaletteEntrySurface in the API.
   */
  const carriedLabel = (pool: PaletteEntry[], id: string | null) => {
    const entry = id ? pool.find((e) => e.id === id) : undefined;
    return entry?.carryLabel || entry?.label || id || "";
  };
  const shown = (pool: PaletteEntry[], ids: string[]) =>
    ids.map((id) => pool.find((e) => e.id === id)).filter(Boolean) as PaletteEntry[];

  const isRepeat = pass.passIndex > 0;
  const atCap = sitting.entries.length >= content.repeatSoftCap;

  return (
    <InternalPageLayout title={t("learn.feelingsNeeds.loop.cardTitle")}>
      <BreatheKeyframes />
      <div className="mx-auto flex min-h-[24rem] max-w-md flex-col gap-5">
        {STEP_DOTS.includes(step) && <Dots current={step} />}

        {step === "breathe" && (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <BreathRing />
            <p className="text-sm">{c.breathePrompt}</p>
            {c.breatheHint && <p className="text-xs text-muted-foreground">{c.breatheHint}</p>}
            <div className="mt-4 flex items-center gap-4">
              <Button
                disabled={busy}
                onClick={() =>
                  void commit(SET_LOOP_BREATH, { sittingId: sitting.id }, "setLoopBreath", "place")
                }
              >
                {t("learn.feelingsNeeds.nav.continue")}
              </Button>
              {content.breathSkippable && (
                <QuietAction onClick={() => setStep("place")}>{c.breatheSkip}</QuietAction>
              )}
            </div>
          </section>
        )}

        {/* Where, then what it's like. One step used to ask "where does it sit?"
            and offer texture words — a question and an answer set about
            different things, at the exact moment the person is being asked to
            attend inward for the first time. */}
        {step === "place" && (
          <section className="space-y-4">
            {isRepeat && <p className="text-xs italic text-muted-foreground">{c.repeatLead}</p>}
            <div>
              <p className="text-sm">{isRepeat ? c.repeatPrompt : c.placePrompt}</p>
              {c.placeHelper && (
                <p className="mt-1 text-xs text-muted-foreground">{c.placeHelper}</p>
              )}
            </div>
            <Chips
              options={shown(content.locations, content.display.locationIds)}
              selectedId={pass.bodyLocation}
              disabled={busy}
              onPick={(id) => void commitEntry({ bodyLocation: id }, "texture")}
            />
          </section>
        )}

        {step === "texture" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {c.textureCarry.replace(
                  "{{place}}",
                  carriedLabel(content.locations, pass.bodyLocation)
                )}
              </p>
              <p className="mt-1 text-sm">{c.texturePrompt}</p>
              {c.textureHelper && (
                <p className="mt-1 text-xs text-muted-foreground">{c.textureHelper}</p>
              )}
            </div>
            <Chips
              options={shown(content.textures, content.display.textureIds)}
              selectedId={pass.bodyTexture}
              disabled={busy}
              onPick={(id) => void commitEntry({ bodyTexture: id }, "name")}
            />
            <StepBack onClick={() => setStep("place")} />
          </section>
        )}

        {step === "name" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {c.nameCarry.replace(
                  "{{texture}}",
                  carriedLabel(content.textures, pass.bodyTexture)
                )}
              </p>
              <p className="mt-1 text-sm">{c.namePrompt}</p>
            </div>
            <Chips
              options={shown(content.feelings, content.display.feelingIds)}
              selectedId={pass.feelingSource === "palette" ? pass.feelingWord : null}
              disabled={busy}
              onPick={(id) =>
                void commitEntry({ feelingWord: id, feelingSource: "palette" }, "need")
              }
              escape={{
                label: c.nameOther,
                active: typingOwn,
                onClick: () => setTypingOwn(true),
              }}
            />
            {typingOwn && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!ownWord.trim()) return;
                  void commitEntry({ feelingWord: ownWord.trim(), feelingSource: "own" }, "need");
                }}
              >
                <Input
                  autoFocus
                  value={ownWord}
                  onChange={(e) => setOwnWord(e.target.value)}
                  placeholder={c.nameOwnPlaceholder}
                />
                <Button type="submit" disabled={busy || !ownWord.trim()}>
                  {t("learn.feelingsNeeds.nav.next")}
                </Button>
              </form>
            )}
            <StepBack onClick={() => setStep("texture")} />
          </section>
        )}

        {step === "catch" && pendingCatch && (
          <section className="space-y-4">
            {/* Their own word, quoted back — the contrast has to be drawn on
                their material, not a canned example, or it lands nowhere. */}
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3">
              <p className="text-sm leading-relaxed">{pendingCatch.line}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pendingCatch.feelingHintsLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingCatch.feelingHints.map((hint) => (
                  <button
                    key={hint}
                    disabled={busy}
                    className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      setPendingCatch(null);
                      void commitEntry(
                        { feelingWord: stripQuestion(hint), feelingSource: "catch" },
                        "need"
                      );
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pendingCatch.needHintsLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingCatch.needHints.map((hint) => (
                  <button
                    key={hint}
                    disabled={busy}
                    className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      setPendingCatch(null);
                      // Taking a need here answers the next step, so skip it
                      // rather than ask the same question twice.
                      void commitEntry({ need: stripQuestion(hint), needSource: "catch" }, "small");
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>

            {/* Load-bearing, not politeness. A catch the person cannot decline
                is a quiz, and a quiz produces defensiveness instead of looking. */}
            <div className="flex items-center justify-between border-t pt-3">
              <QuietAction
                onClick={() => {
                  setPendingCatch(null);
                  setStep("need");
                }}
              >
                {pendingCatch.dismiss}
              </QuietAction>
              <span className="text-[11px] text-muted-foreground">{pendingCatch.note}</span>
            </div>
          </section>
        )}

        {step === "need" && (
          <section className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {c.needCarry.replace(
                  "{{feeling}}",
                  carriedLabel(content.feelings, pass.feelingWord)
                )}
              </p>
              <p className="mt-1 text-sm">{c.needPrompt}</p>
            </div>
            <Chips
              options={shown(content.needs, content.display.needIds)}
              selectedId={pass.need}
              disabled={busy}
              onPick={(id) => void commitEntry({ need: id, needSource: "palette" }, "small")}
            />
            {/* Skipping is a first-class move, not a hidden one: the need is
                offered, never forced (P4). */}
            <StepFooter
              skipLabel={c.needSkip}
              onSkip={() => setStep("small")}
              onBack={() => setStep("name")}
            />
          </section>
        )}

        {step === "small" && (
          <section className="space-y-4">
            <p className="text-sm">{c.smallStepPrompt}</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void commitEntry({ smallAction: smallText.trim() || null }, "close");
              }}
            >
              <Input
                value={smallText}
                onChange={(e) => setSmallText(e.target.value)}
                placeholder={c.smallStepPlaceholder}
              />
              <Button type="submit" disabled={busy}>
                {t("learn.feelingsNeeds.nav.next")}
              </Button>
            </form>
            <StepFooter
              skipLabel={c.smallStepSkip}
              onSkip={() => setStep("close")}
              onBack={() => setStep("need")}
            />
          </section>
        )}

        {step === "close" && (
          <section className="space-y-5">
            <p className="text-sm">✓ {c.done}</p>
            <PairLine
              feeling={labelOf(content.feelings, pass.feelingWord)}
              need={labelOf(content.needs, pass.need)}
            />

            {/* Finishing is the primary action; the repeat is a quiet secondary.
                Making the repeat prominent would invite the inventory the soft
                cap exists to prevent. */}
            <div className="space-y-2 border-t pt-4">
              {atCap ? (
                <p className="text-xs text-muted-foreground">{c.addAnotherCapped}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{c.addAnotherAsk}</p>
                  <QuietAction
                    disabled={busy}
                    onClick={() => {
                      setSmallText("");
                      setOwnWord("");
                      setTypingOwn(false);
                      setPendingCatch(null);
                      void commit(ADD_LOOP_PASS, { sittingId: sitting.id }, "addLoopPass", "place");
                    }}
                  >
                    + {c.addAnother}
                  </QuietAction>
                </>
              )}
            </div>

            <div className="pt-2 text-center">
              <Button
                disabled={busy}
                onClick={() => void finishSitting()}
              >
                {c.finish}
              </Button>
            </div>
          </section>
        )}

        {step === "recap" && (
          <section className="space-y-4">
            <p className="text-sm font-medium">{c.recapHeading}</p>
            <p className="text-xs text-muted-foreground">{c.recapLead}</p>
            <div className="space-y-2">
              {sitting.entries.map((e) => (
                <PairLine
                  key={e.id}
                  feeling={labelOf(content.feelings, e.feelingWord)}
                  need={labelOf(content.needs, e.need)}
                />
              ))}
            </div>
            {/* The refusal, stated plainly. */}
            <p className="text-xs text-muted-foreground">{c.recapNotRelated}</p>
            <div className="pt-2 text-center">
              <Button
                onClick={() =>
                  graduation ? setStep("graduated") : navigate("/tools/learn/feelings-needs")
                }
              >
                {c.finish}
              </Button>
            </div>
          </section>
        )}

        {step === "graduated" && graduation && (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            {/* A door, not a score. There is no number on this screen and
                nothing here can be lost again — which is also why it sidesteps
                the streak-cliff a counter would have created. */}
            <div className="text-3xl text-primary" aria-hidden>
              ⌐
            </div>
            <p className="text-sm font-medium">{graduation.line}</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {graduation.body}
            </p>
            <p className="text-xs text-muted-foreground">{graduation.close}</p>
            <Button className="mt-4" disabled={busy} onClick={() => void leaveGraduation()}>
              {c.finish}
            </Button>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

/**
 * Where to drop someone back in.
 *
 * Deliberately conservative: it resumes at the first step whose answer is
 * genuinely missing. The need and the small step are both skippable, so an empty
 * one is indistinguishable from a skipped one — landing on it again costs a tap,
 * whereas guessing "they skipped it" would silently swallow a step they meant to
 * answer.
 */
function resumeStep(sitting: Sitting): Step {
  const pass = sitting.entries[sitting.entries.length - 1];
  if (!sitting.breathTaken && pass?.passIndex === 0) return "breathe";
  if (!pass?.bodyLocation) return "place";
  if (!pass.bodyTexture) return "texture";
  if (!pass.feelingWord) return "name";
  return "need";
}

/**
 * The quiet controls — skip, back, dismiss, add another.
 *
 * They are visually understated on purpose: finishing is the primary action and
 * these must not compete with it. But understated is a *visual* property, and
 * rendering them as bare 16px-tall text made them genuinely hard to hit on a
 * phone. That matters more here than it would elsewhere — "offer, never force"
 * is only true if the skip is reachable, and the catch is only a catch rather
 * than a quiz if you can actually decline it.
 *
 * So: full 44px touch target, unchanged appearance. The negative margin keeps
 * the padding from opening up the layout around them.
 */
function QuietAction({
  onClick,
  disabled,
  underline = true,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  underline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`-my-2 inline-flex min-h-11 items-center py-2 text-xs text-muted-foreground disabled:opacity-50 ${
        underline ? "underline" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Hints are authored as questions ("hurt?", «رنجیده؟») because an assertion would
 * be the app substituting its taxonomy for the person's own reading. The question
 * mark is the offer; it is not part of the word being recorded.
 *
 * Both marks: Persian ends a question with «؟» (U+061F), and matching only the
 * ASCII `?` left the mark on the word. It carried into the need prompt as «این
 * رنجیده؟ —» and — worse, because it outlives the sitting — into the stored
 * entry and the history page. A record of what someone called their own state
 * has no business having a question mark in it.
 */
function stripQuestion(hint: string) {
  return hint.replace(/[?؟]+$/, "").trim();
}

function Dots({ current }: { current: Step }) {
  const i = STEP_DOTS.indexOf(current);
  return (
    <div className="flex justify-end gap-1.5">
      {STEP_DOTS.map((s, n) => (
        <span
          key={s}
          className={`h-1.5 w-1.5 rounded-full ${n <= i ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function Chips({
  options,
  selectedId,
  onPick,
  disabled,
  escape,
}: {
  options: PaletteEntry[];
  selectedId: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
  escape?: { label: string; active: boolean; onClick: () => void };
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          disabled={disabled}
          onClick={() => onPick(o.id)}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
            selectedId === o.id
              ? "border-primary bg-primary/10 text-primary"
              : "bg-muted/40 text-muted-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
      {escape && (
        <button
          onClick={escape.onClick}
          className={`rounded-full border border-dashed px-3 py-1.5 text-sm ${
            escape.active ? "border-primary text-primary" : "text-muted-foreground"
          }`}
        >
          {escape.label}
        </button>
      )}
    </div>
  );
}

/** feeling → need, on one line. Never two feelings on one line. */
function PairLine({ feeling, need }: { feeling: string; need: string }) {
  const { leadsTo } = useArrows();
  if (!feeling && !need) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full bg-muted/60 px-3 py-1">{feeling || "—"}</span>
      {need && (
        <>
          <span className="text-muted-foreground">{leadsTo}</span>
          <span className="rounded-full bg-muted/60 px-3 py-1">{need}</span>
        </>
      )}
    </div>
  );
}

function StepBack({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const { back } = useArrows();
  return (
    <QuietAction underline={false} onClick={onClick}>
      {back} {t("learn.feelingsNeeds.nav.back")}
    </QuietAction>
  );
}

/**
 * Skip and back on one row, pushed apart.
 *
 * They are both bare inline buttons, so stacking them in a `space-y` column ran
 * them together into "not sure — skip← back". Skip is the more important of the
 * two — it is how "offered, never forced" is actually exercised — so it leads.
 */
function StepFooter({
  skipLabel,
  onSkip,
  onBack,
}: {
  skipLabel: string;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <QuietAction onClick={onSkip}>{skipLabel}</QuietAction>
      <StepBack onClick={onBack} />
    </div>
  );
}

function BreathRing() {
  return (
    <div className="relative h-24 w-24">
      <div className="absolute inset-0 rounded-full border" />
      <div className="fn-breathe absolute inset-4 rounded-full border border-primary/60 bg-primary/10" />
    </div>
  );
}

/**
 * Scoped keyframes. The breath is a visual cue with no countdown and nothing to
 * complete — if it ever acquires a timer it has become the meditation feature
 * this module is explicitly not.
 */
function BreatheKeyframes() {
  return (
    <style>{`
      @keyframes fnBreathe { 0%,100% { transform: scale(.62) } 50% { transform: scale(1) } }
      .fn-breathe { animation: fnBreathe 6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .fn-breathe { animation: none } }
    `}</style>
  );
}
