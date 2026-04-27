import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface HoraMinutoInputProps {
  /** Valor em horas decimais (ex: 2.5 = 2h 30m). null/undefined = vazio */
  value: number | null | undefined;
  /** Chamado quando usuário sai do input (blur) ou aperta Enter, com valor em horas decimais */
  onChange: (horasDecimal: number | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

/** Converte horas decimais (2.5) para { horas: 2, minutos: 30 }. */
export function decimalParaHM(decimal: number | null | undefined): {
  horas: number;
  minutos: number;
} {
  if (decimal == null || isNaN(decimal) || decimal < 0) {
    return { horas: 0, minutos: 0 };
  }
  const horas = Math.floor(decimal);
  const minutos = Math.round((decimal - horas) * 60);
  if (minutos === 60) return { horas: horas + 1, minutos: 0 };
  return { horas, minutos };
}

export function hmParaDecimal(horas: number, minutos: number): number {
  return horas + minutos / 60;
}

/** Formata horas decimais como "02h 30m" */
export function formatHM(decimal: number | null | undefined): string {
  const { horas, minutos } = decimalParaHM(decimal);
  return `${String(horas).padStart(2, "0")}h ${String(minutos).padStart(2, "0")}m`;
}

/** Formata segundos como "02h 30m" (helper pro card Tempo) */
export function formatHMFromSegundos(segundos: number | null | undefined): string {
  if (!segundos || segundos < 0) return "00h 00m";
  return formatHM(segundos / 3600);
}

/**
 * Parser tolerante. Aceita "2h 30m", "2h30m", "2h", "30m", "2.5", "0230", "230".
 * Retorna null se inválido.
 */
export function parseHM(input: string): number | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === "" || s === "0" || s === "00h 00m" || s === "0h 0m") return 0;

  const matchHM = s.match(/^(\d+)\s*h(?:\s*(\d+)\s*m?)?$/);
  if (matchHM) {
    const h = Number(matchHM[1]);
    const m = matchHM[2] ? Number(matchHM[2]) : 0;
    if (m >= 60) return null;
    return hmParaDecimal(h, m);
  }
  const matchM = s.match(/^(\d+)\s*m$/);
  if (matchM) {
    const m = Number(matchM[1]);
    return m / 60;
  }

  const matchDecimal = s.match(/^(\d+(\.\d+)?)$/);
  if (matchDecimal) {
    return Number(matchDecimal[1]);
  }

  const matchFour = s.match(/^(\d{2})(\d{2})$/);
  if (matchFour) {
    const h = Number(matchFour[1]);
    const m = Number(matchFour[2]);
    if (m >= 60) return null;
    return hmParaDecimal(h, m);
  }

  const matchThree = s.match(/^(\d)(\d{2})$/);
  if (matchThree) {
    const h = Number(matchThree[1]);
    const m = Number(matchThree[2]);
    if (m >= 60) return null;
    return hmParaDecimal(h, m);
  }

  return null;
}

export function HoraMinutoInput({
  value,
  onChange,
  disabled,
  readOnly,
  placeholder = "00h 00m",
  className,
}: HoraMinutoInputProps) {
  const [text, setText] = React.useState<string>(formatHM(value));
  const [error, setError] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      setText(formatHM(value));
      setError(false);
    }
  }, [value, focused]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "" || trimmed === "00h 00m") {
      setError(false);
      onChange(0);
      setText("00h 00m");
      return;
    }
    const parsed = parseHM(trimmed);
    if (parsed === null) {
      setError(true);
      return;
    }
    setError(false);
    onChange(parsed);
    setText(formatHM(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setText(formatHM(value));
      setError(false);
      e.currentTarget.blur();
    }
  };

  if (readOnly) {
    return (
      <span className={cn("font-mono tabular-nums", className)}>
        {formatHM(value)}
      </span>
    );
  }

  return (
    <Input
      type="text"
      inputMode="text"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        setError(false);
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-8 font-mono text-sm tabular-nums",
        error && "border-destructive focus-visible:ring-destructive",
        className,
      )}
    />
  );
}
