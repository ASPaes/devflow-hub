import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  PlusCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import {
  STATUS_DEMANDA_LABEL,
  useDemandasLista,
} from "@/hooks/useDemandas";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

interface KpiProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}

function Kpi({ label, icon: Icon, iconClassName }: KpiProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={iconClassName ?? "h-4 w-4 text-muted-foreground"} />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { temPermissao } = useProfile();
  const podeCriar = temPermissao("criar_demanda");
  const { data: ultimas = [], isLoading } = useDemandasLista({}, { limit: 5 });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        {podeCriar && (
          <Button asChild size="lg">
            <Link to="/demandas/nova">
              <PlusCircle className="mr-2 h-4 w-4" />
              Abrir nova demanda
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total de demandas" icon={Inbox} iconClassName="h-4 w-4 text-muted-foreground" />
        <Kpi label="Abertas" icon={Clock} iconClassName="h-4 w-4 text-accent" />
        <Kpi label="Prioritárias" icon={Flame} iconClassName="h-4 w-4 text-prioridade-5" />
        <Kpi
          label="Concluídas no mês"
          icon={CheckCircle2}
          iconClassName="h-4 w-4 text-status-entregue"
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">
            Últimas demandas
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link to="/demandas">
              Ver todas
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : ultimas.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              Nenhuma demanda ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {ultimas.map((d) => {
                const status = d.status ?? "triagem";
                return (
                  <li key={d.id ?? d.codigo}>
                    <Link
                      to="/demandas"
                      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-secondary/30"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {d.codigo}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">
                        {d.titulo}
                      </span>
                      <Badge
                        variant="outline"
                        className="font-normal"
                        style={{
                          color: `var(--color-status-${status})`,
                          backgroundColor: `color-mix(in oklab, var(--color-status-${status}) 15%, transparent)`,
                          borderColor: `color-mix(in oklab, var(--color-status-${status}) 30%, transparent)`,
                        }}
                      >
                        {STATUS_DEMANDA_LABEL[status]}
                      </Badge>
                      <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                        {formatRelativeSP(d.created_at)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
