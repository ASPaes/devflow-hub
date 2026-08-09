import { useNavigate } from "@tanstack/react-router";

import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import {
  type DashboardFiltros,
  FILTROS_VAZIOS,
} from "@/hooks/useDashboardMetrics";
import type { TipoData } from "@/lib/date-presets";

interface DrillDownOptions {
  /**
   * Troca o tipo de data do recorte junto com os filtros. Usado pelos números
   * que são contados por entrega real (`delivered_at`) — sem isso o card mostra
   * um total e a lista de demandas abre com outro, porque o padrão é criação.
   */
  tipoData?: TipoData;
}

/**
 * Drill-down do Dashboard pra tela de Demandas.
 *
 * - `drillDown(overrides, opts)`: substitui todos os filtros multi-select pelos
 *   `overrides` informados e navega pra /demandas. O período é preservado; o
 *   tipoData só muda se `opts.tipoData` for informado.
 * - `goToDemandas()`: apenas navega pra /demandas, sem mudar filtros.
 */
export function useDrillDown() {
  const navigate = useNavigate();
  const { setFiltros, setTipoData, setApenasSemData } = useDashboardFilters();

  const drillDown = (
    overrides: Partial<DashboardFiltros>,
    opts?: DrillDownOptions,
  ) => {
    setFiltros({ ...FILTROS_VAZIOS, ...overrides });
    if (opts?.tipoData) {
      setTipoData(opts.tipoData);
      setApenasSemData(false);
    }
    navigate({ to: "/demandas" });
  };

  const goToDemandas = () => {
    navigate({ to: "/demandas" });
  };

  return { drillDown, goToDemandas };
}
