import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface GerarPromptResponse {
  prompt: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export function useGerarPromptIA() {
  const qc = useQueryClient();
  return useMutation<GerarPromptResponse, Error, { demandaId: string }>({
    mutationFn: async ({ demandaId }) => {
      const { data, error } = await supabase.functions.invoke(
        "gerar-prompt-demanda",
        { body: { demanda_id: demandaId } },
      );

      if (error) {
        throw new Error(error.message || "Erro ao gerar prompt");
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      if (!data?.prompt) {
        throw new Error("Resposta vazia da IA");
      }
      return data as GerarPromptResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demanda"] });
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("permissão") || m.includes("403")) {
        toast.error("Apenas Desenvolvedores podem gerar prompts com IA");
      } else if (m.includes("ANTHROPIC_API_KEY")) {
        toast.error("Configuração da IA pendente. Avise o admin.");
      } else {
        toast.error(`Erro ao gerar prompt: ${m}`);
      }
    },
  });
}

export function useSalvarPromptIA() {
  const qc = useQueryClient();
  return useMutation<void, Error, { demandaId: string; prompt: string }>({
    mutationFn: async ({ demandaId, prompt }) => {
      const { error } = await supabase.rpc("salvar_prompt_ia_demanda", {
        p_demanda_id: demandaId,
        p_prompt: prompt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demanda"] });
    },
  });
}
