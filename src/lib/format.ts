const SP_TZ = "America/Sao_Paulo";

export function formatDateTimeSP(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: SP_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateSP(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: SP_TZ });
}

export function formatRelativeSP(iso: string | null | undefined): string {
  if (!iso) return "—";
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, "day");
  return formatDateSP(iso);
}

/**
 * Formata segundos em "HHh MMm" (ex: 9000 → "02h 30m").
 */
export function formatDuracao(segundos: number): string {
  if (!segundos || segundos < 0) return "00h 00m";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

/**
 * Formata data ISO (yyyy-mm-dd) em "Seg 25/04/2026".
 */
export function formatDataLogPT(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dia = diasSemana[date.getDay()];
  return `${dia} ${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
}
