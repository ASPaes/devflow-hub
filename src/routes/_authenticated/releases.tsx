import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Rocket, Calendar, Loader2, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useReleasesPublicadas } from "@/hooks/useReleases";
import { useTiposDemanda } from "@/hooks/useTiposDemanda";
import type { ReleasePublicada } from "@/types/release";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ReleaseDetalhesSheet } from "@/components/releases/ReleaseDetalhesSheet";

export const Route = createFileRoute("/_authenticated/releases")({
  component: ReleasesPage,
});

interface GrupoTipo {
  chave: string; // tipo_id quando existir, senão tipo_release legado, senão "outros"
  tipo_id: string | null;
  tipo_label: string;
  tipo_icone: string;
  tipo_cor: string | null;
  releases: ReleasePublicada[];
}

interface DiaAgrupado {
  data: string;
  totalItens: number;
  tipos: GrupoTipo[];
}

function metaDoRelease(r: ReleasePublicada) {
  const chave = r.tipo_id ?? r.tipo_release ?? "outros";
  const label = r.tipo_label ?? r.tipo_release ?? "Outros";
  const icone = r.tipo_icone ?? "📌";
  const cor = r.tipo_cor ?? null;
  return { chave, label, icone, cor };
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
  return datas.map((data) => {
    const items = porData.get(data)!;
    const porTipo = new Map<string, GrupoTipo>();
    for (const r of items) {
      const meta = metaDoRelease(r);
      const existente = porTipo.get(meta.chave);
      if (existente) {
        existente.releases.push(r);
      } else {
        porTipo.set(meta.chave, {
          chave: meta.chave,
          tipo_id: r.tipo_id,
          tipo_label: meta.label,
          tipo_icone: meta.icone,
          tipo_cor: meta.cor,
          releases: [r],
        });
      }
    }
    return {
      data,
      totalItens: items.length,
      tipos: Array.from(porTipo.values()),
    };
  });
}

function ReleasesPage() {
  useDocumentTitle("Releases");
  const { data: releases = [], isLoading } = useReleasesPublicadas();
  const { data: tiposDisponiveis = [] } = useTiposDemanda();
  const agrupado = React.useMemo(() => groupByDateAndType(releases), [releases]);

  const [tiposSelecionados, setTiposSelecionados] = React.useState<Set<string>>(
    new Set(),
  );
  const [sheetData, setSheetData] = React.useState<{
    demandaId: string | null;
    demandaCodigo: string | null;
    releaseTitulo: string | null;
  }>({ demandaId: null, demandaCodigo: null, releaseTitulo: null });

  const agrupadoFiltrado = React.useMemo(() => {
    if (tiposSelecionados.size === 0) return agrupado;
    return agrupado
      .map((dia) => {
        const tipos = dia.tipos.filter(
          (grupo) => grupo.tipo_id !== null && tiposSelecionados.has(grupo.tipo_id),
        );
        return {
          ...dia,
          tipos,
          totalItens: tipos.reduce((acc, g) => acc + g.releases.length, 0),
        };
      })
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
          {tiposDisponiveis.map((tipo) => {
            const ativo = tiposSelecionados.has(tipo.id);
            return (
              <button
                key={tipo.id}
                onClick={() => {
                  const newSet = new Set(tiposSelecionados);
                  if (ativo) newSet.delete(tipo.id);
                  else newSet.add(tipo.id);
                  setTiposSelecionados(newSet);
                }}
                style={{
                  borderColor: ativo ? tipo.cor ?? undefined : undefined,
                  color: ativo ? tipo.cor ?? undefined : undefined,
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  ativo
                    ? "bg-purple-500/10"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {tipo.icone && <span>{tipo.icone}</span>}
                {tipo.label}
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
                  <div key={grupo.chave}>
                    <div
                      className="mb-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
                      style={{
                        borderColor: grupo.tipo_cor ?? undefined,
                        color: grupo.tipo_cor ?? undefined,
                        backgroundColor: grupo.tipo_cor
                          ? `${grupo.tipo_cor}1a`
                          : undefined,
                      }}
                    >
                      <span>{grupo.tipo_icone}</span>
                      <span>{grupo.tipo_label}</span>
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

      <ReleaseDetalhesSheet
        open={sheetData.demandaId !== null}
        onOpenChange={(o) => {
          if (!o)
            setSheetData({
              demandaId: null,
              demandaCodigo: null,
              releaseTitulo: null,
            });
        }}
        demandaId={sheetData.demandaId}
        demandaCodigo={sheetData.demandaCodigo}
        releaseTitulo={sheetData.releaseTitulo}
      />
    </div>
  );
}
