import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import { useAppDate } from "~/i18n/useAppDate";
import { GET_REFLECT_HOME, START_REFLECT_ENTRY } from "~/api/queries";
import { ReflectBanner } from "./ReflectShell";
import type { ReflectHome } from "./types";

/**
 * Reflect's home (`/tools/reflect`, spec §4.2, plate 2).
 *
 * One decision: start, or continue the one that is open. Until the server has
 * said which, a placeholder holds the button's place (W5): a flash of Start
 * before Continue would invite a tap that closes the open entry. Nothing here
 * counts anything: Past entries is a text link shown once one exists (W18).
 *
 * Read with `useApi`, like Feelings & Needs and Noticing, so nothing of Reflect
 * ever sits in Apollo's cache (D-9).
 */
export default function ReflectHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();
  const { fmt } = useAppDate();

  const [home, setHome] = useState<ReflectHome | null>(null);
  const [failed, setFailed] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await call({ query: GET_REFLECT_HOME });
    if (!res?.reflectHome) {
      setFailed(true);
      return;
    }
    setHome(res.reflectHome);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  /** `replacing` names the entry Start a new one closes; a double tap closes nothing else (D-14). */
  const start = async (replacing: string | null) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStartFailed(false);
    try {
      const res = await call({ query: START_REFLECT_ENTRY, variables: { replacing } });
      if (!res?.startReflectEntry) {
        setStartFailed(true);
        return;
      }
      navigate("/tools/reflect/entry");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (failed) {
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

  const open = home?.openEntry ?? null;

  return (
    <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
      <div className="space-y-6">
        {home && <ReflectBanner practiceLocale={home.practiceLocale} reviewStatus={home.reviewStatus} />}

        <p className="text-sm leading-relaxed text-muted-foreground">{t("reflect.home.intro")}</p>

        {!home && (
          <div
            data-testid="reflect-home-loading"
            aria-busy="true"
            className="flex h-10 items-center justify-center rounded-md bg-accent/60"
          >
            <Spinner />
          </div>
        )}

        {home && !open && (
          <Button className="w-full" onClick={() => void start(null)} disabled={busy}>
            {t("reflect.home.start")}
          </Button>
        )}

        {home && open && (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => navigate("/tools/reflect/entry")} disabled={busy}>
              {t("reflect.home.continue", { date: fmt(new Date(open.createdAt), "dayMonthYear") })}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void start(open.id)} disabled={busy}>
              {t("reflect.home.startNew")}
            </Button>
            {/* G4, AC-53: what becomes of the open entry, said before the tap. No dialog. */}
            <p className="text-sm text-muted-foreground">
              {open.hasStory ? t("reflect.home.startNewKept") : t("reflect.home.startNewEnds")}
            </p>
          </div>
        )}

        {startFailed && (
          <p role="alert" className="text-sm text-destructive">
            {t("reflect.errors.start")}
          </p>
        )}

        {home?.hasPast && (
          <p>
            <Link to="/tools/reflect/past" className="text-sm underline underline-offset-4">
              {t("reflect.home.past")}
            </Link>
          </p>
        )}
      </div>
    </InternalPageLayout>
  );
}
