import { useRouterState } from "@tanstack/react-router";

import { UserMenu } from "@/components/layout/UserMenu";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/perfil": "Perfil",
};

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[pathname] ?? "";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-base font-medium text-foreground">{title}</h1>
      <UserMenu />
    </header>
  );
}
