import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Plus, BookOpen, Archive, Users, Link2, Star } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import InternalPageLayout from "~/layout/InternalPageLayout";
import ModuleIntroOverlay from "~/components/onboarding/ModuleIntroOverlay";
import { useApi } from "~/api/useApi";
import {
  GET_JOURNALS,
  CREATE_JOURNAL,
  ARCHIVE_JOURNAL,
  SET_DEFAULT_JOURNAL,
} from "~/api/queries";
import { LoadingBlock } from "~/components/ui/spinner";

type JournalSummary = {
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
  accessList: { id: string; userEmail: string }[];
  createdAt: string;
  updatedAt: string;
};

export default function JournalsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();

  const journalSteps = [
    { title: t("onboarding.modules.journals.step1Title"), body: t("onboarding.modules.journals.step1Body") },
    { title: t("onboarding.modules.journals.step2Title"), body: t("onboarding.modules.journals.step2Body") },
    { title: t("onboarding.modules.journals.step3Title"), body: t("onboarding.modules.journals.step3Body") },
  ];

  const [journals, setJournals] = useState<JournalSummary[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchJournals = useCallback(() => {
    call({ query: GET_JOURNALS, variables: { includeArchived: showArchived } }).then((res: any) => {
      setJournals(res?.journals ?? []);
    });
  }, [call, showArchived]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  const handleCreate = () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    call({
      query: CREATE_JOURNAL,
      variables: { title: createTitle.trim(), description: createDescription.trim() || undefined },
    }).then((res: any) => {
      setCreating(false);
      setShowCreate(false);
      setCreateTitle("");
      setCreateDescription("");
      if (res?.createJournal?.id) {
        navigate(`/tools/journals/${res.createJournal.id}`);
      } else {
        fetchJournals();
      }
    });
  };

  const handleArchive = (id: string) => {
    call({ query: ARCHIVE_JOURNAL, variables: { id } }).then(fetchJournals);
  };

  const handleSetDefault = (id: string) => {
    call({ query: SET_DEFAULT_JOURNAL, variables: { journalId: id } }).then(fetchJournals);
  };

  const linked = journals?.filter((j) => j.linkedGoalId || j.linkedProjectId);
  const shared = journals?.filter((j) => j.accessList.length > 1);
  const activeJournals = journals?.filter((j) => !j.isArchived) ?? [];
  const archivedJournals = journals?.filter((j) => j.isArchived) ?? [];
  const visibleJournals = showArchived ? journals ?? [] : activeJournals;

  return (
    <>
      <ModuleIntroOverlay moduleKey="journals" steps={journalSteps} />
      <InternalPageLayout
        title={t("journals.title")}
        backLink={{ to: "/tools", label: t("nav.tools") }}
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("journals.new")}
          </Button>
        }
      >
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
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
            {archivedJournals.length > 0 && (
              <span className="ml-1 rounded-full bg-background/20 px-1.5">{archivedJournals.length}</span>
            )}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">{t("journals.newJournal")}</h3>
            <Input
              placeholder={t("journals.titlePlaceholder")}
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Input
              placeholder={t("journals.descriptionPlaceholder")}
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!createTitle.trim() || creating} loading={creating}>
                {creating ? t("common.saving") : t("common.create")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setCreateTitle("");
                  setCreateDescription("");
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Journal list */}
        {journals === null ? (
          <LoadingBlock />
        ) : visibleJournals.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              {showArchived ? t("journals.noArchived") : t("journals.empty")}
            </p>
            {!showArchived && (
              <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t("journals.createFirst")}
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleJournals.map((journal) => (
              <li key={journal.id}>
                <div
                  className={`rounded-xl border bg-card p-4 cursor-pointer hover:bg-accent/30 transition-colors ${
                    journal.isArchived ? "opacity-60" : ""
                  }`}
                  onClick={() => navigate(`/tools/journals/${journal.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {journal.isDefault && (
                          <Star className="h-3.5 w-3.5 text-primary shrink-0" fill="currentColor" />
                        )}
                        <span className="font-semibold text-sm truncate">{journal.title}</span>
                        {journal.isArchived && (
                          <span className="text-xs text-muted-foreground">{t("journals.archived")}</span>
                        )}
                      </div>
                      {journal.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{journal.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{t("journals.entryCount", { count: journal.entryCount })}</span>
                        {journal.accessList.length > 1 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {journal.accessList.length}
                          </span>
                        )}
                        {(journal.linkedGoal || journal.linkedProject) && (
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {journal.linkedGoal?.title ?? journal.linkedProject?.title}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!journal.isDefault && !journal.isArchived && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleSetDefault(journal.id)}
                          title={t("journals.setDefault")}
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!journal.isArchived && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => handleArchive(journal.id)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </InternalPageLayout>
    </>
  );
}
