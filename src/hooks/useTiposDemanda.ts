import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TipoDemanda } from "@/types/tipo-demanda";

export function useTiposDemanda(incluirInativos = false) {
  return useQuery<TipoDemanda[]>({
    queryKey: ["tipos-demanda", incluirInativos],
    queryFn: async () => {
      let q = supabase.from("tipos_demanda").select("*").order("ordem");
      if (!incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TipoDemanda[];
    },
    staleTime: 60_000,
  });
}

export function useCriarTipo() {
  const qc = useQueryClient();
  return useMutation<
    TipoDemanda,
    Error,
    {
      codigo: string;
      label: string;
      icone: string | null;
      cor: string | null;
      ordem: number;
    }
  >({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from("tipos_demanda")
        .insert({
          codigo: input.codigo.trim().toLowerCase().replace(/\s+/g, "_"),
          label: input.label,
          icone: input.icone,
          cor: input.cor,
          ordem: input.ordem,
          ativo: true,
          sistema: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TipoDemanda;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos-demanda"] });
      toast.success("Tipo criado");
    },
    onError: (err) => toast.error(err.message || "Erro ao criar tipo"),
  });
}

export function useEditarTipo() {
  const qc = useQueryClient();
  return useMutation<
    TipoDemanda,
    Error,
    {
      id: string;
      label: string;
      icone: string | null;
      cor: string | null;
      ordem: number;
      ativo: boolean;
    }
  >({
    mutationFn: async ({ id, label, icone, cor, ordem, ativo }) => {
      const { data, error } = await supabase.rpc(
        "editar_tipo_demanda" as never,
        {
          p_id: id,
          p_label: label,
          p_icone: icone,
          p_cor: cor,
          p_ordem: ordem,
          p_ativo: ativo,
        } as never,
      );
      if (error) throw error;
      return data as unknown as TipoDemanda;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos-demanda"] });
      toast.success("Tipo atualizado");
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar tipo"),
  });
}

export function useExcluirTipo() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("tipos_demanda")
        .update({ ativo: false })
        .eq("id", id)
        .eq("sistema", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos-demanda"] });
      toast.success("Tipo desativado");
    },
    onError: (err) => toast.error(err.message || "Erro ao desativar"),
  });
}
