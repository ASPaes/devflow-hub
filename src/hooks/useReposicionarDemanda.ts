import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { StatusDemanda } from "@/hooks/useDemandas";

interface ReposicionarVariables {
  demandaId: string;
  novoStatus: StatusDemanda;
  statusAnterior: StatusDemanda;
  novaPosicao: number;
}

interface ReposicionarContext {
  snapshots: Array<[QueryKey, unknown]>;
}

export function useReposicionarDemanda() {
  const qc = useQueryClient();
  return useMutation<void, Error, ReposicionarVariables, ReposicionarContext>({
    mutationFn: async ({ demandaId, novoStatus, novaPosicao }) => {
      const { error, count } = await supabase
        .from("demandas")
        .update(
          { status: novoStatus, posicao: novaPosicao },
          { count: "exact" },
        )
        .eq("id", demandaId);
      if (error) throw error;
      if (count === 0) {
        throw new Error("Sem permissão para mover esta demanda");
      }
    },
    onMutate: async ({ demandaId, novoStatus, novaPosicao }) => {
      await qc.cancelQueries({ queryKey: ["demandas"] });
      const snapshots = qc.getQueriesData({ queryKey: ["demandas"] });

      qc.setQueriesData({ queryKey: ["demandas"] }, (old: unknown) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((d: Record<string, unknown>) =>
            d?.id === demandaId
              ? { ...d, status: novoStatus, posicao: novaPosicao }
              : d,
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
