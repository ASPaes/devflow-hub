/**
 * Exibicao das horas na aba Horas Dev (/admin/horas).
 *
 * So muda como o tempo aparece, nunca quanto se paga: o Total a Pagar continua
 * saindo de (segundos / 3600) * valor_hora, na RPC relatorio_horas_desenvolvedor.
 *
 * O decimal confundia: 0,71 h sao 42 minutos, mas se le como "71 minutos".
 * Periodo que comeca antes do corte mantem o decimal, como foi pedido.
 */
export const INICIO_HORAS_CORRIDAS = "2026-10-01";

export function usaHorasCorridas(dataInicio: string): boolean {
  return dataInicio >= INICIO_HORAS_CORRIDAS;
}

/** 2542 -> "00h 42m 22s". Com os segundos, a conta com o Valor/Hora fecha exata. */
export function formatHorasCorridas(segundos: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(h)}h ${dois(m)}m ${dois(s)}s`;
}

export function formatHorasDecimais(horas: number | null | undefined): string {
  return (Number(horas) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Escolhe o formato pelo inicio do periodo filtrado. */
export function formatTempoDoPeriodo(
  dataInicio: string,
  tempo: { segundos: number | null | undefined; horas: number | null | undefined },
): string {
  return usaHorasCorridas(dataInicio)
    ? formatHorasCorridas(tempo.segundos)
    : formatHorasDecimais(tempo.horas);
}
