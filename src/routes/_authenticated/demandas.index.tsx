import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Inbox, Plus, SearchX } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  STATUS_DEMANDA_VALUES,
  TIPO_DEMANDA_VALUES,
  useDemandasLista,
  type FiltrosDemanda,
} from "@/hooks/useDemandas";
import {
  FiltrosPanel,
  RESPONSAVEL_SEM,
  type FiltrosState,
} from "@/components/demandas/FiltrosPanel";
import { DemandasTable } from "@/components/demandas/DemandasTable";

const demandasSearchSchema = z.object({
  status: fallback(z.array(z.enum(STATUS_DEMANDA_VALUES)), []).default([]),
  prioridade: fallback(
    z.array(z.coerce.number().int().min(1).max(5)),
    [],
  ).default([]),
  tipo: fallback(z.array(z.enum(TIPO_DEMANDA_VALUES)), []).default([]),
  modulo_id: fallback(z.string().uuid().optional(), undefined),
  area_id: fallback(z.string().uuid().optional(), undefined),
  responsavel_id: fallback(
    z.union([z.string().uuid(), z.literal(RESPONSAVEL_SEM)]).optional(),
    undefined,
  ),
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

  const filtrosState: FiltrosState = React.useMemo(
    () => ({
      busca: search.busca,
      status: search.status,
      prioridade: search.prioridade,
      tipo: search.tipo,
      modulo_id: search.modulo_id,
      area_id: search.area_id,
      responsavel_id: search.responsavel_id,
    }),
    [search],
  );

  const buscaDebounced = useDebouncedValue(filtrosState.busca, 300);

  const filtrosQuery: FiltrosDemanda = React.useMemo(() => {
    const f: FiltrosDemanda = {};
    if (filtrosState.status.length) f.status = filtrosState.status;
    if (filtrosState.prioridade.length) f.prioridade = filtrosState.prioridade;
    if (filtrosState.tipo.length) f.tipo = filtrosState.tipo;
    if (filtrosState.modulo_id) f.modulo_id = filtrosState.modulo_id;
    if (filtrosState.area_id) f.area_id = filtrosState.area_id;
    if (filtrosState.responsavel_id === RESPONSAVEL_SEM) {
      f.responsavel_id = null;
    } else if (filtrosState.responsavel_id) {
      f.responsavel_id = filtrosState.responsavel_id;
    }
    if (buscaDebounced.trim()) f.busca = buscaDebounced.trim();
    return f;
  }, [filtrosState, buscaDebounced]);

  const { data: rows = [], isLoading } = useDemandasLista(filtrosQuery);

  const setPatch = React.useCallback(
    (patch: Partial<FiltrosState>) => {
      navigate({
        search: (old) => {
          const next = { ...old, ...patch };
          // Normaliza vazios para limpar a URL
          if (next.busca === "") next.busca = "";
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const limpar = React.useCallback(() => {
    navigate({
      search: {
        busca: "",
        status: [],
        prioridade: [],
        tipo: [],
        modulo_id: undefined,
        area_id: undefined,
        responsavel_id: undefined,
      },
      replace: true,
    });
  }, [navigate]);

  const hasFiltros =
    !!filtrosState.busca?.trim() ||
    filtrosState.status.length > 0 ||
    filtrosState.prioridade.length > 0 ||
    filtrosState.tipo.length > 0 ||
    !!filtrosState.modulo_id ||
    !!filtrosState.area_id ||
    !!filtrosState.responsavel_id;

  const podeCriar = temPermissao("criar_demanda");

  return (
    <div>
      <PageHeader
        title="Demandas"
        description="Acompanhe o andamento das suas solicitações"
        action={
          podeCriar && (
            <Button asChild>
              <Link to="/demandas/nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova demanda
              </Link>
            </Button>
          )
        }
      />

      <FiltrosPanel value={filtrosState} onChange={setPatch} onClear={limpar} />

      {!isLoading && rows.length === 0 ? (
        hasFiltros ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma demanda encontrada"
            description="Tente ajustar os filtros pra encontrar o que procura."
            action={
              <Button variant="outline" onClick={limpar}>
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
