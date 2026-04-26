import { Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ResponsavelStat } from "@/hooks/useDashboardMetrics";

interface DistribuicaoDesenvolvedorCardProps {
  data: ResponsavelStat[];
  isLoading?: boolean;
  /** Callback invocado ao clicar numa linha (não chamado para "Sem desenvolvedor"). */
  onSelect?: (responsavelId: string) => void;
}

function inicial(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 0) return "?";
  const primeiro = partes[0]?.[0] ?? "";
  const segundo = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeiro + segundo).toUpperCase();
}

export function DistribuicaoDesenvolvedorCard({
  data,
  isLoading,
}: DistribuicaoDesenvolvedorCardProps) {
  const max = data.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          Distribuição por desenvolvedor
        </CardTitle>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {data.length} {data.length === 1 ? "pessoa" : "pessoas"}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma demanda no período/filtros selecionados
          </div>
        ) : (
          data.map((row, idx) => {
            const pct = max > 0 ? (row.total / max) * 100 : 0;
            const isSemDev = row.id === null;
            return (
              <div
                key={row.id ?? `sem-dev-${idx}`}
                className="flex items-center gap-3"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {row.avatar_url && (
                    <AvatarImage src={row.avatar_url} alt={row.nome} />
                  )}
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-semibold",
                      isSemDev && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isSemDev ? "?" : inicial(row.nome)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        isSemDev
                          ? "italic text-muted-foreground"
                          : "text-foreground",
                      )}
                    >
                      {row.nome}
                    </span>
                    <span className="font-mono text-xs text-foreground">
                      {row.total}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 overflow-hidden rounded-md bg-secondary/40">
                    <div
                      className={cn(
                        "h-full rounded-md transition-all",
                        isSemDev ? "bg-muted-foreground/40" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
