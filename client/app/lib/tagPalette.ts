/**
 * Time Themes: the shared tag vocabulary's fixed colour palette.
 *
 * Keys must match `api/src/services/tags.ts` `TAG_PALETTE` exactly — the
 * server is the source of truth (it rejects an unknown key on
 * createTag/recolorTag) and the client only needs the same set to render
 * swatches/chips/bands. Tailwind classes, not raw hex, so bands stay legible
 * in both light and dark without a second palette to keep in sync.
 */
export const TAG_PALETTE = ["indigo", "slate", "amber", "green", "plum", "teal", "rose"] as const;

export type TagColor = (typeof TAG_PALETTE)[number];

export function isTagColor(value: string): value is TagColor {
  return (TAG_PALETTE as readonly string[]).includes(value);
}

interface TagColorClasses {
  /** Chip / swatch: soft background, readable text, matching border. */
  chip: string;
  /** Solid dot (tag manager list, swatch picker). */
  dot: string;
  /** Timeline/calendar band: soft background + left accent border. */
  band: string;
}

const TAG_COLOR_CLASSES: Record<TagColor, TagColorClasses> = {
  indigo: {
    chip: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-700",
    dot: "bg-indigo-500",
    band: "bg-indigo-100/70 border-indigo-400 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-600",
  },
  slate: {
    chip: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-600",
    dot: "bg-slate-500",
    band: "bg-slate-100/70 border-slate-400 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-500",
  },
  amber: {
    chip: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-700",
    dot: "bg-amber-500",
    band: "bg-amber-100/70 border-amber-400 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-600",
  },
  green: {
    chip: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700",
    dot: "bg-emerald-500",
    band: "bg-emerald-100/70 border-emerald-400 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-600",
  },
  plum: {
    chip: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:border-fuchsia-700",
    dot: "bg-fuchsia-500",
    band: "bg-fuchsia-100/70 border-fuchsia-400 text-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:border-fuchsia-600",
  },
  teal: {
    chip: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-700",
    dot: "bg-teal-500",
    band: "bg-teal-100/70 border-teal-400 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-600",
  },
  rose: {
    chip: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-700",
    dot: "bg-rose-500",
    band: "bg-rose-100/70 border-rose-400 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-600",
  },
};

const FALLBACK: TagColorClasses = TAG_COLOR_CLASSES.slate;

export function tagColorClasses(color: string | null | undefined): TagColorClasses {
  if (color && isTagColor(color)) return TAG_COLOR_CLASSES[color];
  return FALLBACK;
}
