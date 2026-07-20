import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { type AgenteExecucao, STATUS_AGENTE_ATIVO } from "@/types/agente";

const key = (demandaId: string) => ["agente-execucoes", demandaId] as const;

/** Lista execuções do agente para a demanda (mais recente primeiro). */
export function useAgenteExecucoes(demandaId: string | undefined) {
  return useQuery({
    queryKey: key(demandaId ?? ""),
    enabled: !!demandaId,
    queryFn: async (): Promise<AgenteExecucao[]> => {
      const { data, error } = await supabase
        .from("agente_execucoes")
        .select(
          `id, demanda_id, status, github_run_id, github_run_url, pr_url,
           deploy_url, resumo, erro_mensagem, retorno_id, disparado_por,
           created_at, updated_at, finished_at`,
        )
        .eq("demanda_id", demandaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgenteExecucao[];
    },
    // Faz polling enquanto houver execução ativa; para quando tudo está terminal.
    refetchInterval: (query) => {
      const list = (query.state.data ?? []) as AgenteExecucao[];
      const ativa = list.some((e) => STATUS_AGENTE_ATIVO.includes(e.status));
      return ativa ? 4000 : false;
    },
  });
}

/** Dispara o agente para a demanda. */
export function useAcionarAgente() {
  const qc = useQueryClient();
  return useMutation<{ execucao_id: string }, Error, { demandaId: string }>({
    mutationFn: async ({ demandaId }) => {
      const { data, error } = await supabase.functions.invoke("disparar-agente", {
        body: { demanda_id: demandaId },
      });
      if (error) throw new Error(error.message || "Erro ao acionar agente");
      if (data?.error) throw new Error(data.error);
      if (!data?.execucao_id) throw new Error("Resposta vazia do disparo");
      return data as { execucao_id: string };
    },
    onSuccess: (_res, { demandaId }) => {
      toast.success("Agente acionado — acompanhe o progresso abaixo");
      qc.invalidateQueries({ queryKey: key(demandaId) });
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("permissão") || m.includes("403")) {
        toast.error("Apenas Desenvolvedores podem acionar o agente");
      } else if (m.includes("repositório")) {
        toast.error("O produto desta demanda não tem repositório configurado");
      } else {
        toast.error(`Erro ao acionar agente: ${m}`);
      }
    },
  });
}
