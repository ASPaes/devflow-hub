import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";

export function useExcluirDemanda() {
  const qc = useQueryClient();
  return useMutation<void, Error, { demandaId: string; motivo: string }>({
    mutationFn: async ({ demandaId, motivo }) => {
      const { error } = await supabase.rpc("excluir_demanda", {
        p_demanda_id: demandaId,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["demandas-excluidas"] });
      toast.success("Demanda excluída com sucesso");
    },
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("Sem permissão")) {
        toast.error("Você não tem permissão para excluir demandas");
      } else if (msg.toLowerCase().includes("motivo")) {
        toast.error(msg);
      } else if (msg.includes("já foi excluída")) {
        toast.error("Esta demanda já foi excluída");
      } else {
        toast.error(translateSupabaseError(err, "demanda"));
      }
    },
  });
}

export function useRestaurarDemanda() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (demandaId) => {
      const { error } = await supabase.rpc("restaurar_demanda", {
        p_demanda_id: demandaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["demandas-excluidas"] });
      toast.success("Demanda restaurada");
    },
    onError: (err) => toast.error(err.message || "Erro ao restaurar"),
  });
}
