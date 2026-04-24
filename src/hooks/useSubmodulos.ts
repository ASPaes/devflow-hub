import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

type SubmoduloRow = Database["public"]["Tables"]["submodulos"]["Row"];
type ModuloRow = Database["public"]["Tables"]["modulos"]["Row"];

export type SubmoduloComModulo = SubmoduloRow & {
  modulo: Pick<ModuloRow, "id" | "nome" | "cor"> | null;
};

export const submoduloSchema = z.object({
  modulo_id: z.string().uuid("Selecione um módulo"),
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  ativo: z.boolean(),
});

export type SubmoduloInput = z.infer<typeof submoduloSchema>;

const submodulosKey = ["submodulos"] as const;

export function useSubmodulos() {
  return useQuery<SubmoduloComModulo[]>({
    queryKey: submodulosKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submodulos")
        .select(
          "id, modulo_id, nome, descricao, ativo, created_at, updated_at, modulo:modulos(id, nome, cor)",
        )
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SubmoduloComModulo[];
    },
    staleTime: 5 * 60_000,
  });
}

function normalizeInput(input: SubmoduloInput) {
  return {
    modulo_id: input.modulo_id,
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() ? input.descricao.trim() : null,
    ativo: input.ativo,
  };
}

export function useCreateSubmodulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmoduloInput) => {
      const { data, error } = await supabase
        .from("submodulos")
        .insert(normalizeInput(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submodulosKey });
      toast.success("Submódulo criado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "submodulo"));
    },
  });
}

export function useUpdateSubmodulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SubmoduloInput }) => {
      const { data, error } = await supabase
        .from("submodulos")
        .update(normalizeInput(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submodulosKey });
      toast.success("Submódulo atualizado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "submodulo"));
    },
  });
}

export function useDeleteSubmodulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("submodulos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submodulosKey });
      toast.success("Submódulo excluído");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "submodulo"));
    },
  });
}
