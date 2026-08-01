import { Info } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";

type HintPopoverProps = {
  textKey: string;
  conceptsAnchor?: string;
};

export default function HintPopover({ textKey, conceptsAnchor }: HintPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const href = conceptsAnchor ? `/concepts#${conceptsAnchor}` : "/concepts";

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-flex shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={t("hints.hintLabel")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-72 rounded-md border bg-background p-3 shadow-md text-sm space-y-2">
          <p className="text-muted-foreground leading-relaxed">{t(textKey)}</p>
          <Link
            to={href}
            className="text-xs text-primary hover:underline block"
            onClick={() => setOpen(false)}
          >
            {t("hints.learnMore")}
          </Link>
        </div>
      )}
    </div>
  );
}
