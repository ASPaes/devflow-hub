import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { DashboardFiltersProvider } from "@/contexts/DashboardFiltersContext";
import { VersaoProvider } from "@/contexts/VersaoContext";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated")({
  // A sessão mora no localStorage, que o servidor não enxerga. Com SSR ligado,
  // este beforeLoad rodava no servidor, achava "sem sessão" e devolvia 307 para
  // /login a cada F5 — o usuário continuava logado, mas caía na tela de login.
  // Desligado aqui, vale para todas as rotas filhas.
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    // Prefer the live router context (mutated by RouterAuthSync), but fall
    // back to reading the session directly from supabase to avoid races
    // during navigation where the mutated context isn't reflected yet.
    if (context.auth.session) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <DashboardFiltersProvider>
      <VersaoProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </VersaoProvider>
    </DashboardFiltersProvider>
  );
}
