import { useTranslation } from "react-i18next";
import InternalPageLayout from "~/layout/InternalPageLayout";

/**
 * The noticing loop (spec §4.2) — the spine. Stub — phase 3 builds place →
 * person → observation → need → optional small thing, the close, and the
 * bounded repeat.
 */
export default function NoticingLoopPage() {
  const { t } = useTranslation();
  return (
    <InternalPageLayout title={t("impact.noticing.loop.cardTitle")}>
      <p className="text-sm text-muted-foreground">{t("impact.noticing.comingSoon")}</p>
    </InternalPageLayout>
  );
}
