import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Rocket, Calendar, Loader2, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useReleasesPublicadas } from "@/hooks/useReleases";
import {
  TIPO_RELEASE_ICONE,
  TIPO_RELEASE_LABEL,
  type ReleasePublicada,
  type TipoRelease,
} from "@/types/release";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ReleaseDetalhesSheet } from "@/components/releases/ReleaseDetalhesSheet";

export const Route = createFileRoute("/_authenticated/releases")({
  component: ReleasesPage,
});

const TIPO_RELEASE_BADGE: Record<TipoRelease, string> = {
  erro: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  melhoria: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  nova_funcionalidade: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  duvida: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  tarefa: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

interface DiaAgrupado {
  data: string;
  totalItens: number;
  tipos: Array<{ tipo: TipoRelease; releases: ReleasePublicada[] }>;
}

function groupByDateAndType(releases: ReleasePublicada[]): DiaAgrupado[] {
  const porData = new Map<string, ReleasePublicada[]>();
  for (const r of releases) {
    if (!r.data_publicacao) continue;
    const arr = porData.get(r.data_publicacao) ?? [];
    arr.push(r);
    porData.set(r.data_publicacao, arr);
  }
  const datas = Array.from(porData.keys()).sort((a, b) => b.localeCompare(a));
  const ordem: TipoRelease[] = [
    "nova_funcionalidade",
    "melhoria",
    "erro",
    "tarefa",
    "duvida",
  ];
  return datas.map((data) => {
    const items = porData.get(data)!;
    const porTipo = new Map<TipoRelease, ReleasePublicada[]>();
    for (const r of items) {
      const arr = porTipo.get(r.tipo_release) ?? [];
      arr.push(r);
      porTipo.set(r.tipo_release, arr);
    }
    return {
      data,
      totalItens: items.length,
      tipos: ordem
        .filter((t) => porTipo.has(t))
        .map((t) => ({ tipo: t, releases: porTipo.get(t)! })),
    };
  });
}

function ReleasesPage() {
  useDocumentTitle("Releases");
  const { data: releases = [], isLoading } = useReleasesPublicadas();
  const agrupado = React.useMemo(() => groupByDateAndType(releases), [releases]);

  const [tiposSelecionados, setTiposSelecionados] = React.useState<Set<TipoRelease>>(
    new Set()
  );
  const [sheetData, setSheetData] = React.useState<{
    demandaId: string | null;
    demandaCodigo: string | null;
    releaseTitulo: string | null;
  }>({ demandaId: null, demandaCodigo: null, releaseTitulo: null });

  const TIPOS_ORDEM: TipoRelease[] = ["nova_funcionalidade", "melhoria", "erro", "tarefa", "duvida"];

  const agrupadoFiltrado = React.useMemo(() => {
    if (tiposSelecionados.size === 0) return agrupado;
    return agrupado
      .map((dia) => ({
        ...dia,
        tipos: dia.tipos.filter((grupo) => tiposSelecionados.has(grupo.tipo)),
      }))
      .map((dia) => ({
        ...dia,
        totalItens: dia.tipos.reduce((acc, g) => acc + g.releases.length, 0),
      }))
      .filter((dia) => dia.tipos.length > 0);
  }, [agrupado, tiposSelecionados]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Rocket className="h-6 w-6 text-primary" />
          Novidades
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Atualizações, melhorias e correções
        </p>
      </div>

      {!isLoading && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTiposSelecionados(new Set())}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
              tiposSelecionados.size === 0
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                : "bg-transparent text-muted-foreground border-border hover:bg-muted/50"
            }`}
          >
            Todos
          </button>
          {TIPOS_ORDEM.map((tipo) => {
            const ativo = tiposSelecionados.has(tipo);
            return (
              <button
                key={tipo}
                onClick={() => {
                  const newSet = new Set(tiposSelecionados);
                  if (ativo) newSet.delete(tipo);
                  else newSet.add(tipo);
                  setTiposSelecionados(newSet);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  ativo
                    ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {TIPO_RELEASE_ICONE[tipo]}
                {TIPO_RELEASE_LABEL[tipo]}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : agrupadoFiltrado.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {tiposSelecionados.size > 0
            ? "Nenhuma release encontrada com esses filtros."
            : "Nenhuma release publicada ainda."}
        </div>
      ) : (
        <div className="space-y-6">
          {agrupadoFiltrado.map((dia) => (
            <div
              key={dia.data}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize text-foreground">
                    {format(
                      parseISO(dia.data),
                      "EEEE, dd 'de' MMMM 'de' yyyy",
                      { locale: ptBR },
                    )}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {dia.totalItens}{" "}
                  {dia.totalItens === 1 ? "atualização" : "atualizações"}
                </span>
              </div>

              <div className="space-y-5">
                {dia.tipos.map((grupo) => (
                  <div key={grupo.tipo}>
                    <div
                      className={`mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs ${TIPO_RELEASE_BADGE[grupo.tipo]}`}
                    >
                      <span>{TIPO_RELEASE_ICONE[grupo.tipo]}</span>
                      <span>{TIPO_RELEASE_LABEL[grupo.tipo]}</span>
                      <span className="opacity-70">
                        ({grupo.releases.length})
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {grupo.releases.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-md border border-border bg-background p-3"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {r.titulo}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {r.resumo}
                          </p>
                          <button
                            onClick={() =>
                              setSheetData({
                                demandaId: r.demanda_id,
                                demandaCodigo: r.demanda_codigo,
                                releaseTitulo: r.titulo,
                              })
                            }
                            className="mt-2 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 hover:underline"
                          >
                            Exibir mais detalhes
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
