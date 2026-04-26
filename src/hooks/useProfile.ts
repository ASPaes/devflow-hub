import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export type AppPermissao =
  | "criar_demanda"
  | "ver_demandas"
  | "ver_todas_demandas"
  | "comentar_demanda"
  | "editar_qualquer_demanda"
  | "deletar_demanda"
  | "pode_ser_responsavel"
  | "gerenciar_modulos"
  | "gerenciar_submodulos"
  | "gerenciar_areas"
  | "gerenciar_usuarios"
  | "gerenciar_perfis_acesso"
  | "ver_dashboard_metricas"
  | "gerenciar_tenants";

export type ProfileWithPerfil = {
  id: string;
  nome: string;
  avatar_url: string | null;
  ativo: boolean;
  perfil_acesso: {
    id: string;
    nome: string;
    permissoes: AppPermissao[];
  } | null;
};

export function useProfile() {
  const { user } = useAuth();
  const query = useQuery<ProfileWithPerfil>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("no user");
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, nome, avatar_url, ativo, perfil_acesso:perfis_acesso(id, nome, permissoes)",
        )
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as unknown as ProfileWithPerfil;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const permissoes = useMemo<AppPermissao[]>(
    () => query.data?.perfil_acesso?.permissoes ?? [],
    [query.data],
  );

  const helpers = useMemo(
    () => ({
      temPermissao: (p: AppPermissao) => permissoes.includes(p),
      temAlgumaPermissao: (...ps: AppPermissao[]) =>
        ps.some((p) => permissoes.includes(p)),
    }),
    [permissoes],
  );

  return {
    profile: query.data,
    isLoading: query.isLoading,
    permissoes,
    temPermissao: helpers.temPermissao,
    temAlgumaPermissao: helpers.temAlgumaPermissao,
    refetch: query.refetch,
  };
}
