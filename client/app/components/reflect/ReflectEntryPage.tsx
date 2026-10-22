import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { LoadingBlock } from "~/components/ui/spinner";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import {
  DELETE_REFLECT_ENTRY,
  GET_REFLECT_CONTENT,
  GET_REFLECT_ENTRY,
  MOVE_REFLECT_ENTRY,
  SAVE_REFLECT_ENTRY,
  STOP_REFLECT_ENTRY,
} from "~/api/queries";
import { CalmClose } from "./CalmClose";
import { PrecheckStep, type PrecheckBefore, type PrecheckWhen } from "./PrecheckStep";
import { ReflectBanner, ReflectNotSaved, ReflectStepBar } from "./ReflectShell";
import { StoryStep } from "./StoryStep";
import { holdsWrittenText, type ReflectContent, type ReflectEntry, type ReflectStep } from "./types";
import { useReflectAutosave } from "./useReflectAutosave";

/** The step after each one, for Next. Back is B5's, and only from the story on. */
const NEXT_STEP: Partial<Record<ReflectStep, ReflectStep>> = {
  PRECHECK: "STORY",
  STORY: "FEELINGS",
  FEELINGS: "REALITY",
  REALITY: "CLOSE",
};

type Failure = "notSaved" | "action" | null;

/**
 * The open entry (`/tools/reflect/entry`), plates 3, 4 and 9.
 *
 * Fetched with `useApi`, never Apollo hooks (convention 6; the same as
 * Feelings & Needs and Noticing). Nothing Reflect reads is ever in Apollo's
 * cache, so a deleted entry has nothing to be evicted from (D-9, B4 card).
 *
 * B4 owns the frame: the banner, the step bar with Stop here, the footer, the
 * pre-check, the story and the calm close. B5 plugs the other steps into the
 * switch below.
 *
 * Leaving a step commits it first (D-15): `flush()` resolves before any move or
 * stop is sent. A failed save leaves the text in the page, shows the not-saved
 * line and holds Next and Stop here until it is saved (G3).
 */
export default function ReflectEntryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const [phase, setPhase] = useState<"loading" | "failed" | "ready">("loading");
  const [entry, setEntry] = useState<ReflectEntry | null>(null);
  const [content, setContent] = useState<ReflectContent | null>(null);
  const [calm, setCalm] = useState<{ holdsText: boolean } | null>(null);

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
  const lastAction = useRef<(() => Promise<void>) | null>(null);

  const autosave = useReflectAutosave(
    useCallback(
      async (fields) => {
        const entryId = entryIdRef.current;
        if (!entryId) return false;
        const res = await call({ query: SAVE_REFLECT_ENTRY, variables: { entryId, ...fields } });
        return !!res?.saveReflectEntry;
      },
      [call]
    )
  );

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
    // G15, first half: the entry URL with no open entry goes to the home. The
    // after-entry done line that survives a reload (PD-14) is B5's.
    if (!e.reflectEntry) {
      navigate("/tools/reflect", { replace: true });
      return;
    }
    setEntry(e.reflectEntry);
    setContent(c.reflectContent);
    setPhase("ready");
  }, [call, navigate]);

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
        setFailure("notSaved");
        return false;
      }
    }
    setFailure(null);
    return true;
  };

  const goNext = () => {
    if (!entry) return;
    const to = NEXT_STEP[entry.step];
    if (!to) return;
    void run(async () => {
      if (!(await commitStep(entry))) return;
      const res = await call({ query: MOVE_REFLECT_ENTRY, variables: { entryId: entry.id, to } });
      if (!res?.moveReflectEntry) {
        setFailure("action");
        return;
      }
      setEntry(res.moveReflectEntry.entry);
      setBannerGone(true);
    });
  };

  const stopHere = () => {
    if (!entry) return;
    void run(async () => {
      if (!(await commitStep(entry))) return;
      const res = await call({ query: STOP_REFLECT_ENTRY, variables: { entryId: entry.id } });
      if (!res?.stopReflectEntry) {
        setFailure("action");
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

  if (phase === "loading" || !entry || !content) return <LoadingBlock />;

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

  const showBanner =
    !bannerGone && (i18n.language !== content.locale || content.reviewStatus === "draft");

  return (
    <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
      <div className="space-y-6">
        {showBanner && <ReflectBanner practiceLocale={content.locale} reviewStatus={content.reviewStatus} />}

        <ReflectStepBar step={entry.step} onStop={stopHere} stopDisabled={busy || autosave.failed || failure === "notSaved"} />

        {entry.step === "PRECHECK" && (
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

        {entry.step === "STORY" && (
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

        {/* FEELINGS, REALITY and CLOSE: B5's step bodies plug in here. */}

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
