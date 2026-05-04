import * as React from "react";
import { Link2, MessageSquare, Paperclip } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TenantLogo } from "@/components/ui/TenantLogo";
import { cn, initials } from "@/lib/utils";
import {
  PRIORIDADE_LABEL_CURTA,
  TIPO_DEMANDA_LABEL,
  type DemandaListaRow,
} from "@/hooks/useDemandas";
import { useTenants } from "@/hooks/useTenants";
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

  const { data: tenants } = useTenants();
  const tenant = React.useMemo(
    () => tenants?.find((t) => t.id === row.tenant_id),
    [tenants, row.tenant_id],
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
      {/* Linha 1: código + logo + prioridade + tipo */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {row.codigo}
        </span>
        <div className="flex items-center gap-1.5">
          {row.tenant_id && (
            <TenantLogo
              nome={tenant?.nome ?? row.tenant_nome}
              logoUrl={tenant?.logo_url}
              updatedAt={tenant?.updated_at}
              size="sm"
            />
          )}
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

      {/* Rodapé: solicitante, empresa, dev + contadores */}
      <div className="mt-3 space-y-2 border-t border-border pt-2">
        {/* Solicitante */}
        {row.solicitante_id && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="shrink-0 text-muted-foreground">Aberto por:</span>
            <Avatar className="h-4 w-4">
              {row.solicitante_avatar && (
                <AvatarImage src={row.solicitante_avatar} alt="" />
              )}
              <AvatarFallback className="bg-secondary text-[8px] font-medium text-muted-foreground">
                {initials(row.solicitante_nome ?? "")}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-foreground">
              {row.solicitante_nome}
            </span>
          </div>
        )}


        {/* Dev + contadores */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-muted-foreground">Dev:</span>
            {row.responsavel_id ? (
              <>
                <Avatar className="h-4 w-4">
                  {row.responsavel_avatar && (
                    <AvatarImage src={row.responsavel_avatar} alt="" />
                  )}
                  <AvatarFallback className="bg-primary/20 text-[8px] font-medium text-primary">
                    {initials(row.responsavel_nome ?? "")}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-foreground">
                  {row.responsavel_nome}
                </span>
              </>
            ) : (
              <span className="italic text-muted-foreground">
                Sem desenvolvedor
              </span>
            )}
          </div>

          {(totalC > 0 || totalA > 0 || totalV > 0) && (
            <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
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
    </div>
  );
}
