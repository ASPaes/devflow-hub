import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: () => (
    <h1 className="font-sans text-3xl font-semibold text-foreground p-6">Login</h1>
  ),
});
