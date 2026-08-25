import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { useTranslation } from "react-i18next";
import { useApi } from "~/api/useApi";
import { GET_SKILLS_OVERVIEW } from "~/api/queries";
import type { SkillOverview } from "~/components/skills/trainingLab";

export default function ToolsHomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { call } = useApi();

  // The one piece of state on an otherwise static page, and it is decoration.
  // Six lab cards used to live here; six equal doors asked the reader to make a
  // decision they had no basis for, on a page whose other three sections are a
  // heading, a sentence and a button. The recommendation moved to the hub.
  const [overview, setOverview] = useState<SkillOverview[] | null>(null);

  useEffect(() => {
    // Deliberately no error state and no spinner: if this fails, the section is
    // a heading, a sentence and a button, exactly as it would have been. A
    // learner who cannot reach the API still needs the door to open.
    void call({ query: GET_SKILLS_OVERVIEW }).then((res) => {
      if (res?.skillsOverview) setOverview(res.skillsOverview);
    });
  }, [call]);

  const startedCount = overview?.filter((o) => o.totalAttempts > 0).length ?? 0;
  const reviewsDue = overview?.reduce((n, o) => n + o.dueModules.length, 0) ?? 0;

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
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link to="/tools/skills">{t("toolsHome.openSkills")}</Link>
          </Button>
          {overview && (
            <p className="text-sm text-muted-foreground">
              {t("skills.hub.startedCount", { count: startedCount, total: overview.length })}
              {reviewsDue > 0 && <> · {t("skills.hub.reviewsDue", { count: reviewsDue })}</>}
            </p>
          )}
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
