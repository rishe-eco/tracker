import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Lock, Plus } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { tagColorClasses, TAG_PALETTE } from "~/lib/tagPalette";

export interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface TagPickerProps {
  /** Every tag the user owns (the shared vocabulary), for the "add" dropdown. */
  availableTags: TagOption[];
  /** Ids of the tags currently attached, in display order. */
  selectedTagIds: string[];
  /** Not called at all when `locked` is true. */
  onChange?: (tagIds: string[]) => void;
  /**
   * Create-and-attach a brand-new tag from within the picker. When provided and
   * not locked, an inline "new tag" field is shown so a user with an empty (or
   * incomplete) vocabulary can add tags without leaving the form. Returns the
   * created tag (already added to the vocabulary) or null on failure.
   */
  onCreateTag?: (name: string, color: string) => Promise<TagOption | null>;
  /**
   * Gathered actions: tags are inherited from the source interval/routine and
   * cannot be edited here (time-themes.md §3.1) — render read-only chips, no
   * ×, no "+ tag". The server enforces this too (setActionTags rejects a
   * gathered action); this is only the affordance.
   */
  locked?: boolean;
  /** Shown under the chips when locked, e.g. "inherited from interval". */
  lockedNote?: string;
  /** Shown under the chips when editable and pre-filled from a source, e.g. "seeded from the project". */
  seededNote?: string;
  className?: string;
}

/** Where a user manages the full shared tag vocabulary (time-themes.md §7.1). */
const MANAGE_TAGS_HREF = "/settings/tags";

/** Tag picker (chips) — shared vocabulary across Project/Interval/Routine/Action/TimeTheme (time-themes.md §7). */
export default function TagPicker({
  availableTags,
  selectedTagIds,
  onChange,
  onCreateTag,
  locked = false,
  lockedNote,
  seededNote,
  className,
}: TagPickerProps) {
  const { t } = useTranslation();
  const byId = new Map(availableTags.map((tg) => [tg.id, tg]));
  const selected = selectedTagIds.map((id) => byId.get(id)).filter((tg): tg is TagOption => Boolean(tg));
  const unselected = availableTags.filter((tg) => !selectedTagIds.includes(tg.id));

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const remove = (id: string) => onChange?.(selectedTagIds.filter((tid) => tid !== id));
  const add = (id: string) => {
    if (!id || selectedTagIds.includes(id)) return;
    onChange?.([...selectedTagIds, id]);
  };

  // Auto-pick the next palette colour so inline creation stays a single field;
  // the user can recolour in the manager (time-themes.md §7.1).
  const nextColor = TAG_PALETTE[availableTags.length % TAG_PALETTE.length];
  const canCreate = !locked && Boolean(onCreateTag);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating || !onCreateTag) return;
    setCreateError(null);
    setCreating(true);
    try {
      const tag = await onCreateTag(name, nextColor);
      if (!tag) {
        setCreateError(t("tags.errors.createFailed"));
        return;
      }
      setNewName("");
      onChange?.([...selectedTagIds, tag.id]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 && locked && (
          <span className="text-sm text-muted-foreground">{t("tags.none")}</span>
        )}
        {selected.map((tg) => {
          const classes = tagColorClasses(tg.color);
          return (
            <Badge
              key={tg.id}
              variant="outline"
              className={cn(classes.chip, "gap-1.5")}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", classes.dot)} aria-hidden />
              {tg.name}
              {!locked && (
                <button
                  type="button"
                  onClick={() => remove(tg.id)}
                  aria-label={t("tags.removeTag", { name: tg.name })}
                  className="ms-0.5 opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              )}
            </Badge>
          );
        })}
        {!locked && unselected.length > 0 && (
          <select
            aria-label={t("tags.addTag")}
            value=""
            onChange={(e) => add(e.target.value)}
            className="h-6 rounded-md border border-dashed border-input bg-transparent px-2 text-xs text-muted-foreground"
          >
            <option value="">+ {t("tags.addTag")}</option>
            {unselected.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {canCreate && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn("h-2 w-2 rounded-full shrink-0", tagColorClasses(nextColor).dot)}
            aria-hidden
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder={t("tags.newTagInlinePlaceholder")}
            aria-label={t("tags.newTagLabel")}
            className="h-7 w-44 rounded-md border border-input bg-transparent px-2 text-xs"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || creating}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-input px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3 shrink-0" aria-hidden />
            {t("tags.createTag")}
          </button>
        </div>
      )}

      {createError && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {createError}
        </p>
      )}

      {!locked && availableTags.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("tags.emptyHint")}</p>
      )}

      {!locked && (
        <Link
          to={MANAGE_TAGS_HREF}
          className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("tags.manageLink")}
        </Link>
      )}

      {locked && lockedNote && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          {lockedNote}
        </p>
      )}
      {!locked && seededNote && (
        <p className="text-xs text-muted-foreground">{seededNote}</p>
      )}
    </div>
  );
}
