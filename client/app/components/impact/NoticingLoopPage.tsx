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
  ADD_NOTICING_PASS,
  FINISH_NOTICING_SITTING,
  GET_ACTIVE_NOTICING_SITTING,
  GET_NOTICING_CONTENT,
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
};
type Sitting = { id: string; completedAt: string | null; entries: Entry[] };

type FrameStep = { prompt: string; helper: string | null };
type Content = {
  repeatSoftCap: number;
  places: PaletteEntry[];
  cues: PaletteEntry[];
  needs: PaletteEntry[];
  display: { needIds: string[] };
  loop: LoopCopy;
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

type Step = "place" | "person" | "observation" | "need" | "small" | "close" | "recap";

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

  const [placeOwn, setPlaceOwn] = useState(false);
  const [placeOwnText, setPlaceOwnText] = useState("");
  const [personText, setPersonText] = useState("");
  const [observationText, setObservationText] = useState("");
  const [needOwn, setNeedOwn] = useState(false);
  const [needOwnText, setNeedOwnText] = useState("");
  const [smallText, setSmallText] = useState("");

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
      setSitting(updated);
      if (next) setStep(next);
      return updated;
    },
    [call, pass]
  );

  const finishSitting = useCallback(async () => {
    if (!sitting) return;
    setBusy(true);
    const res = await call({ query: FINISH_NOTICING_SITTING, variables: { sittingId: sitting.id } });
    setBusy(false);
    if (!res?.finishNoticingSitting?.sitting) {
      setFailed(true);
      return;
    }
    const done: Sitting = res.finishNoticingSitting.sitting;
    setSitting(done);
    if (done.entries.length > 1) setStep("recap");
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
                void commitEntry({ smallThing: smallText.trim() || null }, "close");
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

        {step === "close" && (
          <section className="space-y-5">
            <p className="text-sm">{c.close}</p>
            <PairLine observation={pass.observation ?? ""} need={labelOf(content.needs, pass.need)} />

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
              <Button onClick={() => navigate("/tools/impact/noticing")}>{c.finish}</Button>
            </div>
          </section>
        )}
      </div>
    </InternalPageLayout>
  );
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
