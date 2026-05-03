/**
 * Distribui um intervalo (inicio→fim) em dias atravessados.
 * Mesma lógica do RPC pausar_timer_demanda.
 */
export function distribuirTempoEntreDoisDias(
  inicio: Date,
  fim: Date,
): Array<{ data: string; segundos: number }> {
  if (fim <= inicio) return [];

  const resultado: Array<{ data: string; segundos: number }> = [];
  let cursor = new Date(inicio);

  while (cursor < fim) {
    const proximoDia = new Date(cursor);
    proximoDia.setHours(24, 0, 0, 0);

    const fimPeriodo = proximoDia > fim ? fim : proximoDia;
    const segundos = Math.round(
      (fimPeriodo.getTime() - cursor.getTime()) / 1000,
    );

    if (segundos > 0) {
      const dataStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      resultado.push({ data: dataStr, segundos });
    }

    cursor = fimPeriodo;
  }

  return resultado;
}
