import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { DashboardFiltersProvider } from "@/contexts/DashboardFiltersContext";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <DashboardFiltersProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </DashboardFiltersProvider>
  );
}
