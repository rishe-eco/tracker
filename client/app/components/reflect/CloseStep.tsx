import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReflectFooter, ReflectNotSaved } from "./ReflectShell";
import { ReflectTextInput } from "./ReflectTextInput";
import type { ReflectContent, ReflectEntry, ReflectTextField } from "./types";

/**
 * The re-reading close (spec §4.7, plate 7): one optional multi-line field, and
 * Finish in Next's place. Finish is never disabled, so an empty field closes
 * the entry too (AC-33). A failed save is told by the page when Finish is
 * tapped, not by a disabled button.
 */
export function CloseStep({
  entry,
  content,
  onChange,
  failed,
  onRetry,
  onBack,
  onFinish,
  busy,
}: {
  entry: ReflectEntry;
  content: ReflectContent;
  onChange: (field: ReflectTextField, value: string) => void;
  failed: boolean;
  onRetry: () => void;
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [close, setClose] = useState(entry.close ?? "");
  return (
    <div className="space-y-6">
      <ReflectTextInput
        id="reflect-close"
        label={content.prompts.close.prompt}
        value={close}
        max={content.limits.close}
        multiline
        onChange={(v) => {
          setClose(v);
          onChange("close", v);
        }}
      />
      {failed && <ReflectNotSaved onRetry={onRetry} />}
      <ReflectFooter onBack={onBack} backDisabled={busy} onNext={onFinish} nextLabel={t("reflect.nav.finish")} />
    </div>
  );
}
