import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { StatusDemanda } from "@/hooks/useDemandas";

interface MoverVariables {
  demandaId: string;
  novoStatus: StatusDemanda;
  statusAnterior: StatusDemanda;
}

interface MoverContext {
  snapshots: Array<[QueryKey, unknown]>;
}

export function useMoverStatusDemanda() {
  const qc = useQueryClient();
  return useMutation<void, Error, MoverVariables, MoverContext>({
    mutationFn: async ({ demandaId, novoStatus }) => {
      const { error, count } = await supabase
        .from("demandas")
        .update({ status: novoStatus }, { count: "exact" })
        .eq("id", demandaId);
      if (error) throw error;
      if (count === 0) {
        throw new Error("Sem permissão para mover esta demanda");
      }
    },
    onMutate: async ({ demandaId, novoStatus }) => {
      await qc.cancelQueries({ queryKey: ["demandas"] });
      const snapshots = qc.getQueriesData({ queryKey: ["demandas"] });

      qc.setQueriesData({ queryKey: ["demandas"] }, (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((d: Record<string, unknown>) =>
            d?.id === demandaId ? { ...d, status: novoStatus } : d,
          );
        }
        return old;
      });

      return { snapshots };
    },
    onError: (err, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      toast.error(err.message || "Erro ao mover demanda");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
  });
}
