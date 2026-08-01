import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { useTranslation } from "react-i18next";

export default function ToolsHomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <main className="space-y-8 p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("toolsHome.title")}</h1>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">{t("toolsHome.timeMapTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("toolsHome.timeMapDescription")}
          </p>
        </div>
        <Button onClick={() => navigate("/tools/time-map")}>
          {t("toolsHome.openTimeMap")}
        </Button>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">{t("toolsHome.journalsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("toolsHome.journalsDescription")}
          </p>
        </div>
        <Button onClick={() => navigate("/tools/journals")}>
          {t("toolsHome.openJournals")}
        </Button>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">{t("toolsHome.skillsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("toolsHome.skillsDescription")}</p>
        </div>
        <Button onClick={() => navigate("/tools/skills/evidence")}>
          {t("toolsHome.openEvidenceLab")}
        </Button>
      </section>
    </main>
  );
}
