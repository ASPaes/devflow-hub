import * as React from "react";
import { Clock, Hand, History, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";

import { PausarComAjusteDialog } from "./PausarComAjusteDialog";
import { distribuirTempoEntreDoisDias } from "@/lib/timer";

const LIMITE_AVISO_SEGUNDOS = 5 * 60 * 60;

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDataLogPT } from "@/lib/format";
import {
  HoraMinutoInput,
  formatHMFromSegundos,
} from "@/components/ui/HoraMinutoInput";
import {
  useIniciarTimer,
  usePausarTimer,
  useTimerLog,
  type TimerLogRow,
} from "@/hooks/useTimerDemanda";
import {
  useAtualizarTempoManual,
  useExcluirTempoManual,
  useInserirTempoManual,
} from "@/hooks/useTempoManual";
import { useProfile } from "@/hooks/useProfile";
import type { DemandaCompleta } from "@/hooks/useDemandas";

interface TimerCardProps {
  demanda: DemandaCompleta;
  isResponsavel: boolean;
}

const STATUS_FINAIS = new Set(["entregue", "encerrada", "cancelada"]);

export function TimerCard({ demanda, isResponsavel }: TimerCardProps) {
  const iniciarMutation = useIniciarTimer();
  const pausarMutation = usePausarTimer();
  const { data: log = [] } = useTimerLog(demanda.id);
  const { temPermissao } = useProfile();
  const podeInserirManual = temPermissao("inserir_tempo_manual");
  const excluirManual = useExcluirTempoManual(demanda.id);

  const [formOpen, setFormOpen] = React.useState(false);
  const [logEditando, setLogEditando] = React.useState<TimerLogRow | null>(
    null,
  );
  const [ajusteOpen, setAjusteOpen] = React.useState(false);
  const [dadosAjuste, setDadosAjuste] = React.useState<{
    segundosTotais: number;
    distribuicao: Array<{ data: string; segundos: number }>;
  } | null>(null);

  const handleClickPausar = () => {
    if (!demanda.timer_iniciado_em) {
      pausarMutation.mutate(demanda.id);
      return;
    }
    const inicio = new Date(demanda.timer_iniciado_em);
    const agora = new Date();
    const segundosSessao = Math.floor(
      (agora.getTime() - inicio.getTime()) / 1000,
    );
    if (segundosSessao <= LIMITE_AVISO_SEGUNDOS) {
      pausarMutation.mutate(demanda.id);
      return;
    }
    setDadosAjuste({
      segundosTotais: segundosSessao,
      distribuicao: distribuirTempoEntreDoisDias(inicio, agora),
    });
    setAjusteOpen(true);
  };

  const handleConfirmarNormal = () => {
    setAjusteOpen(false);
    pausarMutation.mutate(demanda.id);
  };

  const abrirCriar = () => {
    setLogEditando(null);
    setFormOpen(true);
  };
  const abrirEditar = (row: TimerLogRow) => {
    setLogEditando(row);
    setFormOpen(true);
  };
  const confirmarExcluir = (row: TimerLogRow) => {
    const txt = `${formatDataLogPT(row.data)} (${formatHMFromSegundos(row.segundos)})`;
    if (window.confirm(`Excluir lançamento manual de ${txt}?`)) {
      excluirManual.mutate(row.id);
    }
  };

  const rodando = !!demanda.timer_iniciado_em;
  const statusFinal = STATUS_FINAIS.has(demanda.status);
  const podeOperar = isResponsavel && !statusFinal;

  // Tempo ao vivo: tick a cada 1s quando rodando
  const [agora, setAgora] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!rodando) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rodando]);

  const segundosEmAndamento = React.useMemo(() => {
    const base = demanda.tempo_em_andamento_segundos ?? 0;
    if (!rodando || !demanda.timer_iniciado_em) return base;
    const inicio = new Date(demanda.timer_iniciado_em).getTime();
    const adicional = Math.max(0, Math.floor((agora - inicio) / 1000));
    return base + adicional;
  }, [demanda.tempo_em_andamento_segundos, demanda.timer_iniciado_em, rodando, agora]);

  const realizado = demanda.tempo_realizado_segundos ?? 0;
  const operando = iniciarMutation.isPending || pausarMutation.isPending;

  const tooltipDisabled = !isResponsavel
    ? "Apenas o desenvolvedor da demanda pode operar o timer"
    : statusFinal
      ? `Timer indisponível para demandas ${demanda.status}`
      : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Tempo
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label="Histórico do timer"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Histórico por dia
              </span>
            </div>
            {podeInserirManual && (
              <div className="border-b border-border px-3 py-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={abrirCriar}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar manualmente
                </Button>
              </div>
            )}
            {log.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum registro ainda
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {log.map((row) => {
                  const isManual = row.origem === "manual";
                  return (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm"
                    >
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex h-5 w-5 items-center justify-center">
                              {isManual ? (
                                <Hand className="h-3.5 w-3.5 text-amber-500" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isManual
                              ? "Lançamento manual"
                              : "Lançamento automático"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <span className="flex-1 text-foreground">
                        {formatDataLogPT(row.data)}
                      </span>

                      <span className="font-mono text-muted-foreground">
                        {formatHMFromSegundos(row.segundos)}
                      </span>

                      {podeInserirManual && (
                        <span className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Editar tempo"
                            onClick={() => abrirEditar(row)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {isManual && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              title="Excluir"
                              onClick={() => confirmarExcluir(row)}
                              disabled={excluirManual.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </PopoverContent>
        </Popover>

        <LancamentoManualForm
          demandaId={demanda.id}
          open={formOpen}
          onOpenChange={setFormOpen}
          logExistente={logEditando}
        />
      </div>

      {/* Cards lado a lado */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-background/40 p-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Realizado
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-foreground">
            {formatHMFromSegundos(realizado)}
          </div>
        </div>
        <div
          className={`rounded-md border p-2.5 ${
            rodando
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-background/40"
          }`}
        >
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Em andamento
          </div>
          <div
            className={`mt-1 font-mono text-base font-semibold ${
              rodando ? "text-primary" : "text-foreground"
            }`}
          >
            {formatHMFromSegundos(segundosEmAndamento)}
          </div>
        </div>
      </div>

      {/* Botão (mostra um por vez) */}
      <div className="mt-3">
        <TooltipProvider delayDuration={200}>
          {rodando ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!podeOperar || operando}
                    onClick={() => pausarMutation.mutate(demanda.id)}
                  >
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Pausar
                  </Button>
                </span>
              </TooltipTrigger>
              {tooltipDisabled && (
                <TooltipContent>{tooltipDisabled}</TooltipContent>
              )}
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={!podeOperar || operando}
                    onClick={() => iniciarMutation.mutate(demanda.id)}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Iniciar
                  </Button>
                </span>
              </TooltipTrigger>
              {tooltipDisabled && (
                <TooltipContent>{tooltipDisabled}</TooltipContent>
              )}
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </section>
  );
}

function LancamentoManualForm({
  demandaId,
  open,
  onOpenChange,
  logExistente,
}: {
  demandaId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  logExistente: TimerLogRow | null;
}) {
  const inserir = useInserirTempoManual();
  const atualizar = useAtualizarTempoManual(demandaId);
  const isPending = inserir.isPending || atualizar.isPending;
  const modo: "criar" | "editar" = logExistente ? "editar" : "criar";

  const hojeIso = () => new Date().toISOString().slice(0, 10);

  const [data, setData] = React.useState<string>(hojeIso());
  const [horasDecimal, setHorasDecimal] = React.useState<number>(0);

  React.useEffect(() => {
    if (open) {
      if (logExistente) {
        setData(logExistente.data);
        setHorasDecimal(logExistente.segundos / 3600);
      } else {
        setData(hojeIso());
        setHorasDecimal(0);
      }
    }
  }, [open, logExistente]);

  const segundos = Math.round(horasDecimal * 3600);
  const valido = segundos > 0 && !!data;

  const handleSubmit = async () => {
    if (!valido) return;
    try {
      if (modo === "criar") {
        await inserir.mutateAsync({ demandaId, data, segundos });
      } else if (logExistente) {
        await atualizar.mutateAsync({ logId: logExistente.id, segundos });
      }
      onOpenChange(false);
    } catch {
      // toast já tratado
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {modo === "criar"
              ? "Adicionar tempo manual"
              : "Editar lançamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="data-manual">Data</Label>
            <Input
              id="data-manual"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              disabled={modo === "editar"}
            />
            {modo === "editar" && (
              <p className="text-xs text-muted-foreground">
                Para mudar a data, exclua e crie um novo lançamento.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tempo gasto</Label>
            <HoraMinutoInput
              value={horasDecimal}
              onChange={(v) => setHorasDecimal(v ?? 0)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!valido || isPending}
          >
            {isPending
              ? "Salvando..."
              : modo === "criar"
                ? "Adicionar"
                : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
