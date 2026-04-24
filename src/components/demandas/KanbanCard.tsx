import * as React from "react";
import { Link2, MessageSquare, Paperclip } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import {
  PRIORIDADE_LABEL_CURTA,
  TIPO_DEMANDA_LABEL,
  type DemandaListaRow,
} from "@/hooks/useDemandas";
import { PRIORIDADE_BADGE_STYLES } from "@/components/demandas/MetadataSidebar";

interface KanbanCardProps {
  row: DemandaListaRow;
  onClick?: (row: DemandaListaRow) => void;
}

export function KanbanCard({ row, onClick }: KanbanCardProps) {
  const handleClick = React.useCallback(() => onClick?.(row), [onClick, row]);
  const handleKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(row);
      }
    },
    [onClick, row],
  );

  const prioridade = (row.prioridade ?? 3) as 1 | 2 | 3 | 4 | 5;
  const tipo = row.tipo ?? "tarefa";
  const totalC = row.total_comentarios ?? 0;
  const totalA = row.total_anexos ?? 0;
  const totalV = row.total_vinculos ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="group cursor-pointer rounded-lg border border-border bg-card p-3 outline-none transition-colors hover:border-primary/40 hover:bg-secondary/30 focus-visible:border-primary/40 focus-visible:bg-secondary/30"
    >
      {/* Linha 1: código + prioridade + tipo */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.codigo}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold",
              PRIORIDADE_BADGE_STYLES[prioridade],
            )}
            title={PRIORIDADE_LABEL_CURTA[prioridade]}
          >
            P{prioridade}
          </span>
          <span className="text-xs" title={TIPO_DEMANDA_LABEL[tipo]} aria-hidden>
            {TIPO_DEMANDA_LABEL[tipo].split(" ")[0]}
          </span>
        </div>
      </div>

      {/* Linha 2: título */}
      <h4 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
        {row.titulo}
      </h4>

      {/* Linha 3: módulo / submódulo */}
      {row.modulo_nome && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.modulo_cor ?? "#71717a" }}
            aria-hidden
          />
          <span className="truncate font-mono">
            {row.modulo_nome}
            {row.submodulo_nome ? ` / ${row.submodulo_nome}` : ""}
          </span>
        </div>
      )}

      {/* Linha 4: avatar + contadores */}
      <div className="mt-3 flex items-center justify-between">
        {row.responsavel_id ? (
          <Avatar className="h-6 w-6" title={row.responsavel_nome ?? ""}>
            {row.responsavel_avatar && (
              <AvatarImage src={row.responsavel_avatar} alt="" />
            )}
            <AvatarFallback className="bg-primary/20 text-[10px] font-medium text-primary">
              {initials(row.responsavel_nome ?? "")}
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-6 w-6" title="Sem responsável">
            <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
              ?
            </AvatarFallback>
          </Avatar>
        )}

        {(totalC > 0 || totalA > 0 || totalV > 0) && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {totalC > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {totalC}
              </span>
            )}
            {totalA > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" />
                {totalA}
              </span>
            )}
            {totalV > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Link2 className="h-3 w-3" />
                {totalV}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
