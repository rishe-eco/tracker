import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { tagColorClasses } from "~/lib/tagPalette";

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

/** Tag picker (chips) — shared vocabulary across Project/Interval/Routine/Action/TimeTheme (time-themes.md §7). */
export default function TagPicker({
  availableTags,
  selectedTagIds,
  onChange,
  locked = false,
  lockedNote,
  seededNote,
  className,
}: TagPickerProps) {
  const { t } = useTranslation();
  const byId = new Map(availableTags.map((tg) => [tg.id, tg]));
  const selected = selectedTagIds.map((id) => byId.get(id)).filter((tg): tg is TagOption => Boolean(tg));
  const unselected = availableTags.filter((tg) => !selectedTagIds.includes(tg.id));

  const remove = (id: string) => onChange?.(selectedTagIds.filter((tid) => tid !== id));
  const add = (id: string) => {
    if (!id || selectedTagIds.includes(id)) return;
    onChange?.([...selectedTagIds, id]);
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
