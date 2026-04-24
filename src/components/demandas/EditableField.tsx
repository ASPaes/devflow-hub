import * as React from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditableFieldProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  maxLength?: number;
  minLength?: number;
  ariaLabel?: string;
}

export function EditableField({
  value,
  onSave,
  multiline = false,
  placeholder = "—",
  className,
  inputClassName,
  disabled = false,
  maxLength,
  minLength,
  ariaLabel,
}: EditableFieldProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const start = () => {
    if (disabled || saving) return;
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setEditing(false);
      return;
    }
    if (minLength != null && trimmed.length < minLength) return;
    if (maxLength != null && trimmed.length > maxLength) return;
    try {
      setSaving(true);
      await onSave(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter") {
      if (multiline) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          void save();
        }
      } else {
        e.preventDefault();
        void save();
      }
    }
  };

  if (!editing) {
    return (
      <div
        className={cn(
          "group relative rounded-md",
          !disabled &&
            "cursor-text hover:bg-secondary/40 -mx-1 px-1 transition-colors",
          className,
        )}
        onClick={start}
        role={disabled ? undefined : "button"}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            start();
          }
        }}
        aria-label={ariaLabel}
      >
        {value ? (
          multiline ? (
            <p className="whitespace-pre-wrap">{value}</p>
          ) : (
            <span>{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {!disabled && (
          <Pencil
            className="absolute right-1 top-1 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50"
            aria-hidden
          />
        )}
      </div>
    );
  }

  const InputComp = multiline ? Textarea : Input;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <InputComp
        value={draft}
        onChange={(
          e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        ) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        disabled={saving}
        maxLength={maxLength}
        className={cn(multiline && "min-h-[140px]", inputClassName)}
        aria-label={ariaLabel}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" />
          )}
          Salvar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={cancel}
          disabled={saving}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Cancelar
        </Button>
        {multiline && (
          <span className="ml-auto text-xs text-muted-foreground">
            Ctrl+Enter pra salvar
          </span>
        )}
      </div>
    </div>
  );
}
