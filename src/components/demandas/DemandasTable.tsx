import * as React from "react";
import { Link2, MessageSquare, Paperclip } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, initials } from "@/lib/utils";
import { formatRelativeSP } from "@/lib/format";
import {
  PRIORIDADE_LABEL_CURTA,
  STATUS_DEMANDA_LABEL,
  TIPO_DEMANDA_LABEL,
  type DemandaListaRow,
} from "@/hooks/useDemandas";
import {
  PRIORIDADE_BADGE_STYLES,
  STATUS_BADGE_STYLES,
} from "@/components/demandas/MetadataSidebar";

interface DemandasTableProps {
  rows: DemandaListaRow[];
  isLoading?: boolean;
  onRowClick?: (row: DemandaListaRow) => void;
}

export function DemandasTable({
  rows,
  isLoading,
  onRowClick,
}: DemandasTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-secondary/30">
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Código</th>
            <th className="px-4 py-2.5 font-medium">Título</th>
            <th className="px-4 py-2.5 font-medium">Tipo</th>
            <th className="px-4 py-2.5 font-medium">Prior.</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Tenant</th>
            <th className="px-4 py-2.5 font-medium">Responsável</th>
            <th className="px-4 py-2.5 font-medium">Atividade</th>
            <th className="px-4 py-2.5 font-medium">Criada</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <DemandaRow key={row.id ?? row.codigo} row={row} onClick={onRowClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DemandaRowProps {
  row: DemandaListaRow;
  onClick?: (row: DemandaListaRow) => void;
}

function DemandaRow({ row, onClick }: DemandaRowProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(row);
  }, [onClick, row]);

  const handleKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.(row);
      }
    },
    [onClick, row],
  );

  const status = row.status ?? "triagem";
  const prioridade = row.prioridade ?? 3;
  const tipo = row.tipo ?? "tarefa";

  return (
    <tr
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="cursor-pointer outline-none transition-colors hover:bg-secondary/30 focus-visible:bg-secondary/30"
    >
      <td className="px-4 py-3 align-middle">
        <span className="font-mono text-xs text-muted-foreground">
          {row.codigo}
        </span>
      </td>
      <td className="max-w-md px-4 py-3 align-middle">
        <div className="truncate text-sm font-medium text-foreground">
          {row.titulo}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: row.modulo_cor ?? "#71717a" }}
            aria-hidden
          />
          <span className="font-mono">
            {row.modulo_nome}
            {row.submodulo_nome ? ` / ${row.submodulo_nome}` : ""}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge variant="outline" className="font-normal">
          {TIPO_DEMANDA_LABEL[tipo]}
        </Badge>
      </td>
      <td className="px-4 py-3 align-middle">
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold",
            PRIORIDADE_BADGE_STYLES[prioridade as 1 | 2 | 3 | 4 | 5],
          )}
          title={PRIORIDADE_LABEL_CURTA[prioridade]}
        >
          {prioridade}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE_STYLES[status],
          )}
        >
          {STATUS_DEMANDA_LABEL[status]}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="text-xs text-muted-foreground">
          {row.tenant_nome ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        {row.responsavel_id ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {row.responsavel_avatar && (
                <AvatarImage src={row.responsavel_avatar} alt="" />
              )}
              <AvatarFallback className="bg-primary/20 text-[10px] font-medium text-primary">
                {initials(row.responsavel_nome ?? "")}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">
              {row.responsavel_nome}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <ActivityCount icon={MessageSquare} count={row.total_comentarios} />
          <ActivityCount icon={Paperclip} count={row.total_anexos} />
          <ActivityCount icon={Link2} count={row.total_vinculos} />
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-muted-foreground">
        {formatRelativeSP(row.created_at)}
      </td>
    </tr>
  );
}

interface ActivityCountProps {
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
}

function ActivityCount({ icon: Icon, count }: ActivityCountProps) {
  const n = count ?? 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5",
        n === 0 && "opacity-30",
      )}
    >
      <Icon className="h-3 w-3" />
      {n}
    </span>
  );
}
