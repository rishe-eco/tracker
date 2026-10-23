import { Fragment, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Spinner } from "~/components/ui/spinner";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import { useAppDate } from "~/i18n/useAppDate";
import { DELETE_REFLECT_ENTRY, GET_REFLECT_PAST_ENTRY } from "~/api/queries";
import type { ReflectMet, ReflectPastEntry } from "./types";

/**
 * One past entry (`/tools/reflect/past/:id`, spec §4.10, plate 11).
 *
 * Read-only, in step order, each part under a short interface label and only
 * the parts that hold text (G10, W15). No pre-check, no after-entry answer, no
 * catch, and nothing that says the entry was stopped (AC-39, AC-60): the API's
 * type has no field for it, so this page couldn't show it. *Delete* is at the
 * end, behind ConfirmDialog (AC-40), then back to the list.
 *
 * Another person's id and a deleted one both come back from the API as
 * `Not found`, and show the same line here (AC-61): the page never learns, or
 * says, which it was.
 *
 * Read with `useApi`, never Apollo hooks, so a deleted entry has nothing to be
 * evicted from (D-9). Keep it that way: a Reflect read that went through
 * Apollo would have to evict the entry after the delete below.
 */

const MET_KEY: Record<ReflectMet, string> = {
  MET: "reflect.past.met.met",
  UNMET: "reflect.past.met.unmet",
  NOT_SURE: "reflect.past.met.notSure",
};

const has = (v: string | null | undefined): v is string => v != null && v !== "";

type Phase = "loading" | "ready" | "notFound" | "failed";

export default function ReflectPastEntryPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { call, getLastError } = useApi();
  const { fmt } = useAppDate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [entry, setEntry] = useState<ReflectPastEntry | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    const res = await call({ query: GET_REFLECT_PAST_ENTRY, variables: { id } });
    if (res?.reflectPastEntry) {
      setEntry(res.reflectPastEntry);
      setPhase("ready");
      return;
    }
    // The API refuses a stranger's id and a deleted one with the same message.
    setPhase(getLastError() === "Not found" ? "notFound" : "failed");
  }, [call, getLastError, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!entry) return;
    setDeleteFailed(false);
    const res = await call({ query: DELETE_REFLECT_ENTRY, variables: { entryId: entry.id } });
    if (!res?.deleteReflectEntry) {
      setDeleteFailed(true);
      return;
    }
    // `replace`, so Back can't return to the entry that is gone.
    navigate("/tools/reflect/past", { replace: true });
  };

  const backLink = { to: "/tools/reflect/past", label: t("reflect.past.title") };

  if (phase === "loading") {
    return (
      <InternalPageLayout title={t("reflect.title")} backLink={backLink} maxWidth="max-w-xl">
        <div data-testid="reflect-past-entry-loading" aria-busy="true" className="flex justify-center">
          <Spinner />
        </div>
      </InternalPageLayout>
    );
  }

  if (phase === "notFound") {
    return (
      <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("reflect.past.notFound")}</p>
          <Button variant="outline" asChild>
            <Link to="/tools/reflect">{t("reflect.past.backToReflect")}</Link>
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  if (phase === "failed" || !entry) {
    return (
      <InternalPageLayout title={t("reflect.title")} backLink={backLink} maxWidth="max-w-xl">
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="text-sm">{t("reflect.errors.couldNotLoad")}</p>
          <Button variant="outline" onClick={() => void load()}>
            {t("reflect.tryAgain")}
          </Button>
        </div>
      </InternalPageLayout>
    );
  }

  const moments = entry.moments.filter((m) => has(m.whenText) || has(m.feeling) || has(m.need));
  const readings = entry.readings.filter((r) => has(r.reading) || has(r.camera));

  return (
    <InternalPageLayout title={t("reflect.title")} backLink={backLink} maxWidth="max-w-xl">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{fmt(new Date(entry.createdAt), "dayMonthYear")}</p>

        {has(entry.scene) && (
          <Part label={t("reflect.past.scene")}>
            <Text>{entry.scene}</Text>
          </Part>
        )}

        {has(entry.story) && (
          <Part label={t("reflect.past.story")}>
            <Text>{entry.story}</Text>
          </Part>
        )}

        {moments.length > 0 && (
          <Part label={t("reflect.past.moments")}>
            <ul className="space-y-3">
              {moments.map((m) => {
                // Plate 11's "feeling · need · Unmet": without the dot, "hurt to be seen" reads as one phrase.
                const words = [
                  has(m.feeling) && <span dir="auto">{m.feeling}</span>,
                  has(m.need) && <span dir="auto">{m.need}</span>,
                  m.met != null && <span>{t(MET_KEY[m.met])}</span>,
                ].filter(Boolean);
                return (
                  <li key={m.id} className="space-y-1">
                    {has(m.whenText) && <Text>{m.whenText}</Text>}
                    {words.length > 0 && (
                      <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                        {words.map((w, i) => (
                          <Fragment key={i}>
                            {i > 0 && <span aria-hidden="true">·</span>}
                            {w}
                          </Fragment>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Part>
        )}

        {readings.length > 0 && (
          <Part label={t("reflect.past.readings")}>
            <ul className="space-y-3">
              {readings.map((r) => (
                <li key={r.id} className="space-y-1">
                  {has(r.reading) && <Text>{r.reading}</Text>}
                  {has(r.camera) && <Text muted>{r.camera}</Text>}
                </li>
              ))}
            </ul>
          </Part>
        )}

        {has(entry.close) && (
          <Part label={t("reflect.past.close")}>
            <Text>{entry.close}</Text>
          </Part>
        )}

        <div className="space-y-2 border-t pt-4">
          <Button variant="outline" onClick={() => setConfirming(true)}>
            {t("reflect.past.delete")}
          </Button>
          {deleteFailed && (
            <p role="alert" className="text-sm text-destructive">
              {t("reflect.errors.delete")}
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={() => setConfirming(false)}
        title={t("reflect.past.confirmTitle")}
        description={t("reflect.past.confirmBody")}
        confirmLabel={t("common.delete")}
        variant="destructive"
        onConfirm={remove}
      />
    </InternalPageLayout>
  );
}

function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-medium">{label}</h2>
      {children}
    </section>
  );
}

/** Written text, shown as it was written: its own direction (AC-64), line breaks kept, long words wrapped. */
function Text({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <p
      dir="auto"
      className={`whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere] ${muted ? "text-muted-foreground" : ""}`}
    >
      {children}
    </p>
  );
}
