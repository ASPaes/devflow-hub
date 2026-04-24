import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

type ModuloRow = Database["public"]["Tables"]["modulos"]["Row"];
type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];

export type ModuloComProduto = ModuloRow & {
  produto: Pick<ProdutoRow, "id" | "nome" | "cor"> | null;
};

export const moduloSchema = z.object({
  produto_id: z.string().uuid("Selecione um produto"),
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  ativo: z.boolean(),
});

export type ModuloInput = z.infer<typeof moduloSchema>;

const modulosKey = ["modulos"] as const;

export function useModulos() {
  return useQuery<ModuloComProduto[]>({
    queryKey: modulosKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos")
        .select(
          "id, produto_id, nome, ativo, created_at, updated_at, produto:produtos(id, nome, cor)",
        )
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ModuloComProduto[];
    },
    staleTime: 5 * 60_000,
  });
}

function normalizeInput(input: ModuloInput) {
  return {
    produto_id: input.produto_id,
    nome: input.nome.trim(),
    ativo: input.ativo,
  };
}

export function useCreateModulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ModuloInput) => {
      const { data, error } = await supabase
        .from("modulos")
        .insert(normalizeInput(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: modulosKey });
      toast.success("Módulo criado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "modulo"));
    },
  });
}

export function useUpdateModulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ModuloInput }) => {
      const { data, error } = await supabase
        .from("modulos")
        .update(normalizeInput(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: modulosKey });
      toast.success("Módulo atualizado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "modulo"));
    },
  });
}

export function useDeleteModulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modulos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: modulosKey });
      toast.success("Módulo excluído");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "modulo"));
    },
  });
}
