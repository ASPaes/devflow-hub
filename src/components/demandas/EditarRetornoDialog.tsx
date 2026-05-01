import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAtualizarTextoRetorno } from "@/hooks/useRetornosDemanda";
import type { DemandaRetornoComAutor } from "@/types/retorno";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  retorno: DemandaRetornoComAutor;
}

export function EditarRetornoDialog({ open, onOpenChange, retorno }: Props) {
  const [texto, setTexto] = React.useState(retorno.texto ?? "");
  const atualizar = useAtualizarTextoRetorno();

  React.useEffect(() => {
    if (open) setTexto(retorno.texto ?? "");
  }, [open, retorno.texto]);

  const handleSalvar = async () => {
    try {
      await atualizar.mutateAsync({
        retornoId: retorno.id,
        demandaId: retorno.demanda_id,
        texto,
      });
      onOpenChange(false);
    } catch {
      /* toast já mostrado */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar retorno</DialogTitle>
          <DialogDescription>
            Você pode editar apenas o texto. Para trocar a mídia, exclua e crie
            um novo.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          autoFocus
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={atualizar.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={atualizar.isPending}>
            {atualizar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
