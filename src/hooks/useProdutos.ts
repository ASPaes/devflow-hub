import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const produtosKey = ["produtos"] as const;

/** Lista produtos ATIVOS — usado no select de demanda */
export function useProdutosAtivos() {
  return useQuery<Produto[]>({
    queryKey: [...produtosKey, "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, descricao, ativo, created_at, updated_at")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Lista TODOS os produtos (ativos + inativos) — usado na tela admin */
export function useProdutosTodos() {
  return useQuery<Produto[]>({
    queryKey: [...produtosKey, "todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, descricao, ativo, created_at, updated_at")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
    staleTime: 60_000,
  });
}

export function useCriarProduto() {
  const qc = useQueryClient();
  return useMutation<Produto, Error, { nome: string; descricao?: string | null }>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() ? input.descricao.trim() : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Produto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: produtosKey });
      toast.success("Produto criado");
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.toLowerCase().includes("duplicate") || m.toLowerCase().includes("unique")) {
        toast.error("Já existe um produto com esse nome");
      } else {
        toast.error("Erro ao criar produto");
      }
    },
  });
}

export function useAtualizarProduto() {
  const qc = useQueryClient();
  return useMutation<
    Produto,
    Error,
    { id: string; nome: string; descricao?: string | null }
  >({
    mutationFn: async ({ id, nome, descricao }) => {
      const { data, error } = await supabase
        .from("produtos")
        .update({
          nome: nome.trim(),
          descricao: descricao?.trim() ? descricao.trim() : null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Produto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: produtosKey });
      toast.success("Produto atualizado");
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.toLowerCase().includes("duplicate") || m.toLowerCase().includes("unique")) {
        toast.error("Já existe um produto com esse nome");
      } else {
        toast.error("Erro ao atualizar produto");
      }
    },
  });
}

export function useToggleProduto() {
  const qc = useQueryClient();
  return useMutation<Produto, Error, { id: string; ativo: boolean }>({
    mutationFn: async ({ id, ativo }) => {
      const { data, error } = await supabase
        .from("produtos")
        .update({ ativo })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Produto;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: produtosKey });
      toast.success(vars.ativo ? "Produto reativado" : "Produto desativado");
    },
    onError: () => toast.error("Erro ao alterar status do produto"),
  });
}
