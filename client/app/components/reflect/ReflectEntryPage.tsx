import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { LoadingBlock } from "~/components/ui/spinner";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import {
  ANSWER_REFLECT_ENTRY,
  DELETE_REFLECT_ENTRY,
  FINISH_REFLECT_ENTRY,
  GET_REFLECT_CONTENT,
  GET_REFLECT_ENTRY,
  MOVE_REFLECT_ENTRY,
  SAVE_REFLECT_ENTRY,
  SAVE_REFLECT_MOMENT,
  SAVE_REFLECT_READING,
  STOP_REFLECT_ENTRY,
} from "~/api/queries";
import { AfterEntryQuestion, ReflectDone, type AfterAnswer } from "./AfterEntry";
import { CalmClose } from "./CalmClose";
import { CloseStep } from "./CloseStep";
import { FeelingsStep } from "./FeelingsStep";
import { RealityStep } from "./RealityStep";
import { PrecheckStep, type PrecheckBefore, type PrecheckWhen } from "./PrecheckStep";
import { ReflectBanner, ReflectNotSaved, ReflectStepBar } from "./ReflectShell";
import { StoryStep } from "./StoryStep";
import {
  holdsWrittenText,
  type ReflectContent,
  type ReflectEntry,
  type ReflectFauxOffer,
  type ReflectInterpretationOffer,
  type ReflectStep,
  type SaveValue,
} from "./types";
import { useReflectAutosave } from "./useReflectAutosave";

/** The step after each one, for Next. */
const NEXT_STEP: Partial<Record<ReflectStep, ReflectStep>> = {
  PRECHECK: "STORY",
  STORY: "FEELINGS",
  FEELINGS: "REALITY",
  REALITY: "CLOSE",
};

/** The step before each one, for Back: from the story on, never to the pre-check (D-3, PD-6). */
const PREV_STEP: Partial<Record<ReflectStep, ReflectStep>> = {
  FEELINGS: "STORY",
  REALITY: "FEELINGS",
  CLOSE: "REALITY",
};

/** B2's refusal for a write to a closed entry (`REFUSALS.closed`), read with `getLastError()`. */
const CLOSED_REFUSAL = "This entry is closed.";

type Failure = "notSaved" | "action" | null;

/**
 * The open entry (`/tools/reflect/entry`), plates 3, 4 and 9.
 *
 * Fetched with `useApi`, never Apollo hooks (convention 6; the same as
 * Feelings & Needs and Noticing). Nothing Reflect reads is ever in Apollo's
 * cache, so a deleted entry has nothing to be evicted from (D-9, B4 card).
 *
 * B4 owns the frame: the banner, the step bar with Stop here, the footer, the
 * pre-check, the story and the calm close. B5 adds the feelings and needs step,
 * the reality check, the close, and after Finish the question and the done line.
 *
 * The two catches' offers live in this page's state, from the result that
 * carried them, and are dropped on any move (G11): a reload, Back or Continue
 * never shows one again. After Finish the route's history state is replaced with
 * `{ finished: true }` (PD-14), so a reload lands on the done line and not on the
 * home or the question.
 *
 * A write refused as `closed` (the entry was closed in another tab) leaves for
 * the Reflect home instead of showing a not-saved line that can never clear.
 *
 * Leaving a step commits it first (D-15): `flush()` resolves before any move or
 * stop is sent. A failed save leaves the text in the page, shows the not-saved
 * line and holds Next and Stop here until it is saved (G3).
 */
export default function ReflectEntryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { call, getLastError } = useApi();

  const [phase, setPhase] = useState<"loading" | "failed" | "ready">("loading");
  const [entry, setEntry] = useState<ReflectEntry | null>(null);
  const [content, setContent] = useState<ReflectContent | null>(null);
  const [calm, setCalm] = useState<{ holdsText: boolean } | null>(null);
  // After Finish: the question (only in the page that tapped Finish), then the done line.
  const [after, setAfter] = useState<"question" | "done" | null>(null);
  const [faux, setFaux] = useState<ReflectFauxOffer | null>(null);
  const [interpretation, setInterpretation] = useState<ReflectInterpretationOffer | null>(null);
  // The reality check shows, its pairs dimmed, while the move that opens it is out.
  const [arriving, setArriving] = useState(false);
  // How many moment and reading rows the server holds: a new card's first write is the next free position (B2).
  const [stored, setStored] = useState({ moments: 0, readings: 0 });

  // The pre-check's answers wait in the page until the step is left (PD-6).
  const [when, setWhen] = useState<PrecheckWhen | null>(null);
  const [before, setBefore] = useState<PrecheckBefore | null>(null);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  // G17: the banner tops the first step shown after the page mounts, then goes.
  const [bannerGone, setBannerGone] = useState(false);

  const entryIdRef = useRef<string | null>(null);
  entryIdRef.current = entry?.id ?? null;
  const lock = useRef(false);
  const answerLock = useRef(false);
  // The feeling the faux offer on screen was surfaced by.
  const fauxWord = useRef<string | null>(null);
  const lastAction = useRef<(() => Promise<void>) | null>(null);

  /** A write refused as closed leaves for the home. True when it did. */
  const leftIfClosed = useCallback(() => {
    if (getLastError() !== CLOSED_REFUSAL) return false;
    navigate("/tools/reflect", { replace: true });
    return true;
  }, [getLastError, navigate]);

  const autosave = useReflectAutosave(
    useCallback(
      async (key: string, value: SaveValue) => {
        const entryId = entryIdRef.current;
        if (!entryId) return false;
        const [kind, at, field] = key.split(":");
        if (kind === "moment") {
          const position = Number(at);
          const word = (v: SaveValue) => (typeof v === "object" && v ? v : { text: "", source: "OWN" as const });
          const fields =
            field === "whenText"
              ? { whenText: value as string }
              : field === "feeling"
                ? { feeling: word(value).text, feelingSource: word(value).source }
                : field === "need"
                  ? { need: word(value).text, needSource: word(value).source }
                  : { met: value as string | null };
          const res = await call({ query: SAVE_REFLECT_MOMENT, variables: { entryId, position, ...fields } });
          const saved = res?.saveReflectMoment;
          if (!saved?.moment) {
            leftIfClosed();
            return false;
          }
          setStored((n) => ({ ...n, moments: Math.max(n.moments, position + 1) }));
          if (saved.fauxOffer) {
            fauxWord.current = word(value).text;
            setFaux(saved.fauxOffer);
          } else if (field === "feeling") {
            // The offer is about the word that surfaced it (AC-25): a different feeling saved under it takes it away.
            const text = word(value).text;
            setFaux((f) => (f && f.position === position && text !== fauxWord.current ? null : f));
          }
          return true;
        }
        if (kind === "reading") {
          const position = Number(at);
          const res = await call({
            query: SAVE_REFLECT_READING,
            variables: { entryId, position, [field]: value as string },
          });
          if (!res?.saveReflectReading) {
            leftIfClosed();
            return false;
          }
          setStored((n) => ({ ...n, readings: Math.max(n.readings, position + 1) }));
          return true;
        }
        const res = await call({ query: SAVE_REFLECT_ENTRY, variables: { entryId, [key]: value as string } });
        if (!res?.saveReflectEntry) {
          leftIfClosed();
          return false;
        }
        return true;
      },
      [call, leftIfClosed]
    )
  );

  /** Takes the entry the server returned, and with it what the server holds of the two row lists. */
  const applyEntry = useCallback((e: ReflectEntry) => {
    setEntry(e);
    setStored({ moments: e.moments.length, readings: e.readings.length });
  }, []);

  const load = useCallback(async () => {
    setPhase("loading");
    const [e, c] = await Promise.all([
      call({ query: GET_REFLECT_ENTRY }),
      call({ query: GET_REFLECT_CONTENT }),
    ]);
    if (!e || !c?.reflectContent) {
      setPhase("failed");
      return;
    }
    // G15: the entry URL with no open entry goes to the home, unless Finish was
    // tapped on this history entry: then the done line, not the question (PD-14).
    if (!e.reflectEntry) {
      if ((location.state as { finished?: boolean } | null)?.finished) {
        setAfter("done");
        setPhase("ready");
        return;
      }
      navigate("/tools/reflect", { replace: true });
      return;
    }
    applyEntry(e.reflectEntry);
    setContent(c.reflectContent);
    setPhase("ready");
    // Read once, at mount: Finish changes the history state without a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, navigate, applyEntry]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    lastAction.current = action;
    setBusy(true);
    try {
      await action();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  /**
   * Everything a step owes the server before the person leaves it: the text
   * being typed (D-15), and on the pre-check its answers, sent even when both
   * are blank so one path covers every exit (PD-6).
   */
  const commitStep = async (current: ReflectEntry): Promise<boolean> => {
    try {
      await autosave.flush();
    } catch {
      return false; // the not-saved line is already up
    }
    if (current.step === "PRECHECK") {
      const res = await call({
        query: SAVE_REFLECT_ENTRY,
        variables: { entryId: current.id, precheckWhen: when, precheckBefore: before },
      });
      if (!res?.saveReflectEntry) {
        if (leftIfClosed()) return false;
        setFailure("notSaved");
        return false;
      }
    }
    setFailure(null);
    return true;
  };

  /** Moves one step, after the step's own commit. A forward move into the reality check carries the offer; any move drops the offers on screen (G11). */
  const goTo = (to: ReflectStep) => {
    if (!entry) return;
    const forward = NEXT_STEP[entry.step] === to;
    void run(async () => {
      if (!(await commitStep(entry))) return;
      if (to === "REALITY" && forward) setArriving(true);
      try {
        const res = await call({ query: MOVE_REFLECT_ENTRY, variables: { entryId: entry.id, to } });
        if (!res?.moveReflectEntry) {
          if (!leftIfClosed()) setFailure("action");
          return;
        }
        setFaux(null);
        setInterpretation(res.moveReflectEntry.interpretationOffer ?? null);
        applyEntry(res.moveReflectEntry.entry);
        setBannerGone(true);
      } finally {
        setArriving(false);
      }
    });
  };

  const goNext = () => {
    const to = entry && NEXT_STEP[entry.step];
    if (to) goTo(to);
  };

  const goBack = () => {
    const to = entry && PREV_STEP[entry.step];
    if (to) goTo(to);
  };

  const finishEntry = () => {
    if (!entry) return;
    void run(async () => {
      if (!(await commitStep(entry))) return;
      const res = await call({ query: FINISH_REFLECT_ENTRY, variables: { entryId: entry.id } });
      if (!res?.finishReflectEntry) {
        if (!leftIfClosed()) setFailure("action");
        return;
      }
      // PD-14: a reload from here finds no open entry, and this state says why.
      navigate(".", { replace: true, state: { finished: true } });
      setFaux(null);
      setInterpretation(null);
      setAfter("question");
    });
  };

  /** One answer, or Skip (null): the question's own lock lets this run once. An answer that can't be stored doesn't hold the person here. */
  const answer = (value: AfterAnswer | null) => {
    if (answerLock.current) return;
    answerLock.current = true;
    if (value && entry) void call({ query: ANSWER_REFLECT_ENTRY, variables: { entryId: entry.id, answer: value } });
    setAfter("done");
  };

  const stopHere = () => {
    if (!entry) return;
    void run(async () => {
      if (!(await commitStep(entry))) return;
      const res = await call({ query: STOP_REFLECT_ENTRY, variables: { entryId: entry.id } });
      if (!res?.stopReflectEntry) {
        if (!leftIfClosed()) setFailure("action");
        return;
      }
      // AC-56: what the calm close offers follows what the server holds.
      setCalm({ holdsText: holdsWrittenText(res.stopReflectEntry) });
    });
  };

  const deleteEntry = async (): Promise<boolean> => {
    if (!entry) return false;
    const res = await call({ query: DELETE_REFLECT_ENTRY, variables: { entryId: entry.id } });
    if (!res?.deleteReflectEntry) return false;
    // D-9: a deleted entry must not linger in a client cache. None does: this
    // page and the home read through useApi, which keeps nothing, so there is
    // no Apollo entry to evict. Keep it that way; a Reflect read that went
    // through Apollo would have to evict the entry here.
    navigate("/tools/reflect", { replace: true }); // G9: the calm close has nothing left to show
    return true;
  };

  if (phase === "failed") {
    return (
      <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("reflect.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("reflect.tryAgain")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (phase === "ready" && after === "done") {
    return (
      <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
        <ReflectDone onBack={() => navigate("/tools/reflect")} />
      </InternalPageLayout>
    );
  }

  if (phase === "loading" || !entry || !content) return <LoadingBlock />;

  if (after === "question") {
    return (
      <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
        <AfterEntryQuestion onAnswer={answer} onSkip={() => answer(null)} />
      </InternalPageLayout>
    );
  }

  if (calm) {
    return (
      <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
        <CalmClose
          holdsText={calm.holdsText}
          onBack={() => navigate("/tools/reflect")}
          onDelete={deleteEntry}
        />
      </InternalPageLayout>
    );
  }

  const shown: ReflectStep = arriving ? "REALITY" : entry.step;
  const showBanner =
    !bannerGone && (i18n.language !== content.locale || content.reviewStatus === "draft");

  return (
    <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
      <div className="space-y-6">
        {showBanner && <ReflectBanner practiceLocale={content.locale} reviewStatus={content.reviewStatus} />}

        <ReflectStepBar step={shown} onStop={stopHere} stopDisabled={busy || autosave.failed || failure === "notSaved"} />

        {shown === "PRECHECK" && (
          <PrecheckStep
            when={when}
            before={before}
            onWhen={setWhen}
            onBefore={setBefore}
            onNext={goNext}
            onKeepGoing={goNext}
            onNotNow={stopHere}
            busy={busy}
            blocked={failure === "notSaved"}
          />
        )}

        {shown === "STORY" && (
          <StoryStep
            entry={entry}
            content={content}
            onChange={autosave.setField}
            failed={autosave.failed}
            onRetry={() => void autosave.retry()}
            onNext={goNext}
            busy={busy}
          />
        )}

        {shown === "FEELINGS" && (
          <FeelingsStep
            entry={entry}
            content={content}
            autosave={autosave}
            storedMoments={stored.moments}
            fauxOffer={faux}
            onDismissFaux={() => setFaux(null)}
            onBack={goBack}
            onNext={goNext}
            failed={autosave.failed}
            onRetry={() => void autosave.retry()}
            busy={busy}
          />
        )}

        {shown === "REALITY" && (
          <RealityStep
            entry={entry}
            content={content}
            autosave={autosave}
            storedReadings={stored.readings}
            offer={interpretation}
            onDismissOffer={() => setInterpretation(null)}
            waiting={arriving}
            onBack={goBack}
            onNext={goNext}
            failed={autosave.failed}
            onRetry={() => void autosave.retry()}
            busy={busy}
          />
        )}

        {shown === "CLOSE" && (
          <CloseStep
            entry={entry}
            content={content}
            onChange={autosave.setField}
            failed={autosave.failed}
            onRetry={() => void autosave.retry()}
            onBack={goBack}
            onFinish={finishEntry}
            busy={busy}
          />
        )}

        {failure && (
          <ReflectNotSaved
            messageKey={failure === "notSaved" ? "reflect.notSaved" : "reflect.errors.action"}
            onRetry={() => {
              const again = lastAction.current;
              setFailure(null);
              if (again) void run(again);
            }}
          />
        )}
      </div>
    </InternalPageLayout>
  );
}
