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
  ACKNOWLEDGE_NOTICING_GRADUATION,
  ADD_NOTICING_PASS,
  FINISH_NOTICING_SITTING,
  GET_ACTIVE_NOTICING_SITTING,
  GET_NOTICING_CONTENT,
  SET_NOTICING_CAPACITY,
  SET_NOTICING_MOTIVE,
  START_NOTICING_SITTING,
  UPDATE_NOTICING_ENTRY,
} from "~/api/queries";

/**
 * The noticing loop — the spine (spec §4.2). This is the phase that matters:
 * if this doesn't feel like noticing a person, no later phase rescues it
 * (build plan §9, §10).
 *
 * place → person → observation → need → an optional small thing, then close.
 * Optionally repeat for another distinct person (soft-capped), then a
 * side-by-side recap.
 *
 * Two things this component deliberately does not do, same as
 * `FeelingsNeedsLoopPage.tsx`. It never holds a finished loop in local state
 * waiting for a submit — every step fires its own mutation, so closing the
 * tab loses at most the step in progress. And it never puts two passes in
 * the same sentence: the recap lays them out beside one another and says
 * outright that connecting them comes later.
 *
 * No breathe step (Noticing has none — spec §4.2's table starts at place),
 * no timer, and nothing marked "done" beyond the position dots, which are
 * position, not progress.
 */

type PaletteEntry = { id: string; label: string };
type Entry = {
  id: string;
  passIndex: number;
  place: string | null;
  person: string | null;
  observation: string | null;
  need: string | null;
  smallThing: string | null;
  capacityTags: string | null;
  motiveNote: string | null;
};
type Sitting = { id: string; completedAt: string | null; entries: Entry[] };

/** A catch that just fired (N6, tier 3, phase 5), composed server-side. */
type SurfacedCatch = {
  type: string;
  line: string;
  hints: string[];
  dismiss: string;
  note: string;
  routeTo: string | null;
};

type FrameStep = { prompt: string; helper: string | null };

/** Head / hands / heart — accreted from what the person HAD, never who they helped (phase 6). */
type CapacityCopy = {
  prompt: string;
  headChips: PaletteEntry[];
  handsChips: PaletteEntry[];
  heartChips: PaletteEntry[];
  otherLabel: string;
};

/** The Reflect handoff's own copy (spec §4.6) — thin, since Reflect is unbuilt. */
type ReflectCopy = {
  prompt: string;
  capacityLabel: string;
  obligationLabel: string;
  skip: string;
};

/** The one-time capability door's copy (spec §4.5, phase 7). A door, not a score. */
type Graduation = { line: string; body: string; close: string };

type Content = {
  repeatSoftCap: number;
  places: PaletteEntry[];
  cues: PaletteEntry[];
  needs: PaletteEntry[];
  display: { needIds: string[] };
  loop: LoopCopy;
  capacity: CapacityCopy;
  reflect: ReflectCopy;
  frame: unknown; // Not read here — the frame page (phase 4) owns that half of the pack.
};

type LoopCopy = {
  placePrompt: string;
  placeOtherLabel: string;
  personPrompt: string;
  personThirdPartyWarning: string;
  observationPrompt: string;
  needPrompt: string;
  needOtherLabel: string;
  needNotSure: string;
  smallThingPrompt: string;
  smallThingSkip: string;
  close: string;
  addAnotherAsk: string;
  addAnotherCapped: string;
  finish: string;
  recapHeading: string;
  recapNotRelated: string;
};

type Step =
  | "place"
  | "person"
  | "observation"
  | "need"
  | "small"
  | "catch"
  | "close"
  | "recap"
  | "graduated";

// Position, not progress — the dots say where you are in the shape of a
// pass, not how much is "done". A pass that ends at "need" (not sure) is
// complete, not partway through a bar that implies more is owed.
const STEP_DOTS: Step[] = ["place", "person", "observation", "need", "small"];

export default function NoticingLoopPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [content, setContent] = useState<Content | null>(null);
  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [step, setStep] = useState<Step>("place");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Set once, from finishSitting's own result — never fetched separately.
  // finishSitting only DECIDES the door is due; it stays due until this
  // component acknowledges it on dismissal (closeGraduation below), so a
  // person who never saw this render is offered it again next time.
  const [graduation, setGraduation] = useState<Graduation | null>(null);
  // Waved off for this pass only, and never written anywhere: skipping the
  // motive line is not an answer to it (spec §4.6 — nothing in Noticing is
  // gated on it, and a stored 'declined' would be a record of a refusal).
  const [motiveWaved, setMotiveWaved] = useState(false);

  /**
   * Retire the door, then leave.
   *
   * The acknowledge is what writes `graduationSurfaced`, so it happens here
   * — when the person has actually seen the screen and dismissed it — rather
   * than when the server decided the door was due. Navigation does not wait
   * on it and does not care if it fails: an unacknowledged door is re-offered
   * at the next sitting close, which is the failure mode we want.
   */
  const closeGraduation = useCallback(async () => {
    try {
      await call({ query: ACKNOWLEDGE_NOTICING_GRADUATION });
    } catch {
      // Deliberately swallowed — see above.
    }
    navigate("/tools/impact/noticing");
  }, [call, navigate]);

  const [placeOwn, setPlaceOwn] = useState(false);
  const [placeOwnText, setPlaceOwnText] = useState("");
  const [personText, setPersonText] = useState("");
  const [observationText, setObservationText] = useState("");
  const [needOwn, setNeedOwn] = useState(false);
  const [needOwnText, setNeedOwnText] = useState("");
  const [smallText, setSmallText] = useState("");
  const [capacityOwn, setCapacityOwn] = useState(false);
  const [capacityOwnText, setCapacityOwnText] = useState("");
  // `followUp` is wherever this commit's own `next` would have gone had no
  // catch fired — the catch is an interruption, not a step, so dismissing
  // it (or taking a hint) always resumes exactly where the pass was headed.
  // `triggeredField` is which field this commit was writing when the catch
  // fired — needed so a hint can never overwrite an already-answered `need`
  // with a suggestion offered about a DIFFERENT field (coordinator review,
  // phase 5): a strategy catch on `smallThing` must not let its hint clobber
  // a `need` the person already chose for themselves.
  const [pendingCatch, setPendingCatch] = useState<
    (SurfacedCatch & { followUp: Step; triggeredField: "observation" | "need" | "smallThing" | null }) | null
  >(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [c, a] = await Promise.all([
      call({ query: GET_NOTICING_CONTENT }),
      call({ query: GET_ACTIVE_NOTICING_SITTING }),
    ]);
    if (!c?.noticingContent) {
      setFailed(true);
      return;
    }
    setContent(c.noticingContent);

    const existing: Sitting | null = a?.activeNoticingSitting ?? null;
    if (existing) {
      setSitting(existing);
      setStep(resumeStep(existing));
      return;
    }
    const started = await call({ query: START_NOTICING_SITTING, variables: { wasPrompted: false } });
    if (!started?.startNoticingSitting) {
      setFailed(true);
      return;
    }
    setSitting(started.startNoticingSitting);
    setStep("place");
  }, [call]);

  // Opening a sitting is a write, so this effect must fire exactly once —
  // same reasoning as FeelingsNeedsLoopPage: React double-invokes mount
  // effects in development, and the server's own race guard (userLock,
  // D-57) makes a double open harmless but not free.
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

  // Re-hydrate the free-text drafts from the server's own record whenever a
  // step becomes active — this is what makes "back" honest: the field shows
  // what was actually committed for this pass, not whatever was last typed
  // into the box across a different pass or a different visit to the step.
  useEffect(() => {
    if (!pass) return;
    if (step === "person") setPersonText(pass.person ?? "");
    if (step === "observation") setObservationText(pass.observation ?? "");
    if (step === "small") setSmallText(pass.smallThing ?? "");
  }, [step, pass]);

  /**
   * Commit one step of the current pass. Separate from a plain "always go to
   * `next`" helper because naming an observation, a need or a small thing can
   * surface a catch (N6, tier 3, phase 5) — and when it does, the catch takes
   * precedence over wherever the step was headed, the same way
   * `FeelingsNeedsLoopPage.tsx`'s own catch interrupts its loop. It never
   * blocks: `followUp` (below) always carries the step this commit would
   * have gone to anyway, so dismissing the catch loses nothing.
   */
  const commitEntry = useCallback(
    async (fields: Record<string, unknown>, next?: Step) => {
      if (!pass) return null;
      setBusy(true);
      const res = await call({ query: UPDATE_NOTICING_ENTRY, variables: { entryId: pass.id, ...fields } });
      setBusy(false);
      if (!res?.updateNoticingEntry?.sitting) {
        setFailed(true);
        return null;
      }
      const updated = res.updateNoticingEntry.sitting as Sitting;
      const surfaced: SurfacedCatch | null = res.updateNoticingEntry.catch ?? null;
      setSitting(updated);
      if (surfaced && next) {
        const triggeredField = (["observation", "need", "smallThing"] as const).find((f) => f in fields) ?? null;
        setPendingCatch({ ...surfaced, followUp: next, triggeredField });
        setStep("catch");
      } else if (next) {
        setStep(next);
      }
      return updated;
    },
    [call, pass]
  );

  /**
   * The post-offer capacity question (spec §4.2, §4.6; phase 6) — its own
   * mutation, not `commitEntry`: `capacityTags` isn't in any catch type's
   * `matchesFields`, so there's no catch to interrupt for, and no result
   * wrapper to unwrap.
   */
  const commitCapacity = useCallback(
    async (capacityTags: string, next: Step) => {
      if (!pass) return;
      setBusy(true);
      const res = await call({ query: SET_NOTICING_CAPACITY, variables: { entryId: pass.id, capacityTags } });
      setBusy(false);
      if (!res?.setNoticingCapacity) {
        setFailed(true);
        return;
      }
      setSitting(res.setNoticingCapacity as Sitting);
      setStep(next);
    },
    [call, pass]
  );

  /** The Reflect handoff's motive answer (spec §4.6, phase 6) — a link-out stub, nothing computed from it. */
  const commitMotive = useCallback(
    async (motiveNote: string, next: Step) => {
      if (!pass) return;
      setBusy(true);
      const res = await call({ query: SET_NOTICING_MOTIVE, variables: { entryId: pass.id, motiveNote } });
      setBusy(false);
      if (!res?.setNoticingMotive) {
        setFailed(true);
        return;
      }
      setSitting(res.setNoticingMotive as Sitting);
      setStep(next);
    },
    [call, pass]
  );

  /**
   * Close the sitting and decide where it lands. Three destinations, in
   * order of precedence: the recap when the sitting held more than one pass,
   * the capability door when this run is the one that earned it, and
   * otherwise straight home. The door is held back until after the recap so
   * a plural sitting still gets its side-by-side view first — same
   * precedence as `FeelingsNeedsLoopPage.tsx`'s own finishSitting.
   */
  const finishSitting = useCallback(async () => {
    if (!sitting) return;
    setBusy(true);
    const res = await call({ query: FINISH_NOTICING_SITTING, variables: { sittingId: sitting.id } });
    setBusy(false);
    if (!res?.finishNoticingSitting?.sitting) {
      setFailed(true);
      return;
    }
    const { sitting: done, graduation: earned } = res.finishNoticingSitting;
    setSitting(done as Sitting);
    if (earned) setGraduation(earned as Graduation);

    if (done.entries.length > 1) setStep("recap");
    else if (earned) setStep("graduated");
    else navigate("/tools/impact/noticing");
  }, [call, sitting, navigate]);

  if (failed) {
    return (
      <InternalPageLayout title={t("impact.noticing.loop.cardTitle")}>
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("impact.noticing.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("impact.noticing.errors.retry")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (!content || !sitting || !pass) return <LoadingBlock />;

  const c = content.loop;
  const labelOf = (pool: PaletteEntry[], id: string | null) =>
    (id && pool.find((e) => e.id === id)?.label) || id || "";
  const shown = (pool: PaletteEntry[], ids: string[]) =>
    ids.map((id) => pool.find((e) => e.id === id)).filter(Boolean) as PaletteEntry[];

  const isRepeat = pass.passIndex > 0;
  const atCap = sitting.entries.length >= content.repeatSoftCap;

  return (
    <InternalPageLayout title={t("impact.noticing.loop.cardTitle")}>
      <div className="mx-auto flex min-h-[24rem] max-w-md flex-col gap-5">
        {STEP_DOTS.includes(step) && <Dots current={step} />}

        {step === "place" && (
          <section className="space-y-4">
            <p className="text-sm">{c.placePrompt}</p>
            <Chips
              options={content.places}
              selectedId={placeOwn ? null : pass.place}
              disabled={busy}
              onPick={(id) => void commitEntry({ place: id }, "person")}
              escape={{ label: c.placeOtherLabel, active: placeOwn, onClick: () => setPlaceOwn(true) }}
            />
            {placeOwn && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!placeOwnText.trim()) return;
                  void commitEntry({ place: placeOwnText.trim() }, "person");
                }}
              >
                <Input
                  autoFocus
                  value={placeOwnText}
                  onChange={(e) => setPlaceOwnText(e.target.value)}
                  placeholder={c.placeOtherLabel}
                />
                <Button type="submit" disabled={busy || !placeOwnText.trim()}>
                  {t("impact.noticing.nav.next")}
                </Button>
              </form>
            )}
          </section>
        )}

        {step === "person" && (
          <section className="space-y-3">
            <p className="text-sm">{c.personPrompt}</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!personText.trim()) return;
                void commitEntry({ person: personText.trim() }, "observation");
              }}
            >
              <Input
                autoFocus
                value={personText}
                onChange={(e) => setPersonText(e.target.value)}
              />
              <Button type="submit" disabled={busy || !personText.trim()}>
                {t("impact.noticing.nav.next")}
              </Button>
            </form>
            {/* Persistent, quiet, under the field — not a modal and not
                dismissible-forever (spec §7). */}
            <p className="text-xs text-muted-foreground">{c.personThirdPartyWarning}</p>
            <StepBack onClick={() => setStep("place")} />
          </section>
        )}

        {step === "observation" && (
          <section className="space-y-3">
            <p className="text-sm">{c.observationPrompt}</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!observationText.trim()) return;
                void commitEntry({ observation: observationText.trim() }, "need");
              }}
            >
              <Input
                autoFocus
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
              />
              <Button type="submit" disabled={busy || !observationText.trim()}>
                {t("impact.noticing.nav.next")}
              </Button>
            </form>
            <StepBack onClick={() => setStep("person")} />
          </section>
        )}

        {step === "need" && (
          <section className="space-y-4">
            <p className="text-sm">{c.needPrompt}</p>
            <Chips
              options={shown(content.needs, content.display.needIds)}
              selectedId={needOwn ? null : pass.need}
              disabled={busy}
              onPick={(id) => void commitEntry({ need: id }, "small")}
              escape={{ label: c.needOtherLabel, active: needOwn, onClick: () => setNeedOwn(true) }}
            />
            {needOwn && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!needOwnText.trim()) return;
                  void commitEntry({ need: needOwnText.trim() }, "small");
                }}
              >
                <Input
                  autoFocus
                  value={needOwnText}
                  onChange={(e) => setNeedOwnText(e.target.value)}
                  placeholder={c.needOtherLabel}
                />
                <Button type="submit" disabled={busy || !needOwnText.trim()}>
                  {t("impact.noticing.nav.next")}
                </Button>
              </form>
            )}
            {/* "not sure" is a complete pass, not a missing answer (spec §4.2) —
                it clears the field rather than leaving it whatever it was. */}
            <StepFooter
              skipLabel={c.needNotSure}
              onSkip={() => void commitEntry({ need: null }, "small")}
              onBack={() => setStep("observation")}
            />
          </section>
        )}

        {step === "small" && (
          <section className="space-y-4">
            <p className="text-sm">{c.smallThingPrompt}</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = smallText.trim();
                // The capacity question (and, past it, the Reflect handoff)
                // only exists because there's an offered act to ask about
                // (spec §4.2) — skipping straight to "close" when nothing
                // was written is not a shortcut, it's the correct shape.
                void commitEntry({ smallThing: trimmed || null }, "close");
              }}
            >
              <Input value={smallText} onChange={(e) => setSmallText(e.target.value)} />
              <Button type="submit" disabled={busy}>
                {t("impact.noticing.nav.next")}
              </Button>
            </form>
            <StepFooter
              skipLabel={c.smallThingSkip}
              onSkip={() => setStep("close")}
              onBack={() => setStep("need")}
            />
          </section>
        )}

        {step === "catch" && pendingCatch && (
          <section className="space-y-4">
            {/* Their own word, quoted back — the contrast has to land on
                their material, not a canned example. The original text is
                never edited or blocked by this — it's already saved. */}
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3">
              <p className="text-sm leading-relaxed">{pendingCatch.line}</p>
            </div>

            {/* read and protective offer no hints at all — read hands the
                sentence back rather than replacing it, and protective
                routes to the (unbuilt) Reflect handoff instead of arguing.
                A hint may only ever FILL `need`, never REPLACE it (coordinator
                review, phase 5): if this strategy catch fired on `smallThing`
                and `need` is already answered, a hint here would silently
                overwrite that answer with a suggestion about a different
                field — a worse failure than the one the catch exists to fix.
                The line alone still does the teaching; the person can edit
                `need` themselves if it moved them. Firing ON `need` itself is
                unaffected — there, `need`'s current value IS the trigger
                phrase, not a separate answer to protect. */}
            {pendingCatch.hints.length > 0 &&
              !catchHintsBlockedByExistingNeed(pendingCatch.triggeredField, pass.need) && (
              <div className="flex flex-wrap gap-2">
                {pendingCatch.hints.map((hint) => (
                  <button
                    key={hint}
                    disabled={busy}
                    className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      const followUp = pendingCatch.followUp;
                      setPendingCatch(null);
                      void commitEntry({ need: stripQuestion(hint) }, followUp);
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}

            {/* Load-bearing, not politeness. A catch the person cannot
                decline is a quiz, and a quiz produces defensiveness instead
                of the contrast actually landing. */}
            <div className="flex items-center justify-between border-t pt-3">
              <QuietAction
                onClick={() => {
                  const followUp = pendingCatch.followUp;
                  setPendingCatch(null);
                  setStep(followUp);
                }}
              >
                {pendingCatch.dismiss}
              </QuietAction>
              <span className="text-[11px] text-muted-foreground">{pendingCatch.note}</span>
            </div>
          </section>
        )}

        {step === "close" && (
          <section className="space-y-5">
            <p className="text-sm">{c.close}</p>
            <PairLine observation={pass.observation ?? ""} need={labelOf(content.needs, pass.need)} />

            {/* Both of these belong to the close, not to the loop (spec §4.2:
                "the close adds one question and nothing else"). They were
                built as separate steps with their own headers, which made an
                offer feel like it had two more hoops after it. Inline and
                quiet instead: each disappears once answered, Finish is always
                on screen, so neither is ever owed.

                The motive line is the Reflect handoff (spec §4.6), kept here
                rather than on its own surface — but it is the one that must
                stay waveable. Asking "was this obligation?" after every kind
                act is the self-auditing the pillar warns about; the N6-c
                catch already routes the people whose own words raised it. */}
            {pass.smallThing && !pass.capacityTags && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">{content.capacity.prompt}</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { category: "head", chips: content.capacity.headChips },
                      { category: "hands", chips: content.capacity.handsChips },
                      { category: "heart", chips: content.capacity.heartChips },
                    ] as const
                  ).flatMap(({ category, chips }) =>
                    chips.map((chip) => (
                      <button
                        key={`${category}-${chip.id}`}
                        type="button"
                        disabled={busy}
                        className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                        onClick={() =>
                          void commitCapacity(JSON.stringify({ category, tag: chip.id }), "close")
                        }
                      >
                        {chip.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {pass.smallThing && !pass.motiveNote && !motiveWaved && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">{content.reflect.prompt}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={() => void commitMotive("capacity_and_care", "close")}
                  >
                    {content.reflect.capacityLabel}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                    onClick={() => void commitMotive("obligation", "close")}
                  >
                    {content.reflect.obligationLabel}
                  </button>
                  <QuietAction onClick={() => setMotiveWaved(true)}>
                    {content.reflect.skip}
                  </QuietAction>
                </div>
              </div>
            )}

            {/* Finishing is the primary action; the repeat is a quiet
                secondary — making it prominent would invite the inventory
                the soft cap exists to prevent. */}
            <div className="space-y-2 border-t pt-4">
              {atCap ? (
                <p className="text-xs text-muted-foreground">{c.addAnotherCapped}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{c.addAnotherAsk}</p>
                  <QuietAction
                    disabled={busy}
                    onClick={() => {
                      setPlaceOwn(false);
                      setPlaceOwnText("");
                      setNeedOwn(false);
                      setNeedOwnText("");
                      setSmallText("");
                      setMotiveWaved(false);
                      void (async () => {
                        setBusy(true);
                        const res = await call({
                          query: ADD_NOTICING_PASS,
                          variables: { sittingId: sitting.id },
                        });
                        setBusy(false);
                        if (!res?.addNoticingPass) {
                          setFailed(true);
                          return;
                        }
                        setSitting(res.addNoticingPass);
                        setStep("place");
                      })();
                    }}
                  >
                    + {t("impact.noticing.loop.addAnother")}
                  </QuietAction>
                </>
              )}
            </div>

            <div className="pt-2 text-center">
              <Button disabled={busy} onClick={() => void finishSitting()}>
                {c.finish}
              </Button>
            </div>
          </section>
        )}

        {step === "recap" && (
          <section className="space-y-4">
            <p className="text-sm font-medium">{c.recapHeading}</p>
            <div className="space-y-2">
              {sitting.entries.map((e) => (
                <PairLine
                  key={e.id}
                  observation={e.observation ?? ""}
                  need={labelOf(content.needs, e.need)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{c.recapNotRelated}</p>
            <div className="pt-2 text-center">
              <Button onClick={() => (graduation ? setStep("graduated") : navigate("/tools/impact/noticing"))}>
                {c.finish}
              </Button>
            </div>
          </section>
        )}

        {step === "graduated" && graduation && (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            {/* A door, not a score — there is no number on this screen, and
                nothing here can be taken back once it is acknowledged. The
                flag is written on the way out rather than on the way in: if
                this render never reached the person, the door is still owed
                and the next close offers it again. */}
            <div className="text-3xl text-primary" aria-hidden>
              ⌐
            </div>
            <p className="text-sm font-medium">{graduation.line}</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{graduation.body}</p>
            <p className="text-xs text-muted-foreground">{graduation.close}</p>
            <Button className="mt-4" onClick={() => void closeGraduation()}>
              {c.finish}
            </Button>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
}

/** Strip the trailing "?" a hint is always authored with, before it's committed as an answer. */
function stripQuestion(hint: string) {
  return hint.replace(/[?؟]+$/, "").trim();
}

/**
 * Whether a catch's hint chips must be hidden rather than offered (coordinator
 * review, phase 5). A hint may only ever FILL `need`, never REPLACE it: if a
 * strategy catch fired on `smallThing` while `need` already holds a separate,
 * previously-chosen answer, showing hints would let one tap silently
 * overwrite that answer with a suggestion about a different field — worse
 * than the thing the catch exists to fix. The line alone still teaches;
 * editing `need` afterward is the person's own choice, not the hint's.
 *
 * Firing ON `need` itself is unaffected: there, `need`'s current value IS the
 * trigger phrase the catch just read, not a separate answer to protect, so
 * hints stay offered.
 *
 * Exported for its own unit test (`noticingCatchHints.test.ts`) — this is the
 * one piece of the catch UI worth pinning independently of rendering the
 * whole wizard.
 */
export function catchHintsBlockedByExistingNeed(
  triggeredField: "observation" | "need" | "smallThing" | null,
  currentNeed: string | null
): boolean {
  return triggeredField === "smallThing" && !!currentNeed;
}

/**
 * Where to drop someone back in, on reload or on landing with a sitting
 * already open.
 *
 * Deliberately conservative, same reasoning as Feelings & Needs: resumes at
 * the first step whose answer is genuinely missing. `need` and `smallThing`
 * are both skippable, so an empty one is indistinguishable from a skipped
 * one — landing on "need" again costs a tap; guessing "they skipped it"
 * would silently swallow a step they meant to answer.
 */
function resumeStep(sitting: Sitting): Step {
  const pass = sitting.entries[sitting.entries.length - 1];
  if (!pass?.place) return "place";
  if (!pass.person) return "person";
  if (!pass.observation) return "observation";
  return "need";
}

function QuietAction({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="-my-2 inline-flex min-h-11 items-center py-2 text-xs text-muted-foreground underline disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Dots({ current }: { current: Step }) {
  const i = STEP_DOTS.indexOf(current);
  return (
    <div className="flex justify-end gap-1.5">
      {STEP_DOTS.map((s, n) => (
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

/** observation → need, on one line. Never two passes on one line. */
function PairLine({ observation, need }: { observation: string; need: string }) {
  const { leadsTo } = useArrows();
  if (!observation && !need) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full bg-muted/60 px-3 py-1">{observation || "—"}</span>
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
    <QuietAction onClick={onClick}>
      {back} {t("impact.noticing.nav.back")}
    </QuietAction>
  );
}

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
