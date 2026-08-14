import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppDate } from "~/i18n/useAppDate";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Link2,
  Pencil,
  Plus,
  Settings,
  Star,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { DateField } from "~/components/ui/date-field";
import { Textarea } from "~/components/ui/textarea";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { useApi } from "~/api/useApi";
import {
  GET_JOURNAL,
  GET_JOURNAL_ENTRIES,
  CREATE_ENTRY,
  UPDATE_ENTRY,
  ARCHIVE_ENTRY,
  ADD_JOURNAL_ACCESS,
  REMOVE_JOURNAL_ACCESS,
  SET_DEFAULT_JOURNAL,
  ARCHIVE_JOURNAL,
  UPDATE_JOURNAL,
} from "~/api/queries";
import { LoadingBlock } from "~/components/ui/spinner";
import { useSubmitGuard, useKeyedSubmitGuard } from "~/utils/useSubmitGuard";

type JournalDetail = {
  id: string;
  title: string;
  description?: string;
  isArchived: boolean;
  isDefault: boolean;
  linkedGoalId?: string;
  linkedProjectId?: string;
  linkedGoal?: { id: string; title: string };
  linkedProject?: { id: string; title: string };
  entryCount: number;
  accessList: { id: string; userEmail: string; addedAt: string }[];
  createdAt: string;
  updatedAt: string;
};

type JournalEntry = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  timestampOverridden: boolean;
};

/**
 * Was `toLocaleString(undefined, …)`, the one violation conventions §7d named.
 *
 * Passing `undefined` reads the browser or OS locale, so this was the only
 * string in the app sourced from somewhere other than i18next — a
 * Persian-configured machine rendered Persian digits, and a Jalali calendar,
 * for an account set to English. It now goes through the same two settings as
 * every other date.
 */
function useEntryDateFormatter() {
  const { t } = useTranslation();
  const { fmt } = useAppDate();
  return (iso: string) => {
    const d = new Date(iso);
    return t("dateTime.dateAtTime", {
      date: fmt(d, "dayMonthYear"),
      time: fmt(d, "time"),
    });
  };
}

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { call, getLastError } = useApi();
  const formatEntryDate = useEntryDateFormatter();

  const [journal, setJournal] = useState<JournalDetail | null>(null);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [composerBody, setComposerBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editOverride, setEditOverride] = useState(false);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessError, setAccessError] = useState("");
  const [addingAccess, setAddingAccess] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const fetchEntries = useCallback(() => {
    if (!id) return;
    const vars: any = { journalId: id, includeArchived: showArchived };
    if (search.trim()) vars.search = search.trim();
    if (dateFrom) vars.dateFrom = dateFrom;
    if (dateTo) vars.dateTo = dateTo;
    call({ query: GET_JOURNAL_ENTRIES, variables: vars }).then((res: any) => {
      setEntries(res?.journalEntries ?? []);
    });
  }, [call, id, showArchived, search, dateFrom, dateTo]);

  useEffect(() => {
    if (!id) return;
    call({ query: GET_JOURNAL, variables: { id } }).then((res: any) => {
      setJournal(res?.journal ?? null);
    });
  }, [id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const { submitting: composing, run: runCompose } = useSubmitGuard();
  const { submitting: journalBusy, run: runJournal } = useSubmitGuard();
  const { isSubmitting: isEntryBusy, run: runEntry } = useKeyedSubmitGuard();
  const { isSubmitting: isAccessBusy, run: runAccess } = useKeyedSubmitGuard();

  const refreshJournal = async () => {
    const res: any = await call({ query: GET_JOURNAL, variables: { id } });
    setJournal(res?.journal ?? null);
  };

  const handleSubmitEntry = async () => {
    if (!composerBody.trim() || !id) return;
    await runCompose(async () => {
      setSubmitting(true);
      try {
        await call({
          query: CREATE_ENTRY,
          variables: { journalId: id, body: composerBody.trim() },
        });
        setComposerBody("");
        fetchEntries();
        await refreshJournal();
      } finally {
        setSubmitting(false);
      }
    });
  };

  const handleEditSave = async (entryId: string) => {
    if (!editBody.trim()) return;
    await runEntry(entryId, async () => {
      await call({
        query: UPDATE_ENTRY,
        variables: { id: entryId, body: editBody.trim(), overrideTimestamp: editOverride },
      });
      setEditingEntryId(null);
      fetchEntries();
    });
  };

  const handleArchiveEntry = async (entryId: string) => {
    await runEntry(entryId, async () => {
      await call({ query: ARCHIVE_ENTRY, variables: { id: entryId } });
      fetchEntries();
    });
  };

  const handleAddAccess = async () => {
    if (!accessEmail.trim() || !id) return;
    await runAccess("add", async () => {
      setAddingAccess(true);
      setAccessError("");
      try {
        const res = await call({
          query: ADD_JOURNAL_ACCESS,
          variables: { journalId: id, email: accessEmail.trim() },
        });
        if (!res) {
          setAccessError(getLastError() ?? t("journals.access.notFound"));
          return;
        }
        setAccessEmail("");
        await refreshJournal();
      } finally {
        setAddingAccess(false);
      }
    });
  };

  const handleRemoveAccess = async (email: string) => {
    if (!id) return;
    await runAccess(email, async () => {
      await call({ query: REMOVE_JOURNAL_ACCESS, variables: { journalId: id, email } });
      await refreshJournal();
    });
  };

  const handleSetDefault = async () => {
    if (!id) return;
    await runJournal(async () => {
      await call({ query: SET_DEFAULT_JOURNAL, variables: { journalId: id } });
      await refreshJournal();
    });
  };

  const handleArchiveJournal = async () => {
    if (!id) return;
    await runJournal(async () => {
      await call({ query: ARCHIVE_JOURNAL, variables: { id } });
      await refreshJournal();
    });
  };

  const handleTitleSave = async () => {
    if (!titleDraft.trim() || !id) return;
    await runJournal(async () => {
      await call({ query: UPDATE_JOURNAL, variables: { id, title: titleDraft.trim() } });
      setEditingTitle(false);
      await refreshJournal();
    });
  };

  const visibleEntries = entries ?? [];
  const linkedEntity = journal?.linkedGoal ?? journal?.linkedProject;

  if (journal === null && entries === null) {
    return <LoadingBlock className="p-6" />;
  }
  if (!journal) {
    return <p className="p-6 text-muted-foreground">{t("common.notFound")}</p>;
  }

  const titleNode = editingTitle ? (
    <div className="flex items-center gap-2 w-full">
      <Input
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleTitleSave();
          if (e.key === "Escape") setEditingTitle(false);
        }}
        className="text-2xl font-bold h-auto py-0 border-0 border-b rounded-none focus-visible:ring-0 px-0"
        autoFocus
      />
      <Button size="sm" onClick={handleTitleSave} loading={journalBusy}>{t("common.save")}</Button>
      <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>{t("common.cancel")}</Button>
    </div>
  ) : (
    <div className="flex items-center gap-2 group">
      <span>{journal.title}</span>
      <button
        type="button"
        onClick={() => { setTitleDraft(journal.title); setEditingTitle(true); }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <InternalPageLayout
      title={titleNode}
      backLink={{ to: "/tools/journals", label: t("journals.title") }}
      actions={
        <div className="flex items-center gap-1">
          {!journal.isDefault && !journal.isArchived && (
            <Button size="sm" variant="ghost" onClick={handleSetDefault} loading={journalBusy} title={t("journals.setDefault")}>
              <Star className="h-4 w-4" />
            </Button>
          )}
          {journal.isDefault && (
            <Star className="h-4 w-4 text-primary" fill="currentColor" />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSettings((v) => !v)}
            className={showSettings ? "bg-accent" : ""}
            aria-label={t("journals.settings.title")}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Journal meta */}
        {journal.description && (
          <p className="text-sm text-muted-foreground">{journal.description}</p>
        )}
        {linkedEntity && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            <span>{linkedEntity.title}</span>
          </div>
        )}
        {journal.isArchived && (
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Archive className="h-4 w-4" />
            {t("journals.archivedNotice")}
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="font-semibold text-sm">{t("journals.settings.title")}</h3>

            {/* Access list */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">{t("journals.access.title")}</h4>
              <ul className="space-y-1">
                {journal.accessList.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span>{a.userEmail}</span>
                    {journal.accessList.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground"
                        onClick={() => handleRemoveAccess(a.userEmail)}
                        loading={isAccessBusy(a.userEmail)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  placeholder={t("journals.access.emailPlaceholder")}
                  value={accessEmail}
                  onChange={(e) => { setAccessEmail(e.target.value); setAccessError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAccess()}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={handleAddAccess} disabled={!accessEmail.trim() || addingAccess} loading={isAccessBusy("add")}>
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {accessError && <p className="text-xs text-destructive">{accessError}</p>}
            </div>

            {/* Archive */}
            {!journal.isArchived && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-muted-foreground"
                onClick={handleArchiveJournal}
                loading={journalBusy}
              >
                <Archive className="h-3.5 w-3.5" />
                {t("journals.archiveJournal")}
              </Button>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder={t("journals.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm max-w-xs"
          />
          <DateField
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-sm w-36"
            title={t("journals.dateFrom")}
          />
          <span className="text-muted-foreground text-xs">–</span>
          <DateField
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-sm w-36"
            title={t("journals.dateTo")}
          />
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showArchived
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Archive className="h-3 w-3" />
            {t("journals.showArchived")}
          </button>
        </div>

        {/* Entry list */}
        {entries === null ? (
          <LoadingBlock className="py-4" />
        ) : visibleEntries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {search || dateFrom || dateTo ? t("journals.noEntriesFiltered") : t("journals.noEntries")}
          </p>
        ) : (
          <ul className="space-y-3">
            {visibleEntries.map((entry) => (
              <li
                key={entry.id}
                className={`rounded-xl border bg-card p-4 space-y-2 ${entry.isArchived ? "opacity-50" : ""}`}
              >
                {editingEntryId === entry.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editOverride}
                          onChange={(e) => setEditOverride(e.target.checked)}
                          className="rounded"
                        />
                        {t("journals.overrideTimestamp")}
                      </label>
                      <div className="flex gap-2 ml-auto">
                        <Button size="sm" onClick={() => handleEditSave(entry.id)} loading={isEntryBusy(entry.id)}>
                          {t("common.save")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingEntryId(null)}
                        >
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{entry.body}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatEntryDate(entry.createdAt)}
                        {entry.timestampOverridden && " *"}
                      </span>
                      {!entry.isArchived && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground"
                            onClick={() => {
                              setEditingEntryId(entry.id);
                              setEditBody(entry.body);
                              setEditOverride(false);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground"
                            onClick={() => handleArchiveEntry(entry.id)}
                            loading={isEntryBusy(entry.id)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Entry composer */}
        {!journal.isArchived && (
          <div className="sticky bottom-4 rounded-xl border bg-card shadow-lg p-3 space-y-2">
            <Textarea
              ref={composerRef}
              placeholder={t("journals.composerPlaceholder")}
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitEntry();
                }
              }}
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmitEntry}
                disabled={!composerBody.trim() || submitting}
                loading={composing}
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("journals.addEntry")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </InternalPageLayout>
  );
}
