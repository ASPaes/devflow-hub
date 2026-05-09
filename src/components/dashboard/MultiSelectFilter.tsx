import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string | number> {
  value: T;
  label: string;
}

interface MultiSelectFilterProps<T extends string | number> {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  loading?: boolean;
}

export function MultiSelectFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  loading,
}: MultiSelectFilterProps<T>) {
  const [open, setOpen] = React.useState(false);
  const hasSelection = selected.length > 0;

  const toggleValue = (v: T) => {
    if (selected.includes(v)) {
      onChange(selected.filter((x) => x !== v));
    } else {
      onChange([...selected, v]);
    }
  };

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary/40",
            (open || hasSelection) && "border-primary/50 bg-secondary/40",
          )}
        >
          <span className={cn("font-medium", hasSelection ? "text-foreground" : "text-muted-foreground")}>
            {label}
          </span>
          {hasSelection ? (
            <>
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                {selected.length}
              </span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Limpar ${label}`}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleClear(e);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            </>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {hasSelection && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>
        {!loading && options.length > 0 && (() => {
          const allSelected = selected.length === options.length;
          const someSelected = hasSelection && !allSelected;
          return (
            <button
              type="button"
              onClick={() =>
                onChange(allSelected ? [] : options.map((o) => o.value))
              }
              className="flex w-full items-center gap-2 border-b border-border px-3 py-1.5 text-left text-sm hover:bg-secondary/60"
            >
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                className="pointer-events-none"
              />
              <span className="flex-1 truncate font-medium">
                {allSelected ? "Desmarcar tudo" : "Selecionar tudo"}
              </span>
            </button>
          );
        })()}
        {loading ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Carregando...
          </div>
        ) : options.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nenhuma opção disponível
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="py-1">
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={String(opt.value)}
                    onClick={() => toggleValue(opt.value)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary/60"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
