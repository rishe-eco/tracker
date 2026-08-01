import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import { X, Trash2, Check, Pencil } from "lucide-react";
import { useApi } from "~/api/useApi";
import { GET_NOTES, ADD_NOTE, UPDATE_NOTE, DELETE_NOTE } from "~/api/queries";
import { cn } from "~/lib/utils";
import { LoadingBlock, Spinner } from "~/components/ui/spinner";
import { useKeyedSubmitGuard } from "~/utils/useSubmitGuard";

export type EntityType =
  | "action"
  | "project"
  | "goal"
  | "milestone"
  | "routine"
  | "interval";

interface Note {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesModalProps {
  entityType: EntityType;
  entityId: string;
  entityTitle?: string;
  onClose: () => void;
}

export default function NotesModal({
  entityType,
  entityId,
  entityTitle,
  onClose,
}: NotesModalProps) {
  const { t } = useTranslation();
  const { call } = useApi();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const newInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    call({ query: GET_NOTES, variables: { entityType, entityId } }).then(
      (res: any) => {
        setNotes(res?.notes ?? []);
        setLoading(false);
      }
    );
  }, [entityType, entityId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const { isSubmitting: isDeleting, run: runDelete } = useKeyedSubmitGuard();

  const handleAdd = async () => {
    const body = newBody.trim();
    if (!body) return;
    setAdding(true);
    try {
      const res = await call({
        query: ADD_NOTE,
        variables: { entityType, entityId, body },
      });
      if (res?.addNote) {
        setNotes((prev) => [...prev, res.addNote]);
        setNewBody("");
        newInputRef.current?.focus();
      }
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditBody(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
  };

  const handleSaveEdit = async (id: string) => {
    const body = editBody.trim();
    if (!body) return;
    setSaving(true);
    try {
      const res = await call({ query: UPDATE_NOTE, variables: { id, body } });
      if (res?.updateNote) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, body: res.updateNote.body } : n
          )
        );
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await runDelete(id, async () => {
      await call({ query: DELETE_NOTE, variables: { id } });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) setEditingId(null);
    });
  };

  const handleNewKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === "Escape") setNewBody("");
  };

  const handleEditKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    id: string
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(id);
    }
    if (e.key === "Escape") cancelEdit();
  };

  const title = entityTitle
    ? t("notes.notesFor", { title: entityTitle })
    : t("notes.modalTitle");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
          <span className="font-semibold text-sm truncate pr-2">{title}</span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label={t("notes.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <LoadingBlock className="py-4" />
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("notes.emptyState")}
            </p>
          ) : (
            notes.map((note) =>
              editingId === note.id ? (
                <div
                  key={note.id}
                  className="rounded-md border bg-muted/30 p-2 space-y-2"
                >
                  <textarea
                    ref={editInputRef}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                    placeholder={t("notes.editPlaceholder")}
                    rows={3}
                    className="w-full text-sm rounded border-0 bg-transparent px-0 py-0 resize-none focus:outline-none"
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t("notes.cancelEdit")}
                    >
                      {t("common.cancel")}
                    </button>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={!editBody.trim() || saving}
                      loading={saving}
                      onClick={() => handleSaveEdit(note.id)}
                      aria-label={t("notes.saveNote")}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {saving ? t("notes.saving") : t("common.save")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={note.id}
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
                    {note.body}
                  </p>
                  <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(note)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      disabled={isDeleting(note.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded disabled:opacity-50 disabled:pointer-events-none"
                      aria-label={t("notes.deleteNote")}
                    >
                      {isDeleting(note.id) ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>

        {/* Add note input */}
        <div className="px-5 py-3 border-t shrink-0">
          <div className="flex gap-2">
            <input
              ref={newInputRef}
              type="text"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              onKeyDown={handleNewKeyDown}
              placeholder={t("notes.addPlaceholder")}
              className={cn(
                "flex-1 text-sm rounded-md border bg-background px-3 py-1.5",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
              disabled={adding}
            />
            <Button
              size="sm"
              disabled={!newBody.trim() || adding}
              loading={adding}
              onClick={handleAdd}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {t("notes.addButton")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
