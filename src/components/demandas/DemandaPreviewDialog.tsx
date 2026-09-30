import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import { formatDataHoraRelativaSP, formatDateSP } from "@/lib/format";
import {
  PRIORIDADE_LABEL_CURTA,
  useDemanda,
  useDemandaAnexos,
} from "@/hooks/useDemandas";
import { useTiposDemanda } from "@/hooks/useTiposDemanda";
import {
  PRIORIDADE_BADGE_STYLES,
  SolicitanteSummary,
  StatusBadge,
} from "@/components/demandas/MetadataSidebar";
import { TipoBadge } from "@/components/demandas/TipoBadge";
import { AnexoCard } from "@/components/demandas/AnexoCard";

interface DemandaPreviewDialogProps {
  /** Código da demanda a pré-visualizar; null fecha o modal. */
  codigo: string | null;
  onClose: () => void;
}

/**
 * Espiada rápida na demanda, só leitura. Quem quiser tratar entra pelo
 * botão "Abrir demanda" e cai na tela completa.
 */
export function DemandaPreviewDialog({ codigo, onClose }: DemandaPreviewDialogProps) {
  return (
    <Dialog open={!!codigo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 p-0">
        {codigo && <PreviewConteudo codigo={codigo} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function PreviewConteudo({ codigo, onClose }: { codigo: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: demanda, isLoading, error } = useDemanda(codigo);
  const { data: anexos = [] } = useDemandaAnexos(demanda?.id);
  const { data: tipos = [] } = useTiposDemanda();
  const tipoInfo = React.useMemo(
    () => tipos.find((t) => t.id === demanda?.tipo_id) ?? null,
    [tipos, demanda?.tipo_id],
  );

  const abrir = () => {
    onClose();
    void navigate({ to: "/demandas/$codigo", params: { codigo } });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <DialogTitle className="sr-only">Carregando demanda</DialogTitle>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !demanda) {
    return (
      <div className="p-6">
        <DialogTitle className="text-base">Demanda {codigo}</DialogTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível carregar a demanda.
        </p>
      </div>
    );
  }

  const prioridade = (demanda.prioridade ?? 3) as 1 | 2 | 3 | 4 | 5;

  return (
    <>
      <DialogHeader className="space-y-3 border-b border-border p-6 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{demanda.codigo}</span>
          <TipoBadge
            codigo={tipoInfo?.codigo ?? demanda.tipo}
            label={tipoInfo?.label}
            icone={tipoInfo?.icone}
            cor={tipoInfo?.cor}
          />
          <StatusBadge status={demanda.status} />
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
              PRIORIDADE_BADGE_STYLES[prioridade],
            )}
          >
            P{prioridade} · {PRIORIDADE_LABEL_CURTA[prioridade]}
          </span>
        </div>
        <DialogTitle className="text-xl leading-snug">{demanda.titulo}</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>
              Aberto por <SolicitanteSummary solicitante={demanda.solicitante} />
              {demanda.tenant?.nome ? ` (${demanda.tenant.nome})` : ""}{" "}
              {formatDataHoraRelativaSP(demanda.created_at)}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {demanda.modulo && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: demanda.modulo.cor ?? "#71717a" }}
                    aria-hidden
                  />
                  <span className="font-mono">
                    {demanda.modulo.nome}
                    {demanda.submodulo ? ` / ${demanda.submodulo.nome}` : ""}
                  </span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                Dev:
                {demanda.responsavel ? (
                  <>
                    <Avatar className="h-4 w-4">
                      {demanda.responsavel.avatar_url && (
                        <AvatarImage src={demanda.responsavel.avatar_url} alt="" />
                      )}
                      <AvatarFallback className="bg-primary/20 text-[8px] font-medium text-primary">
                        {initials(demanda.responsavel.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-foreground">{demanda.responsavel.nome}</span>
                  </>
                ) : (
                  <span className="italic">Sem desenvolvedor</span>
                )}
              </span>
              {demanda.dev_deadline && (
                <span>Data desenv.: {formatDateSP(demanda.dev_deadline)}</span>
              )}
              {demanda.delivered_at && (
                <span>Entregue em: {formatDateSP(demanda.delivered_at)}</span>
              )}
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Descrição</h3>
          {demanda.descricao ? (
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {demanda.descricao}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem descrição</p>
          )}
        </section>

        {anexos.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Anexos ({anexos.length})
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {anexos.map((a) => (
                <AnexoCard key={a.id} anexo={a} />
              ))}
            </div>
          </section>
        )}
      </div>

      <DialogFooter className="border-t border-border p-4">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button onClick={abrir} className="gap-1.5">
          Abrir demanda
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogFooter>
    </>
  );
}
