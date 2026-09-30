import * as React from "react";
import { CalendarDays, Eye, Link2, MessageSquare, Paperclip, Undo2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TenantLogo } from "@/components/ui/TenantLogo";
import { cn, initials } from "@/lib/utils";
import { formatDateSP } from "@/lib/format";
import {
  PRIORIDADE_LABEL_CURTA,
  type DemandaListaRow,
} from "@/hooks/useDemandas";
import { useTenants } from "@/hooks/useTenants";
import { PRIORIDADE_BADGE_STYLES } from "@/components/demandas/MetadataSidebar";
import { TipoBadge } from "@/components/demandas/TipoBadge";

interface KanbanCardProps {
  row: DemandaListaRow;
  onClick?: (row: DemandaListaRow) => void;
  /** Olhinho: abre a pré-visualização sem entrar na demanda. */
  onPreview?: (row: DemandaListaRow) => void;
}

export function KanbanCard({ row, onClick, onPreview }: KanbanCardProps) {
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
          <TipoBadge
            codigo={row.tipo_codigo ?? row.tipo}
            label={row.tipo_label}
            icone={row.tipo_icone}
            cor={row.tipo_cor}
            size="sm"
          />
          {row.foi_reaberta && (
            <span
              className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
              title={`Reaberta ${row.total_reaberturas ?? 1}x`}
            >
              <Undo2 className="h-2.5 w-2.5" />
              {(row.total_reaberturas ?? 1) > 1
                ? `Reaberta ${row.total_reaberturas}x`
                : "Reaberta"}
            </span>
          )}
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
        {/* Solicitante + data de abertura */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 items-center gap-1.5">
            {row.solicitante_id && (
              <>
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
              </>
            )}
          </div>
          {row.created_at && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
              title="Data de abertura"
            >
              <CalendarDays className="h-3 w-3" />
              {formatDateSP(row.created_at)}
            </span>
          )}
        </div>


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
            {onPreview && (
              <button
                type="button"
                title="Pré-visualizar"
                aria-label={`Pré-visualizar ${row.codigo ?? "demanda"}`}
                // Não deixa o clique abrir a demanda nem começar o arrastar
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(row);
                }}
                className="-m-1 rounded p-1 transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
