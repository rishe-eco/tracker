import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { BookOpen, PlayCircle } from "lucide-react";
import UnderConstruction from "../UnderConstruction";
import OnboardingSlideshow from "../onboarding/OnboardingSlideshow";
import ApiTokensSection from "./ApiTokensSection";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "react-i18next";
import { setLanguage, type AppLanguage } from "~/i18n/config";
import { CALENDAR_SYSTEMS, setCalendarSystem } from "~/i18n/calendar";
import { useAppDate } from "~/i18n/useAppDate";
import { useApi } from "~/api/useApi";
import { GET_ME_DISCOVERABILITY, UPDATE_DISCOVERABILITY } from "~/api/queries";

export default function SettingsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  const { calendar, fmt } = useAppDate();
  const { call } = useApi();
  const [discoverableByEmail, setDiscoverableByEmail] = useState(false);
  const [discoverabilityLoaded, setDiscoverabilityLoaded] = useState(false);
  const [replayingTour, setReplayingTour] = useState(false);

  useEffect(() => {
    call({ query: GET_ME_DISCOVERABILITY }).then((res: any) => {
      setDiscoverableByEmail(res?.me?.discoverableByEmail ?? false);
      setDiscoverabilityLoaded(true);
    });
  }, []);

  const handleDiscoverabilityToggle = (checked: boolean) => {
    setDiscoverableByEmail(checked);
    call({ query: UPDATE_DISCOVERABILITY, variables: { discoverableByEmail: checked } });
  };

  const handleLogout = () => {
    // Clear whatever you use for auth
    // localStorage.removeItem("token"); // or sessionStorage, etc.
    // optionally: clear any global auth context
    // redirect to login
    auth.logout();
    navigate("/login");
  };
  return (
    <main className="space-y-8 p-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("language.switcherLabel")}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={i18n.language === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => void setLanguage("en" as AppLanguage)}
          >
            {t("language.english")}
          </Button>
          <Button
            variant={i18n.language === "fa" ? "default" : "outline"}
            size="sm"
            onClick={() => void setLanguage("fa" as AppLanguage)}
          >
            {t("language.persian")}
          </Button>
        </div>
      </section>
      {/* Its own section rather than a line under Language, because the two are
          independent: choosing here stops the calendar from following the
          language toggle, in either direction. */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("calendarSystem.switcherLabel")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("calendarSystem.description")}</p>
        <div className="flex items-center gap-2">
          {CALENDAR_SYSTEMS.map((system) => (
            <Button
              key={system}
              variant={calendar === system ? "default" : "outline"}
              size="sm"
              onClick={() => setCalendarSystem(system)}
            >
              {t(`calendarSystem.${system}`)}
              <span className="ms-1.5 text-xs opacity-70">
                {t(`calendarSystem.${system}Hint`)}
              </span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("calendarSystem.preview", { date: fmt(new Date(), "weekdayDayMonthYear") })}
        </p>
      </section>
      {/* The guide lives in the desktop sidebar only, and the welcome tour is
          shown once — so Settings is the one place both stay reachable, mobile
          included. */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("settings.guide.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.guide.description")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/concepts">
              <BookOpen className="h-4 w-4" />
              {t("settings.guide.openGuide")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReplayingTour(true)}>
            <PlayCircle className="h-4 w-4" />
            {t("settings.guide.replayWelcome")}
          </Button>
        </div>
      </section>
      {replayingTour && (
        <OnboardingSlideshow replay onClose={() => setReplayingTour(false)} />
      )}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("settings.discoverability.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.discoverability.description")}</p>
        <div className="flex items-center gap-3">
          <Switch
            checked={discoverableByEmail}
            onCheckedChange={handleDiscoverabilityToggle}
            disabled={!discoverabilityLoaded}
          />
          <span className="text-sm">
            {discoverableByEmail ? t("settings.discoverability.on") : t("settings.discoverability.off")}
          </span>
        </div>
      </section>
      <ApiTokensSection />
      <section className="space-y-4">
        <UnderConstruction title={t("settings.underConstruction")} />
      <Button variant="default" onClick={handleLogout}>
        {t("settings.logout")}
      </Button>
      </section>
    </main>
  );
}
