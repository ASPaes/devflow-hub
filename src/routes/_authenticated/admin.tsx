import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/lib/supabase";
import type { AppPermissao } from "@/hooks/useProfile";

const PERMISSOES_ADMIN: AppPermissao[] = [
  "gerenciar_modulos",
  "gerenciar_submodulos",
  "gerenciar_areas",
  "gerenciar_usuarios",
  "gerenciar_perfis_acesso",
  "gerenciar_tenants",
];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const userId = context.auth.user?.id;
    if (!userId) {
      throw redirect({ to: "/login" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("ativo, perfil_acesso:perfis_acesso(permissoes)")
      .eq("id", userId)
      .single();

    if (!profile?.ativo) {
      throw redirect({ to: "/" });
    }

    const perfilAcesso = profile.perfil_acesso as
      | { permissoes: AppPermissao[] }
      | { permissoes: AppPermissao[] }[]
      | null;
    const permissoes: AppPermissao[] = Array.isArray(perfilAcesso)
      ? (perfilAcesso[0]?.permissoes ?? [])
      : (perfilAcesso?.permissoes ?? []);

    const temAlgumaAdmin = PERMISSOES_ADMIN.some((p) => permissoes.includes(p));
    if (!temAlgumaAdmin) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
