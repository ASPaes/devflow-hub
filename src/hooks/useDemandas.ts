import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import { uploadAnexo } from "@/lib/upload-anexos";
import type { Database } from "@/integrations/supabase/types";

export type Demanda = Database["public"]["Tables"]["demandas"]["Row"];

export const TIPO_DEMANDA_VALUES = [
  "erro",
  "melhoria",
  "nova_funcionalidade",
  "duvida",
  "tarefa",
] as const;

export type TipoDemanda = (typeof TIPO_DEMANDA_VALUES)[number];

export const TIPO_DEMANDA_LABEL: Record<TipoDemanda, string> = {
  erro: "🐛 Erro",
  melhoria: "✨ Melhoria",
  nova_funcionalidade: "🚀 Nova funcionalidade",
  duvida: "❓ Dúvida",
  tarefa: "📋 Tarefa",
};

export const PRIORIDADE_LABEL: Record<number, string> = {
  1: "1 — Baixa",
  2: "2 — Menor",
  3: "3 — Normal",
  4: "4 — Alta",
  5: "5 — Urgente",
};

export const novaDemandaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(5, "Mínimo 5 caracteres")
    .max(200, "Máximo 200 caracteres"),
  descricao: z
    .string()
    .trim()
    .min(10, "Descreva com mais detalhes (mínimo 10 caracteres)"),
  tipo: z.enum(TIPO_DEMANDA_VALUES),
  prioridade: z.coerce.number().int().min(1).max(5),
  modulo_id: z.string().uuid("Selecione um módulo"),
  submodulo_id: z.string().uuid("Selecione um submódulo"),
  area_id: z.string().uuid("Selecione uma área"),
});

export type NovaDemandaInput = z.infer<typeof novaDemandaSchema>;

interface CreateDemandaArgs {
  input: NovaDemandaInput;
  anexos: File[];
  userId: string;
}

interface CreateDemandaResult {
  demanda: Demanda;
  anexosFalhos: number;
}

export function useCreateDemanda() {
  const qc = useQueryClient();
  return useMutation<CreateDemandaResult, unknown, CreateDemandaArgs>({
    mutationFn: async ({ input, anexos, userId }) => {
      const { data: demanda, error } = await supabase
        .from("demandas")
        .insert({
          titulo: input.titulo.trim(),
          descricao: input.descricao.trim(),
          tipo: input.tipo,
          prioridade: input.prioridade,
          modulo_id: input.modulo_id,
          submodulo_id: input.submodulo_id,
          area_id: input.area_id,
          solicitante_id: userId,
        })
        .select()
        .single();
      if (error) throw error;

      let anexosFalhos = 0;
      if (anexos.length > 0) {
        const results = await Promise.allSettled(
          anexos.map((file) =>
            uploadAnexo({ demandaId: demanda.id, file, userId }),
          ),
        );
        anexosFalhos = results.filter((r) => r.status === "rejected").length;
      }

      return { demanda, anexosFalhos };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      const codigo = result.demanda.codigo ?? "nova";
      if (result.anexosFalhos > 0) {
        toast.warning(
          `Demanda ${codigo} criada, mas ${result.anexosFalhos} anexo(s) falharam`,
        );
      } else {
        toast.success(`Demanda ${codigo} criada com sucesso`);
      }
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "demanda"));
    },
  });
}
