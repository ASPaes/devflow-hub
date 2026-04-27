import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  STATUS_DEMANDA_LABEL,
  type DemandaListaRow,
  type StatusDemanda,
} from "@/hooks/useDemandas";
import { KanbanCard } from "@/components/demandas/KanbanCard";

export type ColunaStatus =
  | "triagem"
  | "analise"
  | "desenvolvimento"
  | "teste"
  | "entregue";

const COLUNAS: { key: ColunaStatus; label: string; cor: string }[] = [
  { key: "triagem", label: "Triagem", cor: "var(--color-status-triagem)" },
  { key: "analise", label: "Análise", cor: "var(--color-status-analise)" },
  {
    key: "desenvolvimento",
    label: "Desenvolvimento",
    cor: "var(--color-status-desenvolvimento)",
  },
  { key: "teste", label: "Teste", cor: "var(--color-status-teste)" },
  {
    key: "para_publicar",
    label: "Para Publicar",
    cor: "var(--color-status-para_publicar)",
  },
  { key: "entregue", label: "Entregue", cor: "var(--color-status-entregue)" },
];

export const STATUS_NO_BOARD: StatusDemanda[] = [
  "triagem",
  "reaberta",
  "analise",
  "desenvolvimento",
  "teste",
  "para_publicar",
  "entregue",
];

interface KanbanBoardProps {
  rows: DemandaListaRow[];
  isLoading?: boolean;
  onCardClick?: (row: DemandaListaRow) => void;
}

export function KanbanBoard({ rows, isLoading, onCardClick }: KanbanBoardProps) {
  const porColuna = React.useMemo(() => {
    const mapa: Record<ColunaStatus, DemandaListaRow[]> = {
      triagem: [],
      analise: [],
      desenvolvimento: [],
      teste: [],
      entregue: [],
    };
    for (const d of rows) {
      const s = d.status;
      if (!s) continue;
      const coluna: ColunaStatus | null =
        s === "reaberta"
          ? "triagem"
          : s === "triagem" ||
              s === "analise" ||
              s === "desenvolvimento" ||
              s === "teste" ||
              s === "entregue"
            ? s
            : null;
      if (coluna) mapa[coluna].push(d);
    }
    for (const k of Object.keys(mapa) as ColunaStatus[]) {
      mapa[k].sort((a, b) => {
        const pa = a.prioridade ?? 0;
        const pb = b.prioridade ?? 0;
        if (pa !== pb) return pb - pa;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }
    return mapa;
  }, [rows]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUNAS.map((col) => {
        const items = porColuna[col.key];
        return (
          <div
            key={col.key}
            className="flex max-h-[calc(100vh-260px)] w-80 flex-shrink-0 flex-col rounded-lg border border-border bg-secondary/20"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-border bg-card px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: col.cor }}
                  aria-hidden
                />
                <h3 className="text-sm font-semibold text-foreground">
                  {col.label}
                </h3>
                {col.key === "triagem" && (
                  <span
                    className="text-[10px] text-muted-foreground"
                    title={`Inclui ${STATUS_DEMANDA_LABEL.reaberta}`}
                  >
                    + reaberta
                  </span>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>

            <div
              className={cn(
                "flex flex-1 flex-col gap-2 overflow-y-auto p-2",
                items.length === 0 && !isLoading && "justify-center",
              )}
            >
              {isLoading ? (
                <>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-lg" />
                  ))}
                </>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Sem demandas
                </div>
              ) : (
                items.map((row) => (
                  <KanbanCard
                    key={row.id ?? row.codigo}
                    row={row}
                    onClick={onCardClick}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
