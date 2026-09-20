import { useTranslation } from "react-i18next";
import InternalPageLayout from "~/layout/InternalPageLayout";

/**
 * The day-one frame (spec §4.1). Stub — phase 4 builds beat 1's five steps,
 * the `can't think of one` reroute, and beat 2's prediction and correction.
 */
export default function NoticingFramePage() {
  const { t } = useTranslation();
  return (
    <InternalPageLayout title={t("impact.noticing.frame.cardTitle")}>
      <p className="text-sm text-muted-foreground">{t("impact.noticing.comingSoon")}</p>
    </InternalPageLayout>
  );
}
