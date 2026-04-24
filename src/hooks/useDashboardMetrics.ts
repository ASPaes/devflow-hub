import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export type DashboardMetrics = {
  total: number;
  abertas: number;
  prioritarias_abertas: number;
  concluidas_mes: number;
  por_status: Record<string, number>;
  por_prioridade: Record<string, number>;
};

export function useDashboardMetrics(enabled = true) {
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_metrics");
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
