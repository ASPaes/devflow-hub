import * as React from "react";
import { AlertCircle, Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  detectPreset,
  formatInputDate,
  formatPillDate,
  parseDDMMYYYY,
  PRESET_LABEL,
  type PresetKey,
  presetToRange,
  TIPO_DATA_LABEL,
  type TipoData,
} from "@/lib/date-presets";

interface PeriodoPickerProps {
  value: DateRange | null;
  onChange: (value: DateRange | null) => void;
  tipoData: TipoData;
  onTipoDataChange: (tipo: TipoData) => void;
  apenasSemData: boolean;
  onApenasSemDataChange: (apenas: boolean) => void;
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

export function PeriodoPicker({
  value,
  onChange,
  tipoData,
  onTipoDataChange,
  apenasSemData,
  onApenasSemDataChange,
}: PeriodoPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    value ?? undefined,
  );

  const [fromInput, setFromInput] = React.useState(
    value?.from ? formatInputDate(value.from) : "",
  );
  const [toInput, setToInput] = React.useState(
    value?.to ? formatInputDate(value.to) : "",
  );
  const [fromError, setFromError] = React.useState(false);
  const [toError, setToError] = React.useState(false);

  React.useEffect(() => {
    setDraft(value ?? undefined);
    setFromInput(value?.from ? formatInputDate(value.from) : "");
    setToInput(value?.to ? formatInputDate(value.to) : "");
    setFromError(false);
    setToError(false);
  }, [value]);

  const presetAtivo = !apenasSemData
    ? detectPreset(
        value && value.from && value.to
          ? { from: value.from, to: value.to }
          : null,
      )
    : null;

  const handlePreset = (p: PresetKey) => {
    const r = presetToRange(p);
    onApenasSemDataChange(false);
    onChange({ from: r.from, to: r.to });
    setOpen(false);
  };

  const handleSemData = () => {
    onApenasSemDataChange(true);
    onChange(null);
    setOpen(false);
  };

  const handleCalendarSelect = (next: DateRange | undefined) => {
    setDraft(next);
    if (next?.from) {
      setFromInput(formatInputDate(next.from));
      setFromError(false);
    }
    if (next?.to) {
      setToInput(formatInputDate(next.to));
      setToError(false);
    }
    if (next?.from && next?.to) {
      onApenasSemDataChange(false);
      onChange({ from: next.from, to: next.to });
      setOpen(false);
    }
  };

  const commitInputs = () => {
    const fromDate = fromInput ? parseDDMMYYYY(fromInput) : null;
    const toDate = toInput ? parseDDMMYYYY(toInput) : null;

    setFromError(!!fromInput && !fromDate);
    setToError(!!toInput && !toDate);

    if (fromDate && toDate) {
      const [from, to] =
        fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate];
      onApenasSemDataChange(false);
      onChange({ from, to });
      setDraft({ from, to });
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitInputs();
    }
  };

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onApenasSemDataChange(false);
    onChange(null);
  };

  const semDataDisponivel =
    tipoData === "desenvolvimento" || tipoData === "entrega";

  // Quando muda tipo de data e estava em "sem data" mas o tipo novo não suporta
  React.useEffect(() => {
    if (apenasSemData && !semDataDisponivel) {
      onApenasSemDataChange(false);
    }
  }, [apenasSemData, semDataDisponivel, onApenasSemDataChange]);

  return (
    <div className="flex items-center gap-2">
      {/* Seletor de tipo de data */}
      <Select
        value={tipoData}
        onValueChange={(v) => onTipoDataChange(v as TipoData)}
      >
        <SelectTrigger className="h-9 w-[210px] rounded-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="criacao">{TIPO_DATA_LABEL.criacao}</SelectItem>
          <SelectItem value="desenvolvimento">
            {TIPO_DATA_LABEL.desenvolvimento}
          </SelectItem>
          <SelectItem value="entrega">{TIPO_DATA_LABEL.entrega}</SelectItem>
        </SelectContent>
      </Select>

      {/* Pill de período / Sem data */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary/40",
              open && "border-primary/50 bg-secondary/40",
              apenasSemData &&
                "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400",
            )}
          >
            {apenasSemData ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            )}
            {apenasSemData ? (
              <span className="font-medium">Sem data definida</span>
            ) : value && value.from && value.to ? (
              <span className="font-medium text-foreground">
                {formatPillDate(value.from)} → {formatPillDate(value.to)}
              </span>
            ) : (
              <span className="text-muted-foreground">Selecionar período</span>
            )}
            {(apenasSemData || (value && value.from && value.to)) && (
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
            <div className="w-44 shrink-0 border-r border-border p-3">
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

                {semDataDisponivel && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      onClick={handleSemData}
                      className={cn(
                        "rounded px-2 py-1.5 text-left text-sm transition-colors",
                        apenasSemData
                          ? "bg-amber-500/15 font-medium text-amber-700 dark:text-amber-400"
                          : "text-amber-700 hover:bg-amber-500/10 dark:text-amber-400",
                      )}
                    >
                      ⚠️ Sem data
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inputs manuais + Calendário duplo */}
            <div className="p-2">
              <div className="mb-2 flex items-center gap-3 px-2 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">De</label>
                  <Input
                    placeholder="dd/mm/aaaa"
                    value={fromInput}
                    onChange={(e) => {
                      setFromInput(e.target.value);
                      setFromError(false);
                    }}
                    onBlur={commitInputs}
                    onKeyDown={handleInputKeyDown}
                    className={cn(
                      "h-8 w-32 text-sm",
                      fromError && "border-destructive",
                    )}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Até</label>
                  <Input
                    placeholder="dd/mm/aaaa"
                    value={toInput}
                    onChange={(e) => {
                      setToInput(e.target.value);
                      setToError(false);
                    }}
                    onBlur={commitInputs}
                    onKeyDown={handleInputKeyDown}
                    className={cn(
                      "h-8 w-32 text-sm",
                      toError && "border-destructive",
                    )}
                  />
                </div>
              </div>

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
    </div>
  );
}
