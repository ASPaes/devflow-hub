import { Clock } from "lucide-react";

import { formatDateSP, formatDateTimeSP } from "@/lib/format";
import type { DemandaCompleta } from "@/hooks/useDemandas";

interface ReaberturaBannerProps {
  demanda: DemandaCompleta;
  isOwner: boolean;
}

function diasRestantes(reopenDeadline: string): number {
  const ms = new Date(reopenDeadline).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function tempoRestanteLabel(reopenDeadline: string): string {
  const dias = diasRestantes(reopenDeadline);
  const dataFmt = formatDateSP(reopenDeadline);
  if (dias < 0) return `prazo expirou em ${dataFmt}`;
  if (dias === 0) return `expira hoje (${dataFmt})`;
  if (dias === 1) return `amanhã é o último dia (${dataFmt})`;
  return `até ${dataFmt} (${dias} dias restantes)`;
}

export function ReaberturaBanner({ demanda, isOwner }: ReaberturaBannerProps) {
  if (demanda.status !== "entregue" && demanda.status !== "encerrada") {
    return null;
  }

  const entreguEmFmt = demanda.delivered_at
    ? formatDateTimeSP(demanda.delivered_at)
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-status-teste/30 bg-status-teste/10 p-4 sm:flex-row sm:items-center">
      <Clock className="h-5 w-5 shrink-0 text-status-teste" />
      <div className="flex-1 text-sm">
        {entreguEmFmt && (
          <p className="font-medium text-foreground">
            Demanda entregue em {entreguEmFmt}
          </p>
        )}
        {demanda.reopen_deadline && (
          <p className="mt-0.5 text-muted-foreground">
            {isOwner
              ? `Se o problema persistir, você pode reabrir ${tempoRestanteLabel(demanda.reopen_deadline)}.`
              : `Janela de reabertura aberta para o solicitante ${tempoRestanteLabel(demanda.reopen_deadline)}.`}
          </p>
        )}
      </div>
    </div>
  );
}
