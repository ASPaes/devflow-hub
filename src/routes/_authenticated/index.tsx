import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PeriodoPicker } from "@/components/dashboard/PeriodoPicker";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  PlusCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import {
  STATUS_DEMANDA_LABEL,
  STATUS_DEMANDA_VALUES,
  type StatusDemanda,
  useDemandasLista,
} from "@/hooks/useDemandas";
import {
  STATUS_BADGE_STYLES,
  PRIORIDADE_BADGE_STYLES,
} from "@/components/demandas/MetadataSidebar";
import {
  FILTROS_VAZIOS,
  useDashboardMetrics,
  type DashboardMetrics,
} from "@/hooks/useDashboardMetrics";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { DistribuicaoDesenvolvedorCard } from "@/components/dashboard/DistribuicaoDesenvolvedorCard";
import { formatRelativeSP } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

interface KpiProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}

function KpiCard({ label, value, isLoading, icon: Icon, iconClassName }: KpiProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={iconClassName ?? "h-5 w-5 text-muted-foreground"} />
      </CardHeader>
      <CardContent>
        {isLoading || value === undefined ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-semibold text-foreground">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

// Bar style maps — solid color for distribution charts.
// Uses static literals so Tailwind purge picks them up.
const STATUS_BAR_BG: Record<StatusDemanda, string> = {
  triagem: "bg-status-triagem",
  analise: "bg-status-analise",
  desenvolvimento: "bg-status-desenvolvimento",
  teste: "bg-status-teste",
  entregue: "bg-status-entregue",
  reaberta: "bg-status-reaberta",
  encerrada: "bg-status-encerrada",
  cancelada: "bg-status-cancelada",
};

const PRIORIDADE_BAR_BG: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-prioridade-1",
  2: "bg-prioridade-2",
  3: "bg-prioridade-3",
  4: "bg-prioridade-4",
  5: "bg-prioridade-5",
};

function DistribuicaoStatus({ metrics }: { metrics: DashboardMetrics }) {
  const valores = STATUS_DEMANDA_VALUES.map(
    (k) => metrics.por_status[k] ?? 0,
  );
  const max = Math.max(1, ...valores);
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Distribuição por status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {STATUS_DEMANDA_VALUES.map((status) => {
          const valor = metrics.por_status[status] ?? 0;
          const pct = (valor / max) * 100;
          return (
            <div key={status} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-xs text-muted-foreground">
                {STATUS_DEMANDA_LABEL[status]}
              </div>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-secondary/40">
                <div
                  className={`h-full rounded-md ${STATUS_BAR_BG[status]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right font-mono text-xs text-foreground">
                {valor}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DistribuicaoPrioridade({ metrics }: { metrics: DashboardMetrics }) {
  const niveis: Array<1 | 2 | 3 | 4 | 5> = [5, 4, 3, 2, 1];
  const valores = niveis.map((n) => metrics.por_prioridade[String(n)] ?? 0);
  const max = Math.max(1, ...valores);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Distribuição por prioridade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {niveis.map((n) => {
          const valor = metrics.por_prioridade[String(n)] ?? 0;
          const pct = (valor / max) * 100;
          return (
            <div key={n} className="flex items-center gap-3">
              <div className="w-8 shrink-0 text-xs font-medium text-muted-foreground">
                P{n}
              </div>
              <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-secondary/40">
                <div
                  className={`h-full rounded-md ${PRIORIDADE_BAR_BG[n]} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right font-mono text-xs text-foreground">
                {valor}
              </div>
            </div>
          );
        })}
        <div className="pt-2">
          <div className="flex flex-wrap gap-1.5">
            {niveis
              .slice()
              .reverse()
              .map((n) => (
                <span
                  key={n}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${PRIORIDADE_BADGE_STYLES[n]}`}
                >
                  P{n}
                </span>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UltimasDemandasCard() {
  const { data: ultimas = [], isLoading } = useDemandasLista({}, { limit: 5 });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium">Últimas demandas</CardTitle>
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
              const status = (d.status ?? "triagem") as StatusDemanda;
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
                      className={`font-normal ${STATUS_BADGE_STYLES[status]}`}
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
  );
}

function Dashboard() {
  const { profile, isLoading: profileLoading, temPermissao } = useProfile();
  const podeCriar = temPermissao("criar_demanda");
  const podeVerMetricas = temPermissao("ver_dashboard_metricas");

  useDocumentTitle("Dashboard");

  const {
    periodo,
    tipoData,
    apenasSemData,
    filtros,
    setPeriodo,
    setTipoData,
    setApenasSemData,
    setFiltros,
  } = useDashboardFilters();

  const metricsQuery = useDashboardMetrics(
    periodo,
    podeVerMetricas,
    filtros,
    tipoData,
    apenasSemData,
  );
  const metrics = metricsQuery.data;
  const metricsLoading = metricsQuery.isLoading;
  const metricsRefetching = metricsQuery.isFetching && !metricsQuery.isLoading;

  const primeiroNome = profile?.nome?.split(" ")[0] ?? "";

  const header = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          {!profileLoading && primeiroNome && (
            <p className="mt-1 text-sm text-muted-foreground">
              Bem-vindo, {primeiroNome}. Visão geral das demandas em andamento.
            </p>
          )}
        </div>
        {podeVerMetricas && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => void metricsQuery.refetch()}
            disabled={metricsRefetching}
            aria-label="Atualizar métricas"
            title="Atualizar métricas"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                metricsRefetching && "animate-spin",
              )}
            />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {podeVerMetricas && (
          <PeriodoPicker
            value={periodo}
            onChange={setPeriodo}
            tipoData={tipoData}
            onTipoDataChange={setTipoData}
            apenasSemData={apenasSemData}
            onApenasSemDataChange={setApenasSemData}
          />
        )}
        {podeCriar && (
          <Button asChild size="lg">
            <Link to="/demandas/nova">
              <PlusCircle className="mr-2 h-4 w-4" />
              Abrir nova demanda
            </Link>
          </Button>
        )}
      </div>
    </div>
  );

  if (profileLoading) {
    return (
      <div>
        {header}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!podeVerMetricas) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="p-12 text-center">
          <BarChart3 className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm text-muted-foreground">
            Você não tem acesso às métricas agregadas.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/demandas">Ver lista de demandas</Link>
          </Button>
        </Card>
        <UltimasDemandasCard />
      </div>
    );
  }

  const prioritarias = metrics?.prioritarias_abertas ?? 0;

  return (
    <div>
      {header}

      <div className="mb-6">
        <DashboardFilterBar filtros={filtros} onChange={setFiltros} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de demandas"
          value={metrics?.total}
          isLoading={metricsLoading}
          icon={Inbox}
          iconClassName="h-5 w-5 text-muted-foreground"
        />
        <KpiCard
          label="Abertas"
          value={metrics?.abertas}
          isLoading={metricsLoading}
          icon={Clock}
          iconClassName="h-5 w-5 text-accent"
        />
        <KpiCard
          label="Prioritárias"
          value={prioritarias}
          isLoading={metricsLoading}
          icon={Flame}
          iconClassName={
            prioritarias > 0
              ? "h-5 w-5 text-prioridade-5"
              : "h-5 w-5 text-muted-foreground"
          }
        />
        <KpiCard
          label="Concluídas no período"
          value={metrics?.concluidas_periodo}
          isLoading={metricsLoading}
          icon={CheckCircle2}
          iconClassName="h-5 w-5 text-status-entregue"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {metricsLoading || !metrics ? (
          <>
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <DistribuicaoStatus metrics={metrics} />
            <DistribuicaoPrioridade metrics={metrics} />
          </>
        )}
      </div>

      <div className="mt-6">
        {metricsLoading || !metrics ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <DistribuicaoDesenvolvedorCard
            data={metrics.por_responsavel ?? []}
            isLoading={metricsLoading}
          />
        )}
      </div>

      <div className="mt-6">
        <UltimasDemandasCard />
      </div>
    </div>
  );
}
