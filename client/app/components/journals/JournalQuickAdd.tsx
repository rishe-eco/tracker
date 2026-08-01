import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ChevronDown, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useApi } from "~/api/useApi";
import { GET_JOURNALS, ADD_QUICK_ENTRY } from "~/api/queries";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

type JournalOption = { id: string; title: string; isDefault: boolean };

export default function JournalQuickAdd() {
  const { t } = useTranslation();
  const { call } = useApi();
  const [journals, setJournals] = useState<JournalOption[] | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    call({ query: GET_JOURNALS }).then((res: any) => {
      const list: JournalOption[] = (res?.journals ?? [])
        .filter((j: any) => !j.isArchived)
        .map((j: any) => ({ id: j.id, title: j.title, isDefault: j.isDefault }));
      setJournals(list);
      const def = list.find((j) => j.isDefault) ?? list[0];
      if (def) setTargetId(def.id);
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { submitting, run } = useSubmitGuard();

  const handleSubmit = async () => {
    if (!input.trim() || !targetId) return;
    await run(async () => {
      await call({
        query: ADD_QUICK_ENTRY,
        variables: { body: input.trim(), journalId: targetId },
      });
      setInput("");
    });
  };

  if (!journals || journals.length === 0) return null;

  const target = journals.find((j) => j.id === targetId);

  return (
    <section className="space-y-2 border-t pt-6">
      <h2 className="text-lg font-semibold text-muted-foreground">{t("today.journalQuickAdd")}</h2>
      <div className="flex items-center gap-2">
        {/* Journal label + picker */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 py-1"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="max-w-28 truncate">{target?.title ?? t("today.selectJournal")}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {showPicker && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-popover border rounded-md shadow-md min-w-40 py-1">
              {journals.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                    j.id === targetId ? "font-medium" : ""
                  }`}
                  onClick={() => {
                    setTargetId(j.id);
                    setShowPicker(false);
                  }}
                >
                  {j.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <Input
          placeholder={t("today.journalPlaceholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSubmit} disabled={!input.trim()} loading={submitting} variant="outline">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
