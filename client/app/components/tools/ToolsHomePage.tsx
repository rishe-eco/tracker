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
        {/* One row per lab, each saying which of the two skills it trains. Two
            bare buttons under a sentence naming both skills left the reader to
            work out which was which — and the buttons were in the opposite
            order to the sentence. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col items-start gap-2 rounded-md border bg-background/60 p-4">
            <p className="text-sm">{t("toolsHome.evidenceLabTrains")}</p>
            <Button className="mt-auto" onClick={() => navigate("/tools/skills/evidence")}>
              {t("toolsHome.openEvidenceLab")}
            </Button>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-md border bg-background/60 p-4">
            <p className="text-sm">{t("toolsHome.clarityLabTrains")}</p>
            <Button className="mt-auto" onClick={() => navigate("/tools/skills/clarity")}>
              {t("toolsHome.openClarityLab")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">{t("toolsHome.learnTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("toolsHome.learnDescription")}</p>
        </div>
        <Button onClick={() => navigate("/tools/learn/feelings-needs")}>
          {t("toolsHome.openFeelingsNeeds")}
        </Button>
      </section>
    </main>
  );
}
