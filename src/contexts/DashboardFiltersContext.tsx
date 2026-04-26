import * as React from "react";
import type { DateRange } from "react-day-picker";
import { presetToRange, type TipoData } from "@/lib/date-presets";
import {
  type DashboardFiltros,
  FILTROS_VAZIOS,
} from "@/hooks/useDashboardMetrics";

interface DashboardFiltersState {
  periodo: DateRange | null;
  tipoData: TipoData;
  apenasSemData: boolean;
  filtros: DashboardFiltros;
}

interface DashboardFiltersContextValue extends DashboardFiltersState {
  setPeriodo: (periodo: DateRange | null) => void;
  setTipoData: (tipo: TipoData) => void;
  setApenasSemData: (apenas: boolean) => void;
  setFiltros: (filtros: DashboardFiltros) => void;
  resetAll: () => void;
}

const DashboardFiltersContext =
  React.createContext<DashboardFiltersContextValue | null>(null);

function defaultPeriodo(): DateRange {
  const r = presetToRange("este_mes");
  return { from: r.from, to: r.to };
}

const INITIAL_STATE: DashboardFiltersState = {
  periodo: defaultPeriodo(),
  tipoData: "criacao",
  apenasSemData: false,
  filtros: FILTROS_VAZIOS,
};

export function DashboardFiltersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [periodo, setPeriodo] = React.useState<DateRange | null>(
    INITIAL_STATE.periodo,
  );
  const [tipoData, setTipoData] = React.useState<TipoData>(
    INITIAL_STATE.tipoData,
  );
  const [apenasSemData, setApenasSemData] = React.useState(
    INITIAL_STATE.apenasSemData,
  );
  const [filtros, setFiltros] = React.useState<DashboardFiltros>(
    INITIAL_STATE.filtros,
  );

  const resetAll = React.useCallback(() => {
    setPeriodo(defaultPeriodo());
    setTipoData("criacao");
    setApenasSemData(false);
    setFiltros(FILTROS_VAZIOS);
  }, []);

  const value = React.useMemo<DashboardFiltersContextValue>(
    () => ({
      periodo,
      tipoData,
      apenasSemData,
      filtros,
      setPeriodo,
      setTipoData,
      setApenasSemData,
      setFiltros,
      resetAll,
    }),
    [periodo, tipoData, apenasSemData, filtros, resetAll],
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = React.useContext(DashboardFiltersContext);
  if (!ctx) {
    throw new Error(
      "useDashboardFilters precisa estar dentro de <DashboardFiltersProvider>",
    );
  }
  return ctx;
}
