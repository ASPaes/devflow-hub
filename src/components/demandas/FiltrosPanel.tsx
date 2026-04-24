import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAreas } from "@/hooks/useAreas";
import { useModulos } from "@/hooks/useModulos";
import { useUsuarios } from "@/hooks/useUsuarios";
import {
  PRIORIDADE_LABEL_CURTA,
  STATUS_DEMANDA_LABEL,
  STATUS_DEMANDA_VALUES,
  TIPO_DEMANDA_LABEL,
  TIPO_DEMANDA_VALUES,
  type StatusDemanda,
  type TipoDemanda,
} from "@/hooks/useDemandas";

const PRIORIDADES = [1, 2, 3, 4, 5] as const;

export const RESPONSAVEL_SEM = "_sem_" as const;

export interface FiltrosState {
  busca: string;
  status: StatusDemanda[];
  prioridade: number[];
  tipo: TipoDemanda[];
  modulo_id?: string;
  area_id?: string;
  /** uuid | "_sem_" | undefined */
  responsavel_id?: string;
}

interface FiltrosPanelProps {
  value: FiltrosState;
  onChange: (patch: Partial<FiltrosState>) => void;
  onClear: () => void;
  /** Esconde o dropdown de Status (usado no Kanban, onde status é o board). */
  hideStatus?: boolean;
}

export function FiltrosPanel({
  value,
  onChange,
  onClear,
  hideStatus,
}: FiltrosPanelProps) {
  const modulosQuery = useModulos();
  const areasQuery = useAreas();
  const usuariosQuery = useUsuarios();

  const modulos = React.useMemo(
    () => (modulosQuery.data ?? []).filter((m) => m.ativo),
    [modulosQuery.data],
  );
  const areas = React.useMemo(
    () => (areasQuery.data ?? []).filter((a) => a.ativo),
    [areasQuery.data],
  );
  // Responsáveis: usuários ativos com permissão editar_qualquer_demanda
  const responsaveis = React.useMemo(
    () =>
      (usuariosQuery.data ?? []).filter(
        (u) => u.ativo && u.permissoes.includes("editar_qualquer_demanda"),
      ),
    [usuariosQuery.data],
  );

  const hasFiltros =
    !!value.busca?.trim() ||
    value.status.length > 0 ||
    value.prioridade.length > 0 ||
    value.tipo.length > 0 ||
    !!value.modulo_id ||
    !!value.area_id ||
    !!value.responsavel_id;

  const toggleArray = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {/* Busca */}
      <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
          placeholder="Buscar por código, título ou descrição..."
          className="pl-8"
        />
        {value.busca && (
          <button
            type="button"
            onClick={() => onChange({ busca: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Status (multi) */}
      {!hideStatus && (
        <MultiDropdown
          label="Status"
          count={value.status.length}
          renderItems={() =>
            STATUS_DEMANDA_VALUES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={value.status.includes(s)}
                onCheckedChange={() =>
                  onChange({ status: toggleArray(value.status, s) })
                }
                onSelect={(e) => e.preventDefault()}
              >
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: `var(--color-status-${s})` }}
                  aria-hidden
                />
                {STATUS_DEMANDA_LABEL[s]}
              </DropdownMenuCheckboxItem>
            ))
          }
        />
      )}

      {/* Prioridade (multi) */}
      <MultiDropdown
        label="Prioridade"
        count={value.prioridade.length}
        renderItems={() =>
          PRIORIDADES.map((p) => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={value.prioridade.includes(p)}
              onCheckedChange={() =>
                onChange({ prioridade: toggleArray(value.prioridade, p) })
              }
              onSelect={(e) => e.preventDefault()}
            >
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: `var(--color-prioridade-${p})` }}
                aria-hidden
              />
              {p} — {PRIORIDADE_LABEL_CURTA[p]}
            </DropdownMenuCheckboxItem>
          ))
        }
      />

      {/* Tipo (multi) */}
      <MultiDropdown
        label="Tipo"
        count={value.tipo.length}
        renderItems={() =>
          TIPO_DEMANDA_VALUES.map((t) => (
            <DropdownMenuCheckboxItem
              key={t}
              checked={value.tipo.includes(t)}
              onCheckedChange={() =>
                onChange({ tipo: toggleArray(value.tipo, t) })
              }
              onSelect={(e) => e.preventDefault()}
            >
              {TIPO_DEMANDA_LABEL[t]}
            </DropdownMenuCheckboxItem>
          ))
        }
      />

      {/* Módulo (single) */}
      <Select
        value={value.modulo_id ?? "__all__"}
        onValueChange={(v) =>
          onChange({ modulo_id: v === "__all__" ? undefined : v })
        }
      >
        <SelectTrigger className="h-9 w-auto min-w-[140px]">
          <SelectValue placeholder="Módulo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos os módulos</SelectItem>
          {modulos.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: m.cor ?? "#71717a" }}
                  aria-hidden
                />
                {m.nome}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Área (single) */}
      <Select
        value={value.area_id ?? "__all__"}
        onValueChange={(v) =>
          onChange({ area_id: v === "__all__" ? undefined : v })
        }
      >
        <SelectTrigger className="h-9 w-auto min-w-[140px]">
          <SelectValue placeholder="Área" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas as áreas</SelectItem>
          {areas.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Responsável (single + sentinel) */}
      <Select
        value={value.responsavel_id ?? "__all__"}
        onValueChange={(v) =>
          onChange({ responsavel_id: v === "__all__" ? undefined : v })
        }
      >
        <SelectTrigger className="h-9 w-auto min-w-[160px]">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos responsáveis</SelectItem>
          <SelectItem value={RESPONSAVEL_SEM}>Sem responsável</SelectItem>
          {responsaveis.length > 0 && <DropdownMenuSeparator />}
          {responsaveis.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

interface MultiDropdownProps {
  label: string;
  count: number;
  renderItems: () => React.ReactNode;
}

function MultiDropdown({ label, count, renderItems }: MultiDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9", count > 0 && "border-primary/40")}
        >
          {label}
          {count > 0 && (
            <Badge
              variant="secondary"
              className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
            >
              {count}
            </Badge>
          )}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="h-3 w-3" /> {label}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderItems()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
