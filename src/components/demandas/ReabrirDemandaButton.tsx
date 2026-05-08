import * as React from "react";
import { Undo2 } from "lucide-react";
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
import { useReabrirDemanda, type DemandaCompleta } from "@/hooks/useDemandas";
import { useProfile } from "@/hooks/useProfile";

interface Props {
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

export function ReabrirDemandaButton({ demanda, isOwner }: Props) {
  const [open, setOpen] = React.useState(false);
  const reabrirMut = useReabrirDemanda();
  const { temPermissao } = useProfile();
  const podeEditarQualquer = temPermissao("editar_qualquer_demanda");

  if (demanda.status !== "entregue" && demanda.status !== "encerrada") {
    return null;
  }

  const dentroDoPrazo =
    demanda.reopen_deadline !== null &&
    diasRestantes(demanda.reopen_deadline) >= 0;
  const podeReabrir = podeEditarQualquer || (isOwner && dentroDoPrazo);

  if (!podeReabrir) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Reabrir
      </Button>

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
