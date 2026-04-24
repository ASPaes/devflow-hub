import { redirect } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { AppPermissao } from "@/hooks/useProfile";
import type { RouterAppContext } from "@/router";

type BeforeLoadCtx = {
  context: RouterAppContext;
  location: { href: string };
};

/**
 * Returns a `beforeLoad` handler that ensures the current user has the given
 * permission. Redirects to "/" with a toast if not. Assumes the route is
 * already nested under `_authenticated` (so a session exists).
 */
export function requirePermission(permissao: AppPermissao) {
  return async ({ context, location }: BeforeLoadCtx) => {
    const userId = context.auth.session?.user.id;
    if (!userId) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    // Cache via TanStack Query so repeated guards don't refetch.
    const profile = await context.queryClient.ensureQueryData({
      queryKey: ["profile", userId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, nome, avatar_url, ativo, perfil_acesso:perfis_acesso(id, nome, permissoes)",
          )
          .eq("id", userId)
          .single();
        if (error) throw error;
        return data as unknown as {
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
      },
      staleTime: 5 * 60_000,
    });

    const permissoes = profile.perfil_acesso?.permissoes ?? [];
    if (!permissoes.includes(permissao)) {
      toast.error("Você não tem permissão para acessar essa página");
      throw redirect({ to: "/" });
    }
  };
}
