export interface DateRange {
  from: Date;
  to: Date;
}

export type PresetKey =
  | "hoje"
  | "ultimos_7"
  | "ultimos_30"
  | "este_mes"
  | "mes_passado"
  | "este_trimestre"
  | "este_ano";

export const PRESET_LABEL: Record<PresetKey, string> = {
  hoje: "Hoje",
  ultimos_7: "Últimos 7 dias",
  ultimos_30: "Últimos 30 dias",
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  este_trimestre: "Este trimestre",
  este_ano: "Este ano",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function presetToRange(preset: PresetKey, today: Date = new Date()): DateRange {
  const t = startOfDay(today);
  switch (preset) {
    case "hoje":
      return { from: t, to: endOfDay(today) };

    case "ultimos_7": {
      const from = new Date(t);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfDay(today) };
    }

    case "ultimos_30": {
      const from = new Date(t);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfDay(today) };
    }

    case "este_mes": {
      const from = new Date(t.getFullYear(), t.getMonth(), 1);
      const to = new Date(t.getFullYear(), t.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }

    case "mes_passado": {
      const from = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const to = new Date(t.getFullYear(), t.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }

    case "este_trimestre": {
      const trimestre = Math.floor(t.getMonth() / 3);
      const from = new Date(t.getFullYear(), trimestre * 3, 1);
      const to = new Date(t.getFullYear(), trimestre * 3 + 3, 0, 23, 59, 59, 999);
      return { from, to };
    }

    case "este_ano": {
      const from = new Date(t.getFullYear(), 0, 1);
      const to = new Date(t.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { from, to };
    }
  }
}

export function detectPreset(
  range: DateRange | null | undefined,
  today: Date = new Date(),
): PresetKey | null {
  if (!range || !range.from || !range.to) return null;
  const presets: PresetKey[] = [
    "hoje",
    "ultimos_7",
    "ultimos_30",
    "este_mes",
    "mes_passado",
    "este_trimestre",
    "este_ano",
  ];
  for (const p of presets) {
    const r = presetToRange(p, today);
    if (
      startOfDay(r.from).getTime() === startOfDay(range.from).getTime() &&
      startOfDay(r.to).getTime() === startOfDay(range.to).getTime()
    ) {
      return p;
    }
  }
  return null;
}

/** yyyy-mm-dd local (não UTC) */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatPillDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = String(d.getFullYear()).slice(2);
  return `${day}/${m}/${y}`;
}

// ============= Tipo de data =============
export type TipoData = "criacao" | "desenvolvimento" | "entrega";

export const TIPO_DATA_LABEL: Record<TipoData, string> = {
  criacao: "Data de Criação",
  desenvolvimento: "Data de Desenvolvimento",
  entrega: "Data de Entrega",
};

// ============= Parser/formatador de input dd/MM/yyyy =============

/**
 * Parser tolerante de string para Date.
 * Aceita: "01/04/2026", "1/4/2026", "01/04/26", "1/4/26"
 * Retorna null se inválido.
 */
export function parseDDMMYYYY(input: string): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;

  const [, dStr, mStr, yStr] = match;
  const day = Number(dStr);
  const month = Number(mStr);
  let year = Number(yStr);

  if (yStr.length === 2) year = 2000 + year;

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Formata Date como "01/04/2026" (4 dígitos no ano)
 */
export function formatInputDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}
