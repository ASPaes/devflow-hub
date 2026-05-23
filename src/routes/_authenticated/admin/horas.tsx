import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollableTable } from "@/components/ui/ScrollableTable";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useProfile } from "@/hooks/useProfile";
import type { AppPermissao } from "@/hooks/useProfile";
import { formatDataLogPT } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/horas")({
  beforeLoad: async ({ context }) => {
    let userId = context.auth.user?.id;
    if (!userId) {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user.id;
    }
    if (!userId) throw redirect({ to: "/login" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("perfil_acesso:perfis_acesso(permissoes)")
      .eq("id", userId)
      .single();

    const pa = profile?.perfil_acesso as
      | { permissoes: AppPermissao[] }
      | { permissoes: AppPermissao[] }[]
      | null;
    const perms: AppPermissao[] = Array.isArray(pa)
      ? (pa[0]?.permissoes ?? [])
      : (pa?.permissoes ?? []);
    if (!perms.includes("gerenciar_usuarios")) {
      throw redirect({ to: "/" });
    }
  },
  component: HorasDevPage,
});

type RelatorioRow = {
  profile_id: string;
  profile_nome: string;
  total_segundos: number;
  total_horas: number;
  valor_hora: number;
  valor_total: number;
  dias_trabalhados: number;
  qtd_demandas: number;
};

type DetalheDia = {
  data: string;
  segundos: number;
  horas: number;
  origem: string;
};

type DetalheRow = {
  demanda_id: string;
  demanda_codigo: string;
  demanda_titulo: string;
  total_segundos: number;
  total_horas: number;
  dias: DetalheDia[];
};

type ProfileLite = { id: string; nome: string };

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatBRL(v: number): string {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatHoras(h: number): string {
  return (h ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function HorasDevPage() {
  useDocumentTitle("Horas de Desenvolvimento");
  const { temPermissao } = useProfile();
  const canView = temPermissao("gerenciar_usuarios");

  const [dataInicio, setDataInicio] = React.useState(firstDayOfMonth());
  const [dataFim, setDataFim] = React.useState(todayISO());
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const profilesQuery = useQuery<ProfileLite[]>({
    queryKey: ["profiles-ativos-horas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
    staleTime: 5 * 60_000,
    enabled: canView,
  });

  const relatorioQuery = useQuery<RelatorioRow[]>({
    queryKey: ["relatorio-horas-dev", dataInicio, dataFim, selectedIds],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "relatorio_horas_desenvolvedor",
        {
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
          p_profile_ids: selectedIds.length > 0 ? selectedIds : null,
        },
      );
      if (error) throw error;
      return (data ?? []) as RelatorioRow[];
    },
    enabled: canView,
  });

  const totals = React.useMemo(() => {
    const rows = relatorioQuery.data ?? [];
    return rows.reduce(
      (acc, r) => {
        acc.horas += Number(r.total_horas) || 0;
        acc.valor += Number(r.valor_total) || 0;
        return acc;
      },
      { horas: 0, valor: 0 },
    );
  }, [relatorioQuery.data]);

  const [expanded, setExpanded] = React.useState<string | null>(null);

  const toggleProfile = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectedLabel =
    selectedIds.length === 0
      ? "Todos os desenvolvedores"
      : selectedIds.length === 1
        ? (profilesQuery.data?.find((p) => p.id === selectedIds[0])?.nome ??
          "1 selecionado")
        : `${selectedIds.length} selecionados`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horas de Desenvolvimento"
        description="Controle de horas e pagamento dos desenvolvedores"
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="dt-ini" className="text-xs text-muted-foreground">
            Data início
          </Label>
          <input
            id="dt-ini"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="dt-fim" className="text-xs text-muted-foreground">
            Data fim
          </Label>
          <input
            id="dt-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Desenvolvedores</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 min-w-[220px] justify-start">
                <Filter className="mr-2 h-4 w-4" />
                {selectedLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="max-h-80 overflow-y-auto p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length} selecionado(s)
                  </span>
                  {selectedIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setSelectedIds([])}
                    >
                      Limpar
                    </Button>
                  )}
                </div>
                {(profilesQuery.data ?? []).map((p) => {
                  const checked = selectedIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/50"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleProfile(p.id)}
                      />
                      <span className="text-sm">{p.nome}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ScrollableTable className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Desenvolvedor</TableHead>
              <TableHead className="text-right">Dias Trabalhados</TableHead>
              <TableHead className="text-right">Demandas</TableHead>
              <TableHead className="text-right">Horas Totais</TableHead>
              <TableHead className="text-right">Valor/Hora</TableHead>
              <TableHead className="text-right">Total a Pagar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relatorioQuery.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`s-${i}`}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!relatorioQuery.isLoading &&
              (relatorioQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Nenhum registro no período selecionado
                  </TableCell>
                </TableRow>
              )}

            {!relatorioQuery.isLoading &&
              (relatorioQuery.data ?? []).map((row) => {
                const isOpen = expanded === row.profile_id;
                return (
                  <React.Fragment key={row.profile_id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpanded(isOpen ? null : row.profile_id)
                      }
                    >
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.profile_nome}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.dias_trabalhados}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.qtd_demandas}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatHoras(Number(row.total_horas))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(row.valor_hora) === 0 ? (
                          <Badge
                            variant="outline"
                            className="border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          >
                            Sem tarifa
                          </Badge>
                        ) : (
                          formatBRL(Number(row.valor_hora))
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatBRL(Number(row.valor_total))}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={6} className="py-4">
                          <DetalheDesenvolvedor
                            profileId={row.profile_id}
                            dataInicio={dataInicio}
                            dataFim={dataFim}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}

            {!relatorioQuery.isLoading &&
              (relatorioQuery.data ?? []).length > 0 && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell />
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatHoras(totals.horas)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatBRL(totals.valor)}
                  </TableCell>
                </TableRow>
              )}
          </TableBody>
        </Table>
      </ScrollableTable>
    </div>
  );
}

function DetalheDesenvolvedor({
  profileId,
  dataInicio,
  dataFim,
}: {
  profileId: string;
  dataInicio: string;
  dataFim: string;
}) {
  const detalheQuery = useQuery<DetalheRow[]>({
    queryKey: ["detalhe-horas-dev", profileId, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "detalhe_horas_desenvolvedor",
        {
          p_profile_id: profileId,
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
        },
      );
      if (error) throw error;
      return (data ?? []) as DetalheRow[];
    },
  });

  if (detalheQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    );
  }

  const rows = detalheQuery.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma demanda no período.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((d) => (
        <DetalheDemanda key={d.demanda_id} demanda={d} />
      ))}
    </div>
  );
}

function DetalheDemanda({ demanda }: { demanda: DetalheRow }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-secondary/30"
      >
        <div className="flex items-center gap-2 text-sm">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {demanda.demanda_codigo}
          </span>
          <span className="font-medium">{demanda.demanda_titulo}</span>
        </div>
        <span className="text-sm tabular-nums">
          {formatHoras(Number(demanda.total_horas))} h
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Data</th>
                <th className="py-1 text-left font-medium">Origem</th>
                <th className="py-1 text-right font-medium">Horas</th>
              </tr>
            </thead>
            <tbody>
              {demanda.dias.map((d, i) => (
                <tr
                  key={`${d.data}-${i}`}
                  className={cn(i > 0 && "border-t border-border/50")}
                >
                  <td className="py-1">{formatDataLogPT(d.data)}</td>
                  <td className="py-1 capitalize text-muted-foreground">
                    {d.origem}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {formatHoras(Number(d.horas))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
