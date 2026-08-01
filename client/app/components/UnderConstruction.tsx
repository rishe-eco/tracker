// components/UnderConstruction.tsx
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function UnderConstruction({ title = "Feature" }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <Alert className="border-l-4 border-yellow-400 bg-yellow-50">
      <Info className="h-4 w-4" />
      <AlertTitle>{title} – {t("common.underConstruction")}</AlertTitle>
      <AlertDescription>
        {t("common.underConstructionDescription")}
      </AlertDescription>
    </Alert>
  );
}
