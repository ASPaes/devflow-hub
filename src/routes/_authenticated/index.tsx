import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, Flame, Inbox } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Dashboard</h1>

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
          <CardTitle className="text-base font-medium">Fase 1 completa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cadastro, autenticação e layout prontos. Próximo passo: gestão de demandas.
        </CardContent>
      </Card>
    </div>
  );
}
