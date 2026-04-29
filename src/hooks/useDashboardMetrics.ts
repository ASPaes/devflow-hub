import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import { toIsoDate, type TipoData } from "@/lib/date-presets";

export type ResponsavelStat = {
  id: string | null;
  nome: string;
  avatar_url: string | null;
  total: number;
  total_segundos: number;
};

export type DashboardMetrics = {
  total: number;
  abertas: number;
  prioritarias_abertas: number;
  concluidas_periodo: number;
  sem_dev_deadline: number;
  sem_deadline: number;
  por_status: Record<string, number>;
  por_prioridade: Record<string, number>;
  por_responsavel: ResponsavelStat[];
  periodo: {
    data_inicio: string | null;
    data_fim: string | null;
    tipo_data: TipoData;
    apenas_sem_data: boolean;
  };
};

export type DashboardFiltros = {
  status: string[];
  prioridade: number[];
  tipo: string[];
  modulo_id: string[];
  area_id: string[];
  tenant_id: string[];
  responsavel_id: string[];
  solicitante_id: string[];
};

export const FILTROS_VAZIOS: DashboardFiltros = {
  status: [],
  prioridade: [],
  tipo: [],
  modulo_id: [],
  area_id: [],
  tenant_id: [],
  responsavel_id: [],
  solicitante_id: [],
};

export function useDashboardMetrics(
  periodo: DateRange | null,
  enabled = true,
  filtros: DashboardFiltros = FILTROS_VAZIOS,
  tipoData: TipoData = "criacao",
  apenasSemData: boolean = false,
) {
  const dataInicio = periodo?.from ? toIsoDate(periodo.from) : undefined;
  const dataFim = periodo?.to ? toIsoDate(periodo.to) : undefined;

  return useQuery<DashboardMetrics>({
    queryKey: [
      "dashboard-metrics",
      dataInicio ?? null,
      dataFim ?? null,
      filtros,
      tipoData,
      apenasSemData,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_metrics", {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
        p_status: filtros.status.length > 0 ? filtros.status : undefined,
        p_prioridade:
          filtros.prioridade.length > 0 ? filtros.prioridade : undefined,
        p_tipo: filtros.tipo.length > 0 ? filtros.tipo : undefined,
        p_modulo_id:
          filtros.modulo_id.length > 0 ? filtros.modulo_id : undefined,
        p_area_id: filtros.area_id.length > 0 ? filtros.area_id : undefined,
        p_tenant_id:
          filtros.tenant_id.length > 0 ? filtros.tenant_id : undefined,
        p_responsavel_id:
          filtros.responsavel_id.length > 0
            ? filtros.responsavel_id
            : undefined,
        p_solicitante_id:
          filtros.solicitante_id.length > 0
            ? filtros.solicitante_id
            : undefined,
        p_tipo_data: tipoData,
        p_apenas_sem_data: apenasSemData,
      });
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
