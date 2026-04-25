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
  tenant_id: string;
  tenant_nome: string | null;
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

export type UsuarioPatch = Partial<{
  nome: string;
  ativo: boolean;
  perfil_acesso_id: string;
  tenant_id: string;
}>;

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

export function useResendInvite() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("resend-invite", {
        body: { userId },
      });
      if (error) throw error;
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) throw new Error(errMsg);
      return data;
    },
    onSuccess: () => toast.success("Convite reenviado"),
    onError: (err: Error) => toast.error(err.message || "Erro ao reenviar convite"),
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) throw new Error(errMsg);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usuariosKey });
      toast.success("Usuário excluído");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao excluir usuário"),
  });
}

export function useInviteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      nome: string;
      perfil_acesso_id: string;
      tenant_id: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: input,
      });
      if (error) throw error;
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) throw new Error(errMsg);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usuariosKey });
      toast.success(
        "Convite enviado. O usuário receberá um e-mail com link pra definir a senha.",
      );
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("rate limit")) {
        toast.error("Limite de envios atingido. Aguarde alguns minutos.");
      } else {
        toast.error(msg || "Erro ao enviar convite");
      }
    },
  });
}

export type UsuarioComPermissao = {
  id: string;
  nome: string;
  avatar_url: string | null;
};

export function useUsuariosComPermissao(permissao: AppPermissao) {
  return useQuery<UsuarioComPermissao[]>({
    queryKey: ["usuarios-com-permissao", permissao],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, nome, avatar_url, perfil_acesso:perfis_acesso!inner(permissoes)",
        )
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return ((data ?? []) as Array<{
        id: string;
        nome: string;
        avatar_url: string | null;
        perfil_acesso: { permissoes: AppPermissao[] } | null;
      }>)
        .filter((p) => p.perfil_acesso?.permissoes?.includes(permissao))
        .map(({ id, nome, avatar_url }) => ({ id, nome, avatar_url }));
    },
    staleTime: 5 * 60_000,
  });
}
