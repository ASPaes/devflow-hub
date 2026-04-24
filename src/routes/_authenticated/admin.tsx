import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const userId = context.auth.user?.id;
    if (!userId) {
      throw redirect({ to: "/login" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, ativo")
      .eq("id", userId)
      .single();

    if (!profile || profile.role !== "dev_gestor" || !profile.ativo) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
