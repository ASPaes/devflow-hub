import { Link, useRouterState } from "@tanstack/react-router";
import { Columns3, List } from "lucide-react";

import { cn } from "@/lib/utils";

const baseClasses =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors";
const inactiveClasses = "text-muted-foreground hover:text-foreground";
const activeClasses = "bg-secondary text-foreground";

export function ViewToggle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isKanban = pathname.startsWith("/demandas/kanban");
  const isLista = pathname === "/demandas" || pathname === "/demandas/";

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      <Link
        to="/demandas"
        search={(prev) => prev as never}
        className={cn(baseClasses, isLista ? activeClasses : inactiveClasses)}
      >
        <List className="h-4 w-4" />
        Lista
      </Link>
      <Link
        to="/demandas/kanban"
        search={(prev) => prev as never}
        className={cn(baseClasses, isKanban ? activeClasses : inactiveClasses)}
      >
        <Columns3 className="h-4 w-4" />
        Kanban
      </Link>
    </div>
  );
}
