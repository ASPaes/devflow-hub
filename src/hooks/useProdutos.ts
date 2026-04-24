import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

export type Produto = Database["public"]["Tables"]["produtos"]["Row"];

export const produtoSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  cor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Cor deve ser hex (#RRGGBB)"),
  ativo: z.boolean(),
});

export type ProdutoInput = z.infer<typeof produtoSchema>;

const produtosKey = ["produtos"] as const;

export function useProdutos() {
  return useQuery<Produto[]>({
    queryKey: produtosKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

function normalizeInput(input: ProdutoInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() ? input.descricao.trim() : null,
    cor: input.cor.toUpperCase(),
    ativo: input.ativo,
  };
}

export function useCreateProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProdutoInput) => {
      const { data, error } = await supabase
        .from("produtos")
        .insert(normalizeInput(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: produtosKey });
      toast.success("Produto criado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err));
    },
  });
}

export function useUpdateProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ProdutoInput }) => {
      const { data, error } = await supabase
        .from("produtos")
        .update(normalizeInput(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: produtosKey });
      toast.success("Produto atualizado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err));
    },
  });
}

export function useDeleteProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: produtosKey });
      toast.success("Produto excluído");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err));
    },
  });
}
