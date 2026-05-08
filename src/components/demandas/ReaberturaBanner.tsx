import * as React from "react";
import { Clock } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ModalForm } from "@/components/common/ModalForm";
import { formatDateSP, formatDateTimeSP } from "@/lib/format";
import { useReabrirDemanda, type DemandaCompleta } from "@/hooks/useDemandas";
import { useProfile } from "@/hooks/useProfile";

interface ReaberturaBannerProps {
  demanda: DemandaCompleta;
  isOwner: boolean;
}

const reabrirSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(10, "Descreva o motivo com mais detalhes")
    .max(500, "Máximo 500 caracteres"),
});

type ReabrirInput = z.infer<typeof reabrirSchema>;

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
  const [open, setOpen] = React.useState(false);
  const reabrirMut = useReabrirDemanda();

  if (demanda.status !== "entregue") return null;

  const entreguEmFmt = demanda.delivered_at
    ? formatDateTimeSP(demanda.delivered_at)
    : null;
  const podeReabrir =
    isOwner &&
    demanda.reopen_deadline !== null &&
    diasRestantes(demanda.reopen_deadline) >= 0;

  return (
    <>
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
        {podeReabrir && (
          <Button
            variant="outline"
            className="w-full border-status-teste/40 text-status-teste hover:bg-status-teste/15 hover:text-status-teste sm:w-auto"
            onClick={() => setOpen(true)}
          >
            Reabrir
          </Button>
        )}
      </div>

      <ModalForm<ReabrirInput>
        open={open}
        onOpenChange={setOpen}
        title="Reabrir demanda"
        description="O motivo será registrado como comentário e no histórico."
        schema={reabrirSchema}
        defaultValues={{ motivo: "" }}
        submitLabel="Reabrir demanda"
        onSubmit={async (values) => {
          await reabrirMut.mutateAsync({
            demandaId: demanda.id,
            motivo: values.motivo.trim(),
          });
        }}
      >
        {(form) => (
          <FormField
            control={form.control}
            name="motivo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Por que precisa reabrir?</FormLabel>
                <FormControl>
                  <Textarea
                    rows={5}
                    maxLength={500}
                    placeholder="Ex: o problema voltou a acontecer ao navegar entre filtros..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </ModalForm>
    </>
  );
}
