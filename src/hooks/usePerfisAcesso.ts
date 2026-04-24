import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { AppPermissao } from "@/hooks/useProfile";

export type PerfilAcesso = {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: AppPermissao[];
  sistema: boolean;
  ativo: boolean;
  perfil_padrao_novos_usuarios: boolean;
  created_at: string;
  updated_at: string;
};

const PERMISSAO_VALUES = [
  "criar_demanda",
  "ver_todas_demandas",
  "editar_qualquer_demanda",
  "deletar_demanda",
  "gerenciar_modulos",
  "gerenciar_submodulos",
  "gerenciar_areas",
  "gerenciar_usuarios",
  "gerenciar_perfis_acesso",
  "ver_dashboard_metricas",
] as const;

export const perfilAcessoSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  permissoes: z
    .array(z.enum(PERMISSAO_VALUES))
    .min(1, "Selecione ao menos uma permissão"),
  ativo: z.boolean(),
  perfil_padrao_novos_usuarios: z.boolean(),
});

export type PerfilAcessoInput = z.infer<typeof perfilAcessoSchema>;

const perfisKey = ["perfis_acesso"] as const;

export function usePerfisAcesso() {
  return useQuery<PerfilAcesso[]>({
    queryKey: perfisKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_acesso")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as PerfilAcesso[];
    },
    staleTime: 5 * 60_000,
  });
}

function normalize(input: PerfilAcessoInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() ? input.descricao.trim() : null,
    permissoes: input.permissoes,
    ativo: input.ativo,
  };
}

async function applyDefaultFlag(perfilId: string, makeDefault: boolean) {
  if (makeDefault) {
    // RPC ensures only one default exists
    const { error } = await supabase.rpc("set_perfil_padrao_novos_usuarios", {
      p_perfil_id: perfilId,
    });
    if (error) throw error;
  } else {
    // Unset directly — partial unique index allows multiple `false`
    const { error } = await supabase
      .from("perfis_acesso")
      .update({ perfil_padrao_novos_usuarios: false })
      .eq("id", perfilId);
    if (error) throw error;
  }
}

export function useCreatePerfilAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PerfilAcessoInput) => {
      const { data, error } = await supabase
        .from("perfis_acesso")
        .insert(normalize(input))
        .select()
        .single();
      if (error) throw error;
      if (input.perfil_padrao_novos_usuarios && data) {
        await applyDefaultFlag(data.id, true);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: perfisKey });
      toast.success("Perfil criado");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "perfil_acesso")),
  });
}

export function useUpdatePerfilAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      wasDefault,
    }: {
      id: string;
      input: PerfilAcessoInput;
      wasDefault: boolean;
    }) => {
      const { data, error } = await supabase
        .from("perfis_acesso")
        .update(normalize(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      if (input.perfil_padrao_novos_usuarios && !wasDefault) {
        await applyDefaultFlag(id, true);
      } else if (!input.perfil_padrao_novos_usuarios && wasDefault) {
        // Block: must always have at least one default
        throw new Error(
          "Deve haver pelo menos um perfil padrão. Marque outro como padrão antes.",
        );
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: perfisKey });
      qc.invalidateQueries({ queryKey: ["usuarios_admin"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado");
    },
    onError: (err) => {
      const msg =
        err instanceof Error && err.message.includes("perfil padrão")
          ? err.message
          : translateSupabaseError(err, "perfil_acesso");
      toast.error(msg);
    },
  });
}

export function useDeletePerfilAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("perfis_acesso")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: perfisKey });
      qc.invalidateQueries({ queryKey: ["usuarios_admin"] });
      toast.success("Perfil excluído");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "perfil_acesso")),
  });
}
