import { Button } from "~/components/ui/button";
import { useTranslation } from "react-i18next";

type FilterOption = {
  id: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  alwaysMuted?: boolean;
};

interface ListFiltersProps {
  linksLabel: string;
  statusLabel: string;
  showLinksFilters: boolean;
  showStatusFilters: boolean;
  onToggleLinks: () => void;
  onToggleStatus: () => void;
  onReset: () => void;
  linkOptions: FilterOption[];
  statusOptions: FilterOption[];
}

export default function ListFilters({
  linksLabel,
  statusLabel,
  showLinksFilters,
  showStatusFilters,
  onToggleLinks,
  onToggleStatus,
  onReset,
  linkOptions,
  statusOptions,
}: ListFiltersProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToggleLinks}>
          {t("filters.links")}: {linksLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onToggleStatus}>
          {t("filters.status")}: {statusLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          {t("filters.reset")}
        </Button>
      </div>

      {showLinksFilters && (
        <div className="flex flex-wrap gap-2 rounded-md border p-3 bg-muted/20">
          {linkOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={opt.onClick}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                opt.alwaysMuted
                  ? "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  : opt.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {showStatusFilters && (
        <div className="flex flex-wrap gap-2 rounded-md border p-3 bg-muted/20">
          {statusOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={opt.onClick}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                opt.active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
