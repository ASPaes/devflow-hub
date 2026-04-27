import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sso")({
  beforeLoad: ({ search }) => {
    const params = new URLSearchParams(search as Record<string, string>);
    throw redirect({
      to: "/sso-callback",
      search: Object.fromEntries(params),
      replace: true,
    });
  },
});
