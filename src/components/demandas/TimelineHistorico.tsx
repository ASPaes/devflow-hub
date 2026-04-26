import { useMemo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, initials } from "@/lib/utils";
import { formatRelativeSP } from "@/lib/format";
import {
  STATUS_DEMANDA_LABEL,
  type StatusDemanda,
} from "@/hooks/useDemandas";
import { useHistorico, type HistoricoItem } from "@/hooks/useHistorico";
import { useUsuarios } from "@/hooks/useUsuarios";

interface Props {
  demandaId: string;
}

export function TimelineHistorico({ demandaId }: Props) {
  const { data: itens = [], isLoading } = useHistorico(demandaId);
  const { data: usuarios = [] } = useUsuarios();

  const nomePorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usuarios) map.set(u.id, u.nome);
    return map;
  }, [usuarios]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma alteração registrada ainda.
      </div>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {itens.map((item, idx) => {
        const isLast = idx === itens.length - 1;
        return (
          <li key={item.id} className="relative">
            <span
              className={cn(
                "absolute -left-[29px] top-1.5 inline-block h-2.5 w-2.5 rounded-full border-2",
                isLast
                  ? "border-border bg-background"
                  : "border-primary/40 bg-primary/40",
              )}
              aria-hidden
            />
            <EventoLinha item={item} nomePorId={nomePorId} />
          </li>
        );
      })}
    </ol>
  );
}

function EventoLinha({
  item,
  nomePorId,
}: {
  item: HistoricoItem;
  nomePorId: Map<string, string>;
}) {
  const autorNome = item.autor?.nome ?? "Sistema";
  const verbo = formatEventoHistorico(item, nomePorId);

  return (
    <div className="flex items-start gap-2.5">
      <Avatar className="h-6 w-6">
        {item.autor?.avatar_url && (
          <AvatarImage src={item.autor.avatar_url} alt="" />
        )}
        <AvatarFallback className="bg-primary/20 text-[10px] font-medium text-primary">
          {initials(autorNome)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 text-sm leading-snug">
        <span className="text-xs text-muted-foreground">
          {formatRelativeSP(item.created_at)}
        </span>{" "}
        <span className="font-medium text-foreground">{autorNome}</span>{" "}
        <span className="text-muted-foreground">{verbo}</span>
      </div>
    </div>
  );
}

function labelStatus(value: string | null): string {
  if (!value) return "—";
  if (value in STATUS_DEMANDA_LABEL) {
    return STATUS_DEMANDA_LABEL[value as StatusDemanda];
  }
  return value;
}

function formatEventoHistorico(
  item: HistoricoItem,
  nomePorId: Map<string, string>,
): string {
  switch (item.campo) {
    case "status":
      return `alterou status de "${labelStatus(item.valor_anterior)}" para "${labelStatus(item.valor_novo)}"`;
    case "prioridade":
      return `alterou prioridade de ${item.valor_anterior ?? "—"} para ${item.valor_novo ?? "—"}`;
    case "responsavel_id": {
      const novoNome = item.valor_novo
        ? (nomePorId.get(item.valor_novo) ?? "outro usuário")
        : null;
      const antigoNome = item.valor_anterior
        ? (nomePorId.get(item.valor_anterior) ?? "outro usuário")
        : null;
      if (!item.valor_anterior && novoNome)
        return `atribuiu desenvolvedor: ${novoNome}`;
      if (item.valor_anterior && !item.valor_novo) return `removeu o desenvolvedor`;
      if (antigoNome && novoNome)
        return `trocou desenvolvedor de ${antigoNome} para ${novoNome}`;
      return `trocou o desenvolvedor`;
    }
    case "titulo":
      return `alterou o título`;
    case "deadline":
      if (!item.valor_anterior && item.valor_novo) return `definiu prazo`;
      if (item.valor_anterior && !item.valor_novo) return `removeu o prazo`;
      return `alterou o prazo`;
    case "estimativa_horas":
      if (!item.valor_anterior && item.valor_novo)
        return `definiu estimativa de ${item.valor_novo}h`;
      if (item.valor_anterior && !item.valor_novo)
        return `removeu a estimativa`;
      return `alterou estimativa de ${item.valor_anterior}h para ${item.valor_novo}h`;
    case "modulo_id":
      return `alterou o módulo`;
    case "submodulo_id":
      return `alterou o submódulo`;
    case "area_id":
      return `alterou a área`;
    default:
      return `alterou ${item.campo}`;
  }
}
