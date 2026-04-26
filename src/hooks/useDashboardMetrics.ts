import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import { toIsoDate } from "@/lib/date-presets";

export type DashboardMetrics = {
  total: number;
  abertas: number;
  prioritarias_abertas: number;
  concluidas_periodo: number;
  por_status: Record<string, number>;
  por_prioridade: Record<string, number>;
  periodo: { data_inicio: string | null; data_fim: string | null };
};

export function useDashboardMetrics(
  periodo: DateRange | null,
  enabled = true,
) {
  const dataInicio = periodo?.from ? toIsoDate(periodo.from) : null;
  const dataFim = periodo?.to ? toIsoDate(periodo.to) : null;

  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics", dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_metrics", {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      });
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
