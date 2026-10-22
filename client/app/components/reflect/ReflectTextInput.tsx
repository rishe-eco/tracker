import { useTranslation } from "react-i18next";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

/**
 * One Reflect text field: its prompt as the label, `dir="auto"` so Persian
 * typed under an English prompt reads right to left and English in a Persian
 * page reads left to right (G7, AC-64), and `maxLength` at the bound the API
 * serves (G13, AC-51): the page stops typing there and says so in one sentence
 * with no number (AC-44). `maxLength` counts UTF-16 units, the same count the
 * server's bound uses.
 *
 * B5's fields (moments, readings, the close) use this too.
 */
export function ReflectTextInput({
  id,
  label,
  value,
  onChange,
  max,
  multiline = false,
  placeholder,
  softLine,
  disabled,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  multiline?: boolean;
  placeholder?: string;
  /** Past this many characters the keep-it-to-one-scene sentence shows (AC-20). Story only. */
  softLine?: number;
  disabled?: boolean;
  /** For the one place that moves focus into a field (the reality check's camera half, W10). */
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const { t } = useTranslation();
  const atBound = value.length >= max;
  const pastSoft = softLine != null && value.length > softLine && !atBound;
  const noteId = `${id}-note`;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {/* The prompt is practice content, in the practice locale, which needn't be
            the page's (PD-7): isolated, so an English prompt in a Persian page keeps
            its question mark at its end. The line still aligns with the page. */}
        <span dir="auto">{label}</span>
      </label>
      {multiline ? (
        <Textarea
          id={id}
          dir="auto"
          rows={8}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={atBound || pastSoft ? noteId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          ref={inputRef}
          dir="auto"
          value={value}
          maxLength={max}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={atBound ? noteId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {atBound && (
        <p id={noteId} className="text-sm text-muted-foreground">
          {t("reflect.bound")}
        </p>
      )}
      {pastSoft && (
        <p id={noteId} className="text-sm text-muted-foreground">
          {t("reflect.story.softLine")}
        </p>
      )}
    </div>
  );
}
