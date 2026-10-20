import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

type Props = {
  projectHref: string;
  onRemove: () => void;
};

/**
 * The card's ⋯ menu: exactly two items, "Open project" and "Remove from
 * period" (wireframes W6). A small local disclosure — a button and an
 * absolutely positioned list — rather than a new dependency. `end-0` is the
 * logical edge, so the list opens on the correct side in Persian.
 */
export default function CardMenu({ projectHref, onRemove }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={t("focus.cardMenu")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded px-2 py-0.5 text-lg leading-none text-muted-foreground hover:bg-muted"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-30 mt-1 min-w-44 rounded-md border bg-card py-1 text-sm shadow-md">
          <Link
            to={projectHref}
            role="menuitem"
            className="block px-3 py-1.5 hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            {t("focus.openProject")}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-1.5 text-start hover:bg-muted"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            {t("focus.removeFromPeriod")}
          </button>
        </div>
      )}
    </div>
  );
}
