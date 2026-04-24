import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Plus } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
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
import { ViewToggle } from "@/components/demandas/ViewToggle";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  KanbanBoard,
  STATUS_NO_BOARD,
} from "@/components/demandas/KanbanBoard";

const kanbanSearchSchema = z.object({
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

export const Route = createFileRoute("/_authenticated/demandas/kanban")({
  validateSearch: zodValidator(kanbanSearchSchema),
  component: KanbanPage,
});

function KanbanPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/demandas/kanban" });
  const { temPermissao } = useProfile();
  useDocumentTitle("Kanban");

  const filtrosState: FiltrosState = React.useMemo(
    () => ({
      busca: search.busca,
      // No Kanban, status é controlado pelo board, mas mantemos no state pra compatibilidade
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
    const f: FiltrosDemanda = {
      // Restringe ao que cabe no board (ignora encerrada/cancelada)
      status: STATUS_NO_BOARD,
    };
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
        search: (old) => ({ ...old, ...patch }),
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

  const podeCriar = temPermissao("criar_demanda");

  return (
    <div>
      <PageHeader
        title="Demandas — Kanban"
        description="Visão panorâmica do pipeline por status"
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

      <FiltrosPanel
        value={filtrosState}
        onChange={setPatch}
        onClear={limpar}
        hideStatus
      />

      <KanbanBoard
        rows={rows}
        isLoading={isLoading}
        onCardClick={(row) => {
          if (row.codigo) {
            navigate({
              to: "/demandas/$codigo",
              params: { codigo: row.codigo },
            });
          }
        }}
      />
    </div>
  );
}
