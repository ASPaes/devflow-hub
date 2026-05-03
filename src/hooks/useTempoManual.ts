import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export function useInserirTempoManual() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { demandaId: string; data: string; segundos: number }
  >({
    mutationFn: async ({ demandaId, data, segundos }) => {
      const { error } = await supabase.rpc("inserir_tempo_manual_log", {
        p_demanda_id: demandaId,
        p_data: data,
        p_segundos: segundos,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["timer-log", vars.demandaId] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Tempo lançado manualmente");
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("Já existe lançamento manual")) {
        toast.error("Já existe lançamento manual neste dia. Edite o existente.");
      } else if (m.includes("data futura")) {
        toast.error("Não é possível lançar tempo em data futura");
      } else if (m.includes("Sem permissão")) {
        toast.error("Você não tem permissão para inserir tempo manualmente");
      } else if (m.includes("maior que zero")) {
        toast.error("Tempo deve ser maior que zero");
      } else {
        toast.error(m || "Erro ao lançar tempo");
      }
    },
  });
}

export function useAtualizarTempoManual(demandaId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { logId: string; segundos: number }>({
    mutationFn: async ({ logId, segundos }) => {
      const { error } = await supabase.rpc("atualizar_tempo_manual_log", {
        p_log_id: logId,
        p_segundos: segundos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timer-log", demandaId] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Lançamento atualizado");
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar"),
  });
}

export function usePausarTimerComAjuste() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { demandaId: string; ajustes: Array<{ data: string; segundos: number }> }
  >({
    mutationFn: async ({ demandaId, ajustes }) => {
      const { error } = await supabase.rpc("pausar_timer_com_ajuste", {
        p_demanda_id: demandaId,
        p_ajustes: ajustes,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["demanda"] });
      qc.invalidateQueries({ queryKey: ["timer-log", vars.demandaId] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Timer pausado com tempo ajustado");
    },
    onError: (err) => toast.error(err.message || "Erro ao ajustar tempo"),
  });
}

export function useExcluirTempoManual(demandaId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (logId) => {
      const { error } = await supabase.rpc("excluir_tempo_manual_log", {
        p_log_id: logId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timer-log", demandaId] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Lançamento excluído");
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir"),
  });
}
