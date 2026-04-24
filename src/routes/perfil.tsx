import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/perfil")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => (
    <h1 className="font-sans text-3xl font-semibold text-foreground p-6">Perfil</h1>
  ),
});
