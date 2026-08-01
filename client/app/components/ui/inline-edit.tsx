import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export type InlineEditProps = {
  /** Current value (controlled from parent). */
  value: string;
  /** Called when user commits edit (blur or Enter). */
  onSave: (value: string) => void;
  /** Placeholder when empty and when in edit mode. */
  placeholder?: string;
  /** Display element when not editing. */
  displayAs: "h1" | "h2" | "p";
  /** Class name for the display element. */
  displayClassName?: string;
  /** Class name for the input when editing. */
  inputClassName?: string;
  /** Unique id for the input (for label htmlFor and a11y). */
  id: string;
  /** Text shown when value is empty (display mode). Defaults to placeholder. */
  emptyDisplay?: string;
  /** If true, wrapper in edit mode is a label (clicking label focuses input). */
  labelFocus?: boolean;
};

const pencilIcon = (
  <Pencil className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
);

export function InlineEdit({
  value,
  onSave,
  placeholder,
  displayAs,
  displayClassName,
  inputClassName,
  id,
  emptyDisplay,
  labelFocus = true,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setTemp(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    setEditing(false);
    onSave(temp);
  };

  const displayText = value || (emptyDisplay ?? placeholder ?? "");
  const DisplayTag = displayAs;

  if (editing) {
    const input = (
      <Input
        ref={inputRef}
        id={id}
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder={placeholder}
        className={cn("min-w-0 flex-1", inputClassName)}
      />
    );
    if (labelFocus) {
      return (
        <label
          className={cn(
            "flex items-center gap-2 cursor-pointer",
            displayAs === "p" && "w-full"
          )}
          htmlFor={id}
        >
          {pencilIcon}
          {input}
        </label>
      );
    }
    return (
      <span className="flex items-center gap-2 min-w-0 flex-1">
        {pencilIcon}
        {input}
      </span>
    );
  }

  return (
    <DisplayTag
      className={cn(
        "cursor-pointer flex items-center gap-2",
        displayAs === "p" && "text-muted-foreground",
        displayClassName
      )}
      onClick={startEditing}
    >
      {displayText}
      {pencilIcon}
    </DisplayTag>
  );
}
