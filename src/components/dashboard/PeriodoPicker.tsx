import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  detectPreset,
  formatPillDate,
  PRESET_LABEL,
  type PresetKey,
  presetToRange,
} from "@/lib/date-presets";

interface PeriodoPickerProps {
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
}

const PRESETS_ORDEM: PresetKey[] = [
  "hoje",
  "ultimos_7",
  "ultimos_30",
  "este_mes",
  "mes_passado",
  "este_trimestre",
  "este_ano",
];

export function PeriodoPicker({ value, onChange }: PeriodoPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    value ?? undefined,
  );

  React.useEffect(() => {
    setDraft(value ?? undefined);
  }, [value]);

  const presetAtivo = detectPreset(
    value && value.from && value.to ? { from: value.from, to: value.to } : null,
  );

  const handlePreset = (p: PresetKey) => {
    const r = presetToRange(p);
    onChange({ from: r.from, to: r.to });
    setOpen(false);
  };

  const handleCalendarSelect = (next: DateRange | undefined) => {
    setDraft(next);
    if (next?.from && next?.to) {
      onChange({ from: next.from, to: next.to });
      setOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary/40",
            open && "border-primary/50 bg-secondary/40",
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {value && value.from && value.to ? (
            <>
              <span className="font-medium text-foreground">
                {formatPillDate(value.from)} → {formatPillDate(value.to)}
              </span>
              <span
                role="button"
                tabIndex={0}
                aria-label="Limpar período"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleClear(e);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Selecionar período</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex">
          {/* Sidebar de atalhos */}
          <div className="w-40 shrink-0 border-r border-border p-3">
            <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Atalhos
            </div>
            <div className="flex flex-col gap-0.5">
              {PRESETS_ORDEM.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePreset(p)}
                  className={cn(
                    "rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60",
                    presetAtivo === p &&
                      "bg-primary/10 font-medium text-primary",
                  )}
                >
                  {PRESET_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Calendário duplo */}
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draft}
              onSelect={handleCalendarSelect}
              defaultMonth={draft?.from ?? new Date()}
              locale={ptBR}
              className="pointer-events-auto p-3"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
