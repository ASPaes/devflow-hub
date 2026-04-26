import { AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import { FILTROS_VAZIOS } from "@/hooks/useDashboardMetrics";

interface SemDataCardProps {
  semDevDeadline: number;
  semDeadline: number;
  isLoading?: boolean;
}

export function SemDataCard({
  semDevDeadline,
  semDeadline,
  isLoading,
}: SemDataCardProps) {
  const navigate = useNavigate();
  const { setTipoData, setApenasSemData, setFiltros } = useDashboardFilters();

  const handleClick = (tipo: "desenvolvimento" | "entrega") => {
    setTipoData(tipo);
    setApenasSemData(true);
    setFiltros(FILTROS_VAZIOS);
    navigate({ to: "/demandas" });
  };

  if (isLoading) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Sem data definida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </CardContent>
      </Card>
    );
  }

  const total = semDevDeadline + semDeadline;
  const tudoZero = total === 0;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Sem data definida
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tudoZero ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            Todas as demandas têm datas definidas. ✅
          </p>
        ) : (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleClick("desenvolvimento")}
              disabled={semDevDeadline === 0}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="text-foreground">Sem Data de Desenvolvimento</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-amber-700 dark:text-amber-400">
                  {semDevDeadline}
                </span>
                {semDevDeadline > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleClick("entrega")}
              disabled={semDeadline === 0}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="text-foreground">Sem Data de Entrega</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono font-medium text-amber-700 dark:text-amber-400">
                  {semDeadline}
                </span>
                {semDeadline > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
