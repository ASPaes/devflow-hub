import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Inbox, Plus, Search, SearchX, X } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useDemandasLista,
  type FiltrosDemanda,
  type StatusDemanda,
  type TipoDemanda,
} from "@/hooks/useDemandas";
import { DemandasTable } from "@/components/demandas/DemandasTable";
import { ViewToggle } from "@/components/demandas/ViewToggle";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { PeriodoPicker } from "@/components/dashboard/PeriodoPicker";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";

const demandasSearchSchema = z.object({
  busca: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/demandas/")({
  validateSearch: zodValidator(demandasSearchSchema),
  component: DemandasListagem,
});

function DemandasListagem() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/demandas/" });
  const { temPermissao } = useProfile();
  useDocumentTitle("Demandas");

  const {
    periodo,
    tipoData,
    apenasSemData,
    filtros: filtrosCompartilhados,
    setPeriodo,
    setTipoData,
    setApenasSemData,
    setFiltros: setFiltrosCompartilhados,
  } = useDashboardFilters();

  const busca = search.busca;
  const buscaDebounced = useDebouncedValue(busca, 300);

  const filtrosQuery: FiltrosDemanda = React.useMemo(() => {
    const f: FiltrosDemanda = {};

    if (filtrosCompartilhados.status.length > 0) {
      f.status = filtrosCompartilhados.status as StatusDemanda[];
    }
    if (filtrosCompartilhados.prioridade.length > 0) {
      f.prioridade = filtrosCompartilhados.prioridade;
    }
    if (filtrosCompartilhados.tipo.length > 0) {
      f.tipo = filtrosCompartilhados.tipo as TipoDemanda[];
    }
    if (filtrosCompartilhados.modulo_id.length > 0) {
      f.modulo_ids = filtrosCompartilhados.modulo_id;
    }
    if (filtrosCompartilhados.area_id.length > 0) {
      f.area_ids = filtrosCompartilhados.area_id;
    }
    if (filtrosCompartilhados.tenant_id.length > 0) {
      f.tenant_ids = filtrosCompartilhados.tenant_id;
    }
    if (filtrosCompartilhados.responsavel_id.length > 0) {
      f.responsavel_ids = filtrosCompartilhados.responsavel_id;
    }
    if (filtrosCompartilhados.solicitante_id.length > 0) {
      f.solicitante_ids = filtrosCompartilhados.solicitante_id;
    }

    f.periodo = periodo;
    f.tipoData = tipoData;
    f.apenasSemData = apenasSemData;

    if (buscaDebounced.trim()) f.busca = buscaDebounced.trim();
    return f;
  }, [filtrosCompartilhados, periodo, tipoData, apenasSemData, buscaDebounced]);

  const { data: rows = [], isLoading } = useDemandasLista(filtrosQuery);

  const setBusca = React.useCallback(
    (valor: string) => {
      navigate({
        search: { busca: valor },
        replace: true,
      });
    },
    [navigate],
  );

  const totalFiltrosAplicados =
    filtrosCompartilhados.status.length +
    filtrosCompartilhados.prioridade.length +
    filtrosCompartilhados.tipo.length +
    filtrosCompartilhados.modulo_id.length +
    filtrosCompartilhados.area_id.length +
    filtrosCompartilhados.tenant_id.length +
    filtrosCompartilhados.responsavel_id.length +
    filtrosCompartilhados.solicitante_id.length;

  const hasFiltros =
    !!busca?.trim() || totalFiltrosAplicados > 0 || apenasSemData;

  const limparTudo = React.useCallback(() => {
    setBusca("");
    setFiltrosCompartilhados({
      status: [],
      prioridade: [],
      tipo: [],
      modulo_id: [],
      area_id: [],
      tenant_id: [],
      responsavel_id: [],
      solicitante_id: [],
    });
    setApenasSemData(false);
  }, [setBusca, setFiltrosCompartilhados, setApenasSemData]);

  const podeCriar = temPermissao("criar_demanda");

  return (
    <div>
      <PageHeader
        title="Demandas"
        description="Acompanhe o andamento das suas solicitações"
        action={
          <div className="flex items-center gap-2">
            <ViewToggle />
            {podeCriar && (
              <Button asChild>
                <Link to="/demandas/nova">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova demanda
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Linha 1: Período + tipo de data + busca */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <PeriodoPicker
          value={periodo}
          onChange={setPeriodo}
          tipoData={tipoData}
          onTipoDataChange={setTipoData}
          apenasSemData={apenasSemData}
          onApenasSemDataChange={setApenasSemData}
        />

        <div className="relative ml-auto min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, título ou descrição..."
            className="pl-8"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Linha 2: filtros multi-select */}
      <div className="mb-4">
        <DashboardFilterBar
          filtros={filtrosCompartilhados}
          onChange={setFiltrosCompartilhados}
        />
      </div>

      {!isLoading && rows.length === 0 ? (
        hasFiltros ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma demanda encontrada"
            description="Tente ajustar os filtros pra encontrar o que procura."
            action={
              <Button variant="outline" onClick={limparTudo}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="Nenhuma demanda ainda"
            description="Comece abrindo sua primeira solicitação."
            action={
              podeCriar ? (
                <Button asChild>
                  <Link to="/demandas/nova">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova demanda
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <DemandasTable
            rows={rows}
            isLoading={isLoading}
            onRowClick={(row) => {
              if (row.codigo) {
                navigate({
                  to: "/demandas/$codigo",
                  params: { codigo: row.codigo },
                });
              }
            }}
          />
          {!isLoading && (
            <div className="mt-3 text-xs text-muted-foreground">
              Exibindo {rows.length}{" "}
              {rows.length === 1 ? "demanda" : "demandas"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
