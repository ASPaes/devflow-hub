import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  PRIORIDADE_LABEL_CURTA,
  STATUS_DEMANDA_LABEL,
  STATUS_DEMANDA_VALUES,
  TIPO_DEMANDA_LABEL,
  TIPO_DEMANDA_VALUES,
} from "@/hooks/useDemandas";
import {
  FILTROS_VAZIOS,
  type DashboardFiltros,
} from "@/hooks/useDashboardMetrics";
import { MultiSelectFilter, type FilterOption } from "./MultiSelectFilter";

interface DashboardFilterBarProps {
  filtros: DashboardFiltros;
  onChange: (filtros: DashboardFiltros) => void;
}

export function DashboardFilterBar({
  filtros,
  onChange,
}: DashboardFilterBarProps) {
  const statusOptions: FilterOption<string>[] = STATUS_DEMANDA_VALUES.map(
    (v) => ({ value: v, label: STATUS_DEMANDA_LABEL[v] }),
  );

  const prioridadeOptions: FilterOption<number>[] = [1, 2, 3, 4, 5].map((v) => ({
    value: v,
    label: `${v} — ${PRIORIDADE_LABEL_CURTA[v]}`,
  }));

  const tipoOptions: FilterOption<string>[] = TIPO_DEMANDA_VALUES.map((v) => ({
    value: v,
    label: TIPO_DEMANDA_LABEL[v],
  }));

  const { data: modulos = [], isLoading: loadingModulos } = useQuery({
    queryKey: ["dashboard-filter-modulos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ["dashboard-filter-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: responsaveis = [], isLoading: loadingResp } = useQuery({
    queryKey: ["dashboard-filter-responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_potenciais_responsaveis")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: solicitantes = [], isLoading: loadingSolic } = useQuery({
    queryKey: ["dashboard-filter-solicitantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const moduloOptions: FilterOption<string>[] = modulos.map((m) => ({
    value: m.id,
    label: m.nome,
  }));
  const areaOptions: FilterOption<string>[] = areas.map((a) => ({
    value: a.id,
    label: a.nome,
  }));
  const tenantOptions: FilterOption<string>[] = tenants.map((t) => ({
    value: t.id,
    label: t.nome,
  }));
  const responsavelOptions: FilterOption<string>[] = responsaveis
    .filter((r): r is { id: string; nome: string } => !!r.id && !!r.nome)
    .map((r) => ({ value: r.id, label: r.nome }));
  const solicitanteOptions: FilterOption<string>[] = solicitantes.map((s) => ({
    value: s.id,
    label: s.nome,
  }));

  const totalAplicados =
    filtros.status.length +
    filtros.prioridade.length +
    filtros.tipo.length +
    filtros.modulo_id.length +
    filtros.tenant_id.length +
    filtros.responsavel_id.length +
    filtros.solicitante_id.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFilter<string>
        label="Status"
        options={statusOptions}
        selected={filtros.status}
        onChange={(v) => onChange({ ...filtros, status: v })}
      />
      <MultiSelectFilter<number>
        label="Prioridade"
        options={prioridadeOptions}
        selected={filtros.prioridade}
        onChange={(v) => onChange({ ...filtros, prioridade: v })}
      />
      <MultiSelectFilter<string>
        label="Tipo"
        options={tipoOptions}
        selected={filtros.tipo}
        onChange={(v) => onChange({ ...filtros, tipo: v })}
      />
      <MultiSelectFilter<string>
        label="Módulo"
        options={moduloOptions}
        selected={filtros.modulo_id}
        onChange={(v) => onChange({ ...filtros, modulo_id: v })}
        loading={loadingModulos}
      />
      <MultiSelectFilter<string>
        label="Empresa"
        options={tenantOptions}
        selected={filtros.tenant_id}
        onChange={(v) => onChange({ ...filtros, tenant_id: v })}
        loading={loadingTenants}
      />
      <MultiSelectFilter<string>
        label="Desenvolvedor"
        options={responsavelOptions}
        selected={filtros.responsavel_id}
        onChange={(v) => onChange({ ...filtros, responsavel_id: v })}
        loading={loadingResp}
      />
      <MultiSelectFilter<string>
        label="Aberto por"
        options={solicitanteOptions}
        selected={filtros.solicitante_id}
        onChange={(v) => onChange({ ...filtros, solicitante_id: v })}
        loading={loadingSolic}
      />

      {totalAplicados > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(FILTROS_VAZIOS)}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 h-3 w-3" />
          Limpar filtros ({totalAplicados})
        </Button>
      )}
    </div>
  );
}
