import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { AppPermissao } from "@/hooks/useProfile";

export type UsuarioAdmin = {
  id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  perfil_acesso_id: string;
  perfil_acesso_nome: string;
  permissoes: AppPermissao[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
};

const usuariosKey = ["usuarios_admin"] as const;

export function useUsuarios() {
  return useQuery<UsuarioAdmin[]>({
    queryKey: usuariosKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_usuarios_admin");
      if (error) throw error;
      return (data ?? []) as unknown as UsuarioAdmin[];
    },
    staleTime: 2 * 60_000,
  });
}

export type UsuarioPatch = Partial<Pick<UsuarioAdmin, "nome" | "ativo">>;

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UsuarioPatch }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usuariosKey });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Usuário atualizado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "usuario"));
    },
  });
}
