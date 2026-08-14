/**
 * A date input that follows the calendar setting.
 *
 * ## The value contract does not change
 *
 * In and out, `value` is a Gregorian `yyyy-MM-dd` string — exactly what
 * `<input type="date">` gives you and exactly what the API expects. The Jalali
 * mode converts only at the edges: what the person reads and types is
 * `1405/05/24`, what the component emits is `2026-08-15`. That is what lets the
 * ~20 call sites be a straight substitution of `<Input type="date">` with
 * `<DateField>` and nothing else.
 *
 * ## Gregorian mode is the untouched native input
 *
 * Deliberately not "one custom picker for both". The native control gives the
 * platform date picker on phones, which is materially better than anything
 * rendered in-page, and leaving it in place means the existing calendar has no
 * regression surface at all. The cost — the field looks different between the
 * two modes — is the smaller of the two prices.
 */

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { Input } from "./input";
import { useAppDate } from "~/i18n/useAppDate";
import { DatePickerGrid } from "./date-picker-grid";
import { parseDateOnly, toLocalDateString } from "~/utils/dateUtils";

/**
 * The subset of a change event the call sites actually read.
 *
 * A real `ChangeEvent` satisfies it, so Gregorian mode forwards the native
 * handler untouched and every existing `onChange={(e) => …e.target.value}`
 * keeps working verbatim.
 */
export type DateFieldChangeEvent = { target: { value: string } };

export type DateFieldProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  /** Gregorian `yyyy-MM-dd`, or `""` for empty. */
  value: string;
  onChange?: (event: DateFieldChangeEvent) => void;
  /** Gregorian `yyyy-MM-dd` bounds, as on the native input. */
  min?: string;
  max?: string;
};

export function DateField(props: DateFieldProps) {
  const { calendar } = useAppDate();
  if (calendar === "jalali") return <JalaliDateField {...props} />;
  return <Input type="date" {...props} />;
}

/**
 * The `datetime-local` counterpart.
 *
 * Same contract: `value` and `min` are Gregorian `yyyy-MM-ddTHH:mm`. Gregorian
 * mode is the untouched native control; Jalali mode splits the pair into a
 * `DateField` and a plain `<input type="time">`, which needs no calendar at all.
 *
 * One behavioural difference in Jalali mode: `min` constrains the date but not
 * the time-of-day on the boundary day. The only caller passes midnight of the
 * current day, so the bound is really "not in the past" at day resolution and
 * nothing is lost — but a caller wanting minute-level bounds would not get it.
 */
export function DateTimeField({ value, onChange, min, className, ...rest }: DateFieldProps) {
  const { calendar } = useAppDate();
  const [datePart = "", timePart = ""] = (value || "").split("T");
  const [minDatePart] = (min || "").split("T");

  if (calendar === "gregorian") {
    return (
      <Input
        type="datetime-local"
        value={value}
        onChange={onChange}
        min={min}
        className={className}
        {...rest}
      />
    );
  }

  const emit = (nextDate: string, nextTime: string) => {
    if (!nextDate) {
      onChange?.({ target: { value: "" } });
      return;
    }
    onChange?.({ target: { value: `${nextDate}T${nextTime || "00:00"}` } });
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DateField
        {...rest}
        value={datePart}
        min={minDatePart}
        onChange={(e) => emit(e.target.value, timePart)}
      />
      <Input
        type="time"
        aria-label={rest["aria-label"]}
        disabled={rest.disabled}
        value={timePart}
        onChange={(e) => emit(datePart, e.target.value)}
        className="w-28 shrink-0"
      />
    </div>
  );
}

function JalaliDateField({
  value,
  onChange,
  min,
  max,
  className,
  disabled,
  ...rest
}: DateFieldProps) {
  const { t } = useTranslation();
  const { dfns, fmtRaw, parseTyped } = useAppDate();

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(() => (value ? parseDateOnly(value) : null), [value]);
  const minDate = React.useMemo(() => (min ? parseDateOnly(min) : null), [min]);
  const maxDate = React.useMemo(() => (max ? parseDateOnly(max) : null), [max]);

  // What the box shows. Kept separate from `value` so a half-typed "1405/0" is
  // not thrown away or round-tripped into nonsense on every keystroke.
  const [draft, setDraft] = React.useState(() =>
    selected ? fmtRaw(selected, "yyyy/MM/dd") : ""
  );
  const [editing, setEditing] = React.useState(false);

  // Adopt changes that came from elsewhere — a parent resetting the form, the
  // grid being clicked — but never while the person is mid-keystroke.
  React.useEffect(() => {
    if (editing) return;
    setDraft(selected ? fmtRaw(selected, "yyyy/MM/dd") : "");
  }, [selected, editing, fmtRaw]);

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const outOfRange = React.useCallback(
    (day: Date) => {
      if (minDate && day < dfns.startOfDay(minDate)) return true;
      if (maxDate && day > dfns.startOfDay(maxDate)) return true;
      return false;
    },
    [minDate, maxDate, dfns]
  );

  const emit = React.useCallback(
    (day: Date | null) => {
      onChange?.({ target: { value: day ? toLocalDateString(day) : "" } });
    },
    [onChange]
  );

  const commitDraft = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") {
      emit(null);
      return;
    }
    const parsed = parseTyped(trimmed);
    // An unparseable or out-of-range entry snaps back to the last good value
    // rather than silently clearing the field — losing a date someone already
    // chose because they fumbled a keystroke is the worse failure.
    if (!parsed || outOfRange(parsed)) {
      setDraft(selected ? fmtRaw(selected, "yyyy/MM/dd") : "");
      return;
    }
    emit(parsed);
    setDraft(fmtRaw(parsed, "yyyy/MM/dd"));
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div className="flex items-center gap-1">
        <Input
          {...rest}
          type="text"
          inputMode="numeric"
          // The date reads left-to-right (1405/05/24) even inside RTL text.
          dir="ltr"
          disabled={disabled}
          // `className` lands on both the wrapper and the input on purpose. Call
          // sites mix layout utilities (`flex-1`, `w-36`) with appearance ones
          // (`h-8 text-sm`), and only the wrapper can honour the first kind.
          // `flex-1` here makes any width utility inert on the input itself, so
          // nothing is applied twice in a way that shows.
          className={cn("flex-1 min-w-0", className)}
          placeholder="1400/01/01"
          value={draft}
          onFocus={() => setEditing(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            setEditing(false);
            commitDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            setEditing(false);
            commitDraft(draft);
            (e.target as HTMLInputElement).blur();
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={t("calendarSystem.openPicker")}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-[17rem] rounded-md border bg-background shadow-md">
          <DatePickerGrid
            selected={selected}
            min={minDate}
            max={maxDate}
            onSelect={(day) => {
              emit(day);
              setDraft(fmtRaw(day, "yyyy/MM/dd"));
              setOpen(false);
            }}
          />

          <div className="mx-3 mb-3 flex items-center justify-between border-t pt-2">
            <button
              type="button"
              // Only selects when today is in range. A `min` of tomorrow makes
              // this a no-op rather than a control that silently does nothing
              // visible — the grid keeps today marked either way.
              onClick={() => {
                const today = dfns.startOfDay(new Date());
                if (outOfRange(today)) return;
                emit(today);
                setDraft(fmtRaw(today, "yyyy/MM/dd"));
                setOpen(false);
              }}
              className="text-xs text-primary hover:underline"
            >
              {t("calendar.today")}
            </button>
            <button
              type="button"
              onClick={() => {
                emit(null);
                setDraft("");
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:underline"
            >
              {t("calendarSystem.clearDate")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
