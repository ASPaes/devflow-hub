import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Flame, Inbox, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useProfile";

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
        <CardHeader>
          <CardTitle className="text-base font-medium">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {podeCriar
            ? "Use o botão acima ou o item “Nova demanda” na barra lateral pra abrir uma solicitação."
            : "A listagem e o Kanban de demandas chegam nas próximas etapas."}
        </CardContent>
      </Card>
    </div>
  );
}
