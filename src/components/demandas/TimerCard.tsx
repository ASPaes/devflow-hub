import * as React from "react";
import { Clock, History, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { formatDataLogPT, formatDuracao } from "@/lib/format";
import {
  useIniciarTimer,
  usePausarTimer,
  useTimerLog,
} from "@/hooks/useTimerDemanda";
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
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Histórico por dia
            </div>
            {log.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Nenhum registro ainda
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {log.map((row) => (
                  <li
                    key={row.data}
                    className="flex items-center justify-between px-3 py-1.5 text-sm"
                  >
                    <span className="text-foreground">
                      {formatDataLogPT(row.data)}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {formatDuracao(row.segundos)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Cards lado a lado */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-background/40 p-2.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Realizado
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-foreground">
            {formatDuracao(realizado)}
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
            {formatDuracao(segundosEmAndamento)}
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
