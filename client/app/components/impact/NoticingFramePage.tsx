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
  COMPLETE_NOTICING_FRAME,
  GET_NOTICING_CONTENT,
  GET_NOTICING_FRAME,
  UPDATE_NOTICING_FRAME,
} from "~/api/queries";

/**
 * The day-one frame (spec §4.1). Tier 1, once, two beats — beat 1 is five
 * steps, beat 2 is the welcome prediction. Ends in the loop, not a summary
 * (spec §4.1): the last thing this page does on success is navigate to
 * `/tools/impact/noticing/loop`, not render a "you're done" screen.
 *
 * **Step 4 (the turn) is the one this file has to get exactly right.** It
 * shows no question and takes no input — it reads back the person's own
 * step-2 and step-3 answers, straight from the committed `frame` row rather
 * than from any local draft state, so it can never render anything they
 * didn't actually write. Rendering from local state would risk showing an
 * uncommitted keystroke as if it were their answer; reading the server's own
 * record is what keeps this step a description rather than a claim (see
 * `content/noticing/v1/surface.en.ts`'s file-level docblock on why beat 1
 * was rebuilt from two steps to five in the first place).
 *
 * **The reroute (`can't think of one`) is a first-class path, not a fallback
 * mode.** Choosing it sets `wishedInstead` locally, which is committed
 * alongside the moment text at step 1 and carried through unchanged for the
 * rest of beat 1. Two pieces of copy have a distinct variant for this path
 * (`moment.wishedPrompt`, `turn.wishedLine`) because their ordinary wording
 * asserts that someone actually made the connection — true on the ordinary
 * path by construction, false on this one. Everything else in beat 1 already
 * works unchanged for both paths (see the build log's phase-4 notes on why).
 *
 * Every step commits as it goes, same convention as `NoticingLoopPage.tsx`
 * and `services/noticing/session.ts` — there is no "submit the frame"
 * mutation, so a closed tab loses at most the step in progress. The one step
 * that commits nothing is "the reverse": `NoticingFrame` has no field for
 * that pick (spec's own data model doesn't carry it), because nothing
 * downstream reads it — it only exists to show a tailored response once.
 *
 * Gated to once, idempotently, but not hidden: landing here after the frame
 * is already complete shows a short static card instead of the wizard,
 * rather than either silently re-running it or redirecting away. The home
 * page (`NoticingPage.tsx`) already stops offering the frame card once
 * `frameDone` is true — this is the defensive second layer for a direct
 * visit (a bookmark, a back-button) after that.
 */

type PaletteEntry = { id: string; label: string };

type FrameProgress = {
  moment: string | null;
  unsaidNeed: string | null;
  visibleCues: string | null;
  wishedInstead: boolean;
  welcomeGuess: string | null;
  completedAt: string | null;
};

type FrameCopy = {
  intro: { title: string; body: string; begin: string };
  beatOne: {
    moment: {
      prompt: string;
      helper: string | null;
      reroutePrompt: string;
      rerouteLabel: string;
      wishedPrompt: string;
    };
    unsaidNeed: { prompt: string; helper: string | null; otherLabel: string };
    visibleCues: { prompt: string; helper: string | null; otherLabel: string };
    turn: { line: string; wishedLine: string };
    reverse: {
      prompt: string;
      knowLabel: string;
      noIdeaLabel: string;
      knowResponse: string;
      noIdeaResponse: string;
    };
  };
  beatTwo: {
    prompt: string;
    options: { id: string; label: string }[];
    correction: { lineByGuess: { notVery: string; somewhat: string; very: string }; body: string };
  };
};

type Content = {
  needs: PaletteEntry[];
  cues: PaletteEntry[];
  display: { needIds: string[] };
  frame: FrameCopy;
};

type Step =
  | "intro"
  | "moment"
  | "unsaidNeed"
  | "visibleCues"
  | "turn"
  | "reverse"
  | "guess"
  | "correction";

// Beat 1's five steps, for the position dots. Beat 2 (guess/correction) has
// none, same as the wireframe: a guess-and-a-finding isn't a sequence with a
// position worth marking.
const BEAT_ONE_DOTS: Step[] = ["moment", "unsaidNeed", "visibleCues", "turn", "reverse"];

type VisibleCuesValue = { chips: string[]; other: string | null };

function parseVisibleCues(raw: string | null | undefined): VisibleCuesValue {
  if (!raw) return { chips: [], other: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      chips: Array.isArray(parsed.chips) ? parsed.chips.filter((c: unknown) => typeof c === "string") : [],
      other: typeof parsed.other === "string" ? parsed.other : null,
    };
  } catch {
    return { chips: [], other: null };
  }
}

/** "not_very" (the persisted id) → "notVery" (the GraphQL/content field key). */
function guessKey(id: string): "notVery" | "somewhat" | "very" {
  return id === "not_very" ? "notVery" : (id as "somewhat" | "very");
}

/**
 * Where to resume. `frame` commits step by step but has no field for "the
 * reverse" (nothing downstream reads that pick), so a person who has
 * answered the guess but not yet seen the correction resumes there directly
 * rather than being routed back through turn/reverse again.
 */
function resumeStep(frame: FrameProgress | null): Step {
  if (!frame || !frame.moment) return "intro";
  if (!frame.unsaidNeed) return "unsaidNeed";
  if (!frame.visibleCues) return "visibleCues";
  if (!frame.welcomeGuess) return "turn";
  return "correction";
}

export default function NoticingFramePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [content, setContent] = useState<Content | null>(null);
  const [frame, setFrame] = useState<FrameProgress | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [wishedInstead, setWishedInstead] = useState(false);
  const [momentText, setMomentText] = useState("");

  const [needOwn, setNeedOwn] = useState(false);
  const [needOwnText, setNeedOwnText] = useState("");

  const [cueIds, setCueIds] = useState<string[]>([]);
  const [cueOwnActive, setCueOwnActive] = useState(false);
  const [cueOwnText, setCueOwnText] = useState("");

  const [reversePick, setReversePick] = useState<"know" | "no_idea" | null>(null);
  const [guessId, setGuessId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [c, f] = await Promise.all([
      call({ query: GET_NOTICING_CONTENT }),
      call({ query: GET_NOTICING_FRAME }),
    ]);
    if (!c?.noticingContent) {
      setFailed(true);
      return;
    }
    setContent(c.noticingContent);
    const progress: FrameProgress | null = f?.noticingFrame ?? null;
    setFrame(progress);
    setWishedInstead(progress?.wishedInstead ?? false);
    setGuessId(progress?.welcomeGuess ?? null);
    setStep(resumeStep(progress));
  }, [call]);

  // Nothing here writes on mount (unlike the loop, which opens a sitting) —
  // still guarded against a double fire so dev-mode's double-invoked mount
  // effect doesn't fire the query pair twice for no reason.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void load();
  }, [load]);

  // Re-hydrate free-text drafts from the server's own record whenever a step
  // becomes active — same reasoning as NoticingLoopPage: "back" (or a resume
  // after a closed tab) shows what's actually committed, not a stale local
  // draft. A field with no committed value that isn't one of the palette ids
  // is treated as "their own text" so the escape re-opens already filled in.
  useEffect(() => {
    if (!content) return;
    if (step === "moment") setMomentText(frame?.moment ?? "");
    if (step === "unsaidNeed") {
      const val = frame?.unsaidNeed ?? null;
      const isOwn = !!val && !content.needs.some((n) => n.id === val);
      setNeedOwn(isOwn);
      setNeedOwnText(isOwn ? (val as string) : "");
    }
    if (step === "visibleCues") {
      const parsed = parseVisibleCues(frame?.visibleCues);
      setCueIds(parsed.chips);
      setCueOwnActive(!!parsed.other);
      setCueOwnText(parsed.other ?? "");
    }
  }, [step, frame, content]);

  const commitFrame = useCallback(
    async (fields: Record<string, unknown>, next?: Step) => {
      setBusy(true);
      const res = await call({ query: UPDATE_NOTICING_FRAME, variables: fields });
      setBusy(false);
      if (!res?.updateNoticingFrame) {
        setFailed(true);
        return null;
      }
      const updated: FrameProgress = res.updateNoticingFrame;
      setFrame(updated);
      if (next) setStep(next);
      return updated;
    },
    [call]
  );

  const finish = useCallback(async () => {
    setBusy(true);
    const res = await call({ query: COMPLETE_NOTICING_FRAME });
    setBusy(false);
    if (!res?.completeNoticingFrame) {
      setFailed(true);
      return;
    }
    // Ends in the loop, not a summary (spec §4.1) — no "you're done" screen.
    navigate("/tools/impact/noticing/loop");
  }, [call, navigate]);

  const labelOf = (pool: PaletteEntry[], id: string | null) =>
    (id && pool.find((e) => e.id === id)?.label) || id || "";
  const shown = (pool: PaletteEntry[], ids: string[]) =>
    ids.map((id) => pool.find((e) => e.id === id)).filter(Boolean) as PaletteEntry[];

  // Step 4 reads the COMMITTED row, never local draft state — see the file
  // docblock on why that distinction is the whole reason this file exists.
  const cuesText = useMemo(() => {
    if (!content || !frame?.visibleCues) return "";
    const parsed = parseVisibleCues(frame.visibleCues);
    const labels = parsed.chips.map((id) => labelOf(content.cues, id)).filter(Boolean);
    if (parsed.other) labels.push(parsed.other);
    return labels.join(", ");
  }, [content, frame]);

  const needText = useMemo(() => {
    if (!content || !frame?.unsaidNeed) return "";
    return labelOf(content.needs, frame.unsaidNeed);
  }, [content, frame]);

  const correctionLine = useMemo(() => {
    if (!content || !guessId) return "";
    return content.frame.beatTwo.correction.lineByGuess[guessKey(guessId)] ?? "";
  }, [content, guessId]);

  if (failed) {
    return (
      <InternalPageLayout title={t("impact.noticing.frame.cardTitle")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("impact.noticing.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("impact.noticing.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!content) return <LoadingBlock />;

  // Gated to once. Not a redirect — a short static card instead of the
  // wizard, so a direct visit after completion doesn't silently re-run a
  // one-time thing (house rule) but also isn't treated as an error.
  if (frame?.completedAt) {
    return (
      <InternalPageLayout title={t("impact.noticing.frame.cardTitle")}>
        <div className="mx-auto max-w-md space-y-3 rounded-lg border bg-card p-6 text-center">
          <p className="text-sm font-medium">{t("impact.noticing.frame.alreadyDoneTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("impact.noticing.frame.alreadyDoneBody")}</p>
          <Button variant="outline" onClick={() => navigate("/tools/impact/noticing")}>
            {t("impact.noticing.backToNoticing")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  const beatOne = content.frame.beatOne;
  const beatTwo = content.frame.beatTwo;

  return (
    <InternalPageLayout title={t("impact.noticing.frame.cardTitle")}>
      <div className="mx-auto flex min-h-[24rem] max-w-md flex-col gap-5">
        {BEAT_ONE_DOTS.includes(step) && <Dots current={step} />}

        {step === "intro" && (
          <section className="flex flex-1 flex-col justify-center space-y-5 text-center">
            <h2 className="text-lg font-semibold">{content.frame.intro.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{content.frame.intro.body}</p>
            <div>
              <Button onClick={() => setStep("moment")}>{content.frame.intro.begin}</Button>
            </div>
          </section>
        )}

        {step === "moment" && (
          <section className="space-y-4">
            <p className="text-sm">{wishedInstead ? beatOne.moment.wishedPrompt : beatOne.moment.prompt}</p>
            {beatOne.moment.helper && (
              <p className="text-xs text-muted-foreground">{beatOne.moment.helper}</p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!momentText.trim()) return;
                void commitFrame({ moment: momentText.trim(), wishedInstead }, "unsaidNeed");
              }}
            >
              <Input autoFocus value={momentText} onChange={(e) => setMomentText(e.target.value)} />
              <Button type="submit" disabled={busy || !momentText.trim()}>
                {t("impact.noticing.nav.next")}
              </Button>
            </form>
            {/* The reroute is a first-class path, taken once — there is no
                way back to the ordinary prompt after choosing it, same
                register as the loop's "not sure" being a committing pick
                rather than a toggle. */}
            {!wishedInstead && (
              <div className="pt-1 text-xs text-muted-foreground">
                {beatOne.moment.reroutePrompt}{" "}
                <button type="button" className="underline" onClick={() => setWishedInstead(true)}>
                  {beatOne.moment.rerouteLabel}
                </button>
              </div>
            )}
          </section>
        )}

        {step === "unsaidNeed" && (
          <section className="space-y-4">
            <p className="text-sm">{beatOne.unsaidNeed.prompt}</p>
            {beatOne.unsaidNeed.helper && (
              <p className="text-xs text-muted-foreground">{beatOne.unsaidNeed.helper}</p>
            )}
            <Chips
              options={shown(content.needs, content.display.needIds)}
              selectedId={needOwn ? null : frame?.unsaidNeed ?? null}
              disabled={busy}
              onPick={(id) => void commitFrame({ unsaidNeed: id }, "visibleCues")}
              escape={{ label: beatOne.unsaidNeed.otherLabel, active: needOwn, onClick: () => setNeedOwn(true) }}
            />
            {needOwn && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!needOwnText.trim()) return;
                  void commitFrame({ unsaidNeed: needOwnText.trim() }, "visibleCues");
                }}
              >
                <Input
                  autoFocus
                  value={needOwnText}
                  onChange={(e) => setNeedOwnText(e.target.value)}
                  placeholder={beatOne.unsaidNeed.otherLabel}
                />
                <Button type="submit" disabled={busy || !needOwnText.trim()}>
                  {t("impact.noticing.nav.next")}
                </Button>
              </form>
            )}
          </section>
        )}

        {step === "visibleCues" && (
          <section className="space-y-4">
            <p className="text-sm">{beatOne.visibleCues.prompt}</p>
            {beatOne.visibleCues.helper && (
              <p className="text-xs text-muted-foreground">{beatOne.visibleCues.helper}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {content.cues.map((c) => {
                const selected = cueIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setCueIds((prev) => (selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCueOwnActive(true)}
                className={`rounded-full border border-dashed px-3 py-1.5 text-sm ${
                  cueOwnActive ? "border-primary text-primary" : "text-muted-foreground"
                }`}
              >
                {beatOne.visibleCues.otherLabel}
              </button>
            </div>
            {cueOwnActive && (
              <Input
                autoFocus
                value={cueOwnText}
                onChange={(e) => setCueOwnText(e.target.value)}
                placeholder={beatOne.visibleCues.otherLabel}
              />
            )}
            <div className="pt-2">
              <Button
                disabled={busy || (cueIds.length === 0 && !cueOwnText.trim())}
                onClick={() =>
                  void commitFrame(
                    { visibleCues: JSON.stringify({ chips: cueIds, other: cueOwnText.trim() || null }) },
                    "turn"
                  )
                }
              >
                {t("impact.noticing.nav.next")}
              </Button>
            </div>
          </section>
        )}

        {step === "turn" && (
          <section className="space-y-5">
            <PairLine left={cuesText} right={needText} />
            <p className="text-sm leading-relaxed">
              {wishedInstead ? beatOne.turn.wishedLine : beatOne.turn.line}
            </p>
            <div className="pt-2">
              <Button onClick={() => setStep("reverse")}>{t("impact.noticing.nav.next")}</Button>
            </div>
          </section>
        )}

        {step === "reverse" && (
          <section className="space-y-4">
            <p className="text-sm">{beatOne.reverse.prompt}</p>
            {!reversePick ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReversePick("know")}
                  className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  {beatOne.reverse.knowLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setReversePick("no_idea")}
                  className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  {beatOne.reverse.noIdeaLabel}
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-accent/10 p-3 text-sm leading-relaxed">
                  {reversePick === "know" ? beatOne.reverse.knowResponse : beatOne.reverse.noIdeaResponse}
                </div>
                <div className="pt-2">
                  <Button onClick={() => setStep("guess")}>{t("impact.noticing.nav.next")}</Button>
                </div>
              </>
            )}
          </section>
        )}

        {step === "guess" && (
          <section className="space-y-4">
            <p className="text-sm">{beatTwo.prompt}</p>
            <div className="flex flex-wrap gap-2">
              {beatTwo.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setGuessId(o.id);
                    void commitFrame({ welcomeGuess: o.id }, "correction");
                  }}
                  className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "correction" && (
          <section className="space-y-4">
            <p className="text-sm">{correctionLine}</p>
            <div className="rounded-lg bg-accent/10 p-3 text-sm leading-relaxed">
              {beatTwo.correction.body}
            </div>
            {/* Ends in the loop, not a summary — this button both completes
                the frame and carries straight into the loop's own first
                question, rather than showing a "frame complete!" screen
                that duplicates copy the loop already owns. */}
            <div className="pt-2 text-center">
              <Button disabled={busy} onClick={() => void finish()}>
                {t("impact.noticing.loop.start")}
              </Button>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

function Dots({ current }: { current: Step }) {
  const i = BEAT_ONE_DOTS.indexOf(current);
  return (
    <div className="flex justify-end gap-1.5">
      {BEAT_ONE_DOTS.map((s, n) => (
        <span key={s} className={`h-1.5 w-1.5 rounded-full ${n <= i ? "bg-primary" : "bg-border"}`} />
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

/** cue(s) → need, on one line — the turn's whole visual, and nothing else. */
function PairLine({ left, right }: { left: string; right: string }) {
  const { leadsTo } = useArrows();
  if (!left && !right) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full bg-muted/60 px-3 py-1">{left || "—"}</span>
      {right && (
        <>
          <span className="text-muted-foreground">{leadsTo}</span>
          <span className="rounded-full bg-muted/60 px-3 py-1">{right}</span>
        </>
      )}
    </div>
  );
}
