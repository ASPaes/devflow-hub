import * as React from "react";
import { Undo2, ChevronDown, ChevronUp } from "lucide-react";

import { useReaberturasDemanda } from "@/hooks/useReaberturasDemanda";
import { formatDateTimeSP } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  demandaId: string;
  totalReaberturas: number;
}

export function DemandaReabertaBadge({ demandaId, totalReaberturas }: Props) {
  const { data: reaberturas = [] } = useReaberturasDemanda(demandaId);
  const ultima = reaberturas[0];
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="flex-1 space-y-1 text-sm">
          <p className="font-medium text-amber-200">
            Demanda reaberta{totalReaberturas > 1 ? ` ${totalReaberturas}x` : ""}
          </p>
          {ultima && (
            <p className="text-xs text-muted-foreground">
              {ultima.reaberta_por_nome ?? "Desconhecido"} reabriu em{" "}
              {formatDateTimeSP(ultima.reaberta_em)}
            </p>
          )}
          {ultima?.motivo && (
            <p className="text-xs italic text-foreground/80">
              "{ultima.motivo}"
            </p>
          )}
          {totalReaberturas > 1 && reaberturas.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-300 hover:underline"
            >
              {expanded ? (
                <>
                  Ocultar histórico <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Ver histórico completo ({totalReaberturas}){" "}
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
          {expanded && reaberturas.length > 1 && (
            <ul className="mt-2 space-y-2 border-t border-amber-500/20 pt-2">
              {reaberturas.slice(1).map((r) => (
                <li key={r.id} className={cn("text-xs text-muted-foreground")}>
                  <div className="font-medium text-foreground/90">
                    {r.reaberta_por_nome ?? "Desconhecido"}{" "}
                    <span className="font-normal text-muted-foreground">
                      em {formatDateTimeSP(r.reaberta_em)}
                    </span>
                  </div>
                  <div className="italic">"{r.motivo}"</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
