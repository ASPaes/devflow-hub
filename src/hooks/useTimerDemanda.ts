import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { Demanda } from "./useDemandas";

export type TempoOrigem = "automatico" | "manual";

export interface TimerLogRow {
  id: string;
  data: string;
  segundos: number;
  origem: TempoOrigem;
  autor_manual_id: string | null;
}

export function useIniciarTimer() {
  const qc = useQueryClient();
  return useMutation<Demanda, Error, string>({
    mutationFn: async (demandaId) => {
      const { data, error } = await supabase.rpc("iniciar_timer_demanda", {
        p_demanda_id: demandaId,
      });
      if (error) throw error;
      return data as unknown as Demanda;
    },
    onSuccess: (data) => {
      if (data.codigo) {
        qc.invalidateQueries({ queryKey: ["demanda", data.codigo] });
      }
      qc.invalidateQueries({ queryKey: ["demandas"] });
    },
    onError: (err) => toast.error(err.message || "Erro ao iniciar timer"),
  });
}

export function usePausarTimer() {
  const qc = useQueryClient();
  return useMutation<Demanda, Error, string>({
    mutationFn: async (demandaId) => {
      const { data, error } = await supabase.rpc("pausar_timer_demanda", {
        p_demanda_id: demandaId,
      });
      if (error) throw error;
      return data as unknown as Demanda;
    },
    onSuccess: (data) => {
      if (data.codigo) {
        qc.invalidateQueries({ queryKey: ["demanda", data.codigo] });
      }
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["timer-log", data.id] });
    },
    onError: (err) => toast.error(err.message || "Erro ao pausar timer"),
  });
}

export function useTimerLog(demandaId: string | undefined) {
  return useQuery<TimerLogRow[]>({
    queryKey: ["timer-log", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase
        .from("demanda_timer_log")
        .select("data, segundos")
        .eq("demanda_id", demandaId)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimerLogRow[];
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}
