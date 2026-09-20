import { useTranslation } from "react-i18next";
import InternalPageLayout from "~/layout/InternalPageLayout";

/**
 * The log (spec §4.3) — days in reverse, no counts, no patterns, no search,
 * no person filter (the dossier fence). Stub — phase 6b builds it.
 */
export default function NoticingLogPage() {
  const { t } = useTranslation();
  return (
    <InternalPageLayout title={t("impact.noticing.log.open")}>
      <p className="text-sm text-muted-foreground">{t("impact.noticing.comingSoon")}</p>
    </InternalPageLayout>
  );
}
