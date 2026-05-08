import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DemandaReabertura {
  id: string;
  motivo: string;
  reaberta_por: string | null;
  reaberta_por_nome: string | null;
  reaberta_em: string;
  status_anterior: string;
}

export function useReaberturasDemanda(demandaId: string | undefined) {
  return useQuery<DemandaReabertura[]>({
    queryKey: ["reaberturas", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase.rpc(
        "listar_reaberturas_demanda",
        { p_demanda_id: demandaId },
      );
      if (error) throw error;
      return (data ?? []) as unknown as DemandaReabertura[];
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}
