import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import { useAppDate } from "~/i18n/useAppDate";
import { GET_REFLECT_PAST_ENTRIES } from "~/api/queries";
import type { ReflectPastPage, ReflectPastRow } from "./types";

/**
 * Past entries (`/tools/reflect/past`, spec §4.10, plate 10).
 *
 * Newest first: the date above the start of the entry's first writing, cut to
 * one line (W14). The whole row is one link and the only control on it (AC-38).
 * No count, search, filter or grouping, and nothing on a row says how the entry
 * ended (AC-60). Pages of fifty: a plain *Show older* under the last row passes
 * that row's id as `before` and appends (PD-11). Empty: one line and a way
 * back, never a zero (AC-62).
 *
 * Read with `useApi`, so no Reflect text sits in Apollo's cache (D-9).
 */
export default function ReflectPastListPage() {
  const { t } = useTranslation();
  const { call } = useApi();
  const { fmt } = useAppDate();

  const [rows, setRows] = useState<ReflectPastRow[] | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const res = await call({ query: GET_REFLECT_PAST_ENTRIES, variables: { before: null } });
    const page: ReflectPastPage | undefined = res?.reflectPastEntries;
    if (!page) {
      setFailed(true);
      return;
    }
    setRows(page.rows);
    setHasOlder(page.hasOlder);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const showOlder = async () => {
    if (loadingMore || !rows?.length) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const res = await call({
        query: GET_REFLECT_PAST_ENTRIES,
        variables: { before: rows[rows.length - 1].id },
      });
      const page: ReflectPastPage | undefined = res?.reflectPastEntries;
      if (!page) {
        setMoreFailed(true);
        return;
      }
      setRows((prev) => [...(prev ?? []), ...page.rows]);
      setHasOlder(page.hasOlder);
    } finally {
      setLoadingMore(false);
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

  return (
    <InternalPageLayout title={t("reflect.title")} maxWidth="max-w-xl">
      <div className="space-y-4">
        <h2 className="text-lg font-medium">{t("reflect.past.title")}</h2>

        {rows == null && (
          <div data-testid="reflect-past-loading" aria-busy="true" className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {rows != null && rows.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("reflect.past.empty")}</p>
            <Button variant="outline" asChild>
              <Link to="/tools/reflect">{t("reflect.past.backToReflect")}</Link>
            </Button>
          </div>
        )}

        {rows != null && rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/tools/reflect/past/${r.id}`}
                  className="block min-w-0 rounded-lg border bg-card p-3 hover:bg-accent/50"
                >
                  <span className="block text-xs text-muted-foreground">
                    {fmt(new Date(r.createdAt), "dayMonthYear")}
                  </span>
                  <span dir="auto" className="block truncate text-sm">
                    {r.firstWriting}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {rows != null && rows.length > 0 && hasOlder && (
          <div>
            <Button variant="link" className="px-0" disabled={loadingMore} onClick={() => void showOlder()}>
              {t("reflect.past.showOlder")}
            </Button>
            {moreFailed && (
              <p role="alert" className="text-sm text-destructive">
                {t("reflect.errors.couldNotLoad")}
              </p>
            )}
          </div>
        )}
      </div>
    </InternalPageLayout>
  );
}
