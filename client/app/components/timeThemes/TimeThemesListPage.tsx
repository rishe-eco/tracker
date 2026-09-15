import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil } from "lucide-react";
import InternalPageLayout from "~/layout/InternalPageLayout";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { LoadingBlock } from "~/components/ui/spinner";
import { useApi } from "~/api/useApi";
import { GET_TIME_THEMES, DELETE_TIME_THEME } from "~/api/queries";
import { tagColorClasses } from "~/lib/tagPalette";
import { cn } from "~/lib/utils";

interface TimeThemeListItem {
  id: string;
  title: string;
  status: "active" | "inactive";
  startTimeOfDay: string;
  endTimeOfDay: string;
  repeatValue: number;
  repeatUnit: string | null;
  tags: { id: string; name: string; color: string }[];
}

function formatRepeats(theme: TimeThemeListItem, t: (k: string, o?: any) => string): string {
  if (theme.repeatUnit) {
    const unit = theme.repeatValue === 1 ? theme.repeatUnit : `${theme.repeatUnit}s`;
    return t("intervals.repeatsLabel") + ` Every ${theme.repeatValue} ${unit}`;
  }
  return "—";
}

export default function TimeThemesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { call } = useApi();
  const [themes, setThemes] = useState<TimeThemeListItem[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeThemeListItem | null>(null);

  const load = () => call({ query: GET_TIME_THEMES }).then((res) => setThemes(res?.timeThemes ?? []));

  useEffect(() => {
    load();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await call({ query: DELETE_TIME_THEME, variables: { id: deleteTarget.id } });
    setDeleteTarget(null);
    load();
  };

  if (themes === null) return <LoadingBlock className="p-6" />;

  return (
    <InternalPageLayout
      backLink={{ to: "/activities", label: `← ${t("activities.backToActivities")}` }}
      title={t("timeThemes.listTitle")}
      actions={
        <Button size="sm" onClick={() => navigate("/activities/timeTheme")}>
          <Plus className="h-4 w-4 mr-2" /> {t("timeThemes.addTitle")}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground mb-4">{t("timeThemes.listDescription")}</p>
      <div className="space-y-3">
        {themes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("timeThemes.noThemes")}</p>
        ) : (
          themes.map((theme) => (
            <div key={theme.id} className="border rounded-md p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-semibold text-sm line-clamp-1 flex-1 min-w-0">{theme.title}</h2>
                <Badge variant={theme.status === "active" ? "default" : "secondary"}>
                  {theme.status === "active" ? t("intervals.active") : t("intervals.inactive")}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {/* dir="ltr": two LTR time tokens joined by a bare dash read
                    reversed under the RTL bidi algorithm otherwise — visible
                    live in fa ("12:00–08:00" for a theme stored as 08:00–12:00). */}
                <span dir="ltr">
                  {theme.startTimeOfDay}–{theme.endTimeOfDay}
                </span>
                <span>{formatRepeats(theme, t)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {theme.tags.map((tag) => {
                  const classes = tagColorClasses(tag.color);
                  return (
                    <span
                      key={tag.id}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", classes.chip)}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", classes.dot)} aria-hidden />
                      {tag.name}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => navigate(`/activities/timeTheme/${theme.id}`)}
                  title={t("goalManage.manage")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(theme)}
                  title={t("common.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("timeThemes.deleteConfirmTitle")}
        description={t("timeThemes.deleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </InternalPageLayout>
  );
}
