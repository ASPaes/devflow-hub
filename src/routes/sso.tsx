import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sso")({
  beforeLoad: ({ search }) => {
    const params = new URLSearchParams(search as Record<string, string>);
    const qs = params.toString();
    throw redirect({
      href: `/sso-callback${qs ? `?${qs}` : ""}`,
      replace: true,
    });
  },
});
