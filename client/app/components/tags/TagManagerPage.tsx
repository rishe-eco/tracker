import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Check } from "lucide-react";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_TAGS, CREATE_TAG, RENAME_TAG, RECOLOR_TAG, DELETE_TAG } from "~/api/queries";
import { TAG_PALETTE, tagColorClasses, type TagColor } from "~/lib/tagPalette";
import { cn } from "~/lib/utils";
import { useSubmitGuard } from "~/utils/useSubmitGuard";

interface Tag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
}

function PalettePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: TagColor) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("tags.colorLabel")}>
      {TAG_PALETTE.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`tags.colorNames.${color}`)}
            onClick={() => onChange(color)}
            className={cn(
              "h-6 w-6 rounded-full border shrink-0",
              tagColorClasses(color).dot,
              selected && "ring-2 ring-offset-2 ring-ring"
            )}
          />
        );
      })}
    </div>
  );
}

export default function TagManagerPage() {
  const { t } = useTranslation();
  const { call } = useApi();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColor>(TAG_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColor>(TAG_PALETTE[0]);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const { submitting: creating, run: runCreate } = useSubmitGuard();
  const { submitting: savingEdit, run: runSaveEdit } = useSubmitGuard();

  const load = () => call({ query: GET_TAGS }).then((res) => setTags(res?.tags ?? []));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setError(null);
    const name = newName.trim();
    if (!name) return;
    await runCreate(async () => {
      const res = await call({ query: CREATE_TAG, variables: { name, color: newColor } });
      if (!res?.createTag) {
        setError(t("tags.errors.createFailed"));
        return;
      }
      setNewName("");
      setNewColor(TAG_PALETTE[0]);
      load();
    });
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor((tag.color as TagColor) ?? TAG_PALETTE[0]);
  };

  const handleSaveEdit = async (tag: Tag) => {
    setError(null);
    const name = editName.trim();
    if (!name) return;
    await runSaveEdit(async () => {
      const renamed = name !== tag.name ? await call({ query: RENAME_TAG, variables: { id: tag.id, name } }) : true;
      const recolored =
        editColor !== tag.color ? await call({ query: RECOLOR_TAG, variables: { id: tag.id, color: editColor } }) : true;
      if (!renamed || !recolored) {
        setError(t("tags.errors.saveFailed"));
        return;
      }
      setEditingId(null);
      load();
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await call({ query: DELETE_TAG, variables: { id: deleteTarget.id } });
    setDeleteTarget(null);
    load();
  };

  if (tags === null) return <LoadingBlock className="p-6" />;

  return (
    <InternalPageLayout
      backLink={{ to: "/settings", label: `← ${t("settings.title")}` }}
      title={t("tags.managerTitle")}
    >
      <p className="text-sm text-muted-foreground mb-4">{t("tags.managerDescription")}</p>

      <div className="space-y-2 mb-6">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("tags.noTags")}</p>
        ) : (
          tags.map((tag) => {
            const classes = tagColorClasses(tag.color);
            const isEditing = editingId === tag.id;
            return (
              <div key={tag.id} className="border rounded-md p-3 space-y-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor={`tag-edit-name-${tag.id}`}>{t("tags.nameLabel")}</Label>
                    <Input
                      id={`tag-edit-name-${tag.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Label>{t("tags.colorLabel")}</Label>
                    <PalettePicker value={editColor} onChange={setEditColor} />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" loading={savingEdit} onClick={() => handleSaveEdit(tag)}>
                        <Check className="h-4 w-4 mr-1" /> {t("common.save")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={savingEdit}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={cn("h-3 w-3 rounded-full shrink-0", classes.dot)} aria-hidden />
                    <span className="flex-1 font-medium text-sm">{tag.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {tag.usageCount === 1
                        ? t("tags.usageCountOne", { count: tag.usageCount })
                        : t("tags.usageCountOther", { count: tag.usageCount })}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(tag)}>
                      {t("tags.edit")}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(tag)}
                      title={t("common.delete")}
                      aria-label={t("common.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border rounded-md p-3 space-y-2">
        <Label htmlFor="new-tag-name">{t("tags.newTagLabel")}</Label>
        <Input
          id="new-tag-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("tags.newTagPlaceholder")}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Label>{t("tags.colorLabel")}</Label>
        <PalettePicker value={newColor} onChange={setNewColor} />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button size="sm" onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
          <Plus className="h-4 w-4 mr-1" /> {t("tags.newTagButton")}
        </Button>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("tags.deleteConfirmTitle", { name: deleteTarget?.name ?? "" })}
        description={t("tags.deleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </InternalPageLayout>
  );
}
