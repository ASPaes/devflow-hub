import { useNavigate } from "@tanstack/react-router";

import { useDashboardFilters } from "@/contexts/DashboardFiltersContext";
import {
  type DashboardFiltros,
  FILTROS_VAZIOS,
} from "@/hooks/useDashboardMetrics";

/**
 * Drill-down do Dashboard pra tela de Demandas.
 *
 * - `drillDown(overrides)`: substitui todos os filtros multi-select pelos
 *   `overrides` informados e navega pra /demandas. Período/tipoData/apenasSemData
 *   são preservados (vivem no Context e não são tocados aqui).
 * - `goToDemandas()`: apenas navega pra /demandas, sem mudar filtros.
 */
export function useDrillDown() {
  const navigate = useNavigate();
  const { setFiltros } = useDashboardFilters();

  const drillDown = (overrides: Partial<DashboardFiltros>) => {
    setFiltros({ ...FILTROS_VAZIOS, ...overrides });
    navigate({ to: "/demandas" });
  };

  const goToDemandas = () => {
    navigate({ to: "/demandas" });
  };

  return { drillDown, goToDemandas };
}
