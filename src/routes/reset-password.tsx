import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  component: () => (
    <h1 className="font-sans text-3xl font-semibold text-foreground p-6">Reset Password</h1>
  ),
});
