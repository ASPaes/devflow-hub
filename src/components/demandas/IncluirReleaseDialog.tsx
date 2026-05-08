import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useMarcarIncluirRelease } from "@/hooks/useReleases";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demanda: { id: string; codigo: string; titulo: string; tipo: string } | null;
  onIncluir?: () => void;
}

export function IncluirReleaseDialog({
  open,
  onOpenChange,
  demanda,
  onIncluir,
}: Props) {
  const marcar = useMarcarIncluirRelease();

  if (!demanda) return null;

  const handleIncluir = async () => {
    console.log("[IncluirRelease] CHAMANDO RPC", demanda.id);
    try {
      await marcar.mutateAsync({ demandaId: demanda.id, incluir: true });
      console.log("[IncluirRelease] SUCESSO");
      onOpenChange(false);
      onIncluir?.();
    } catch (err) {
      console.error("[IncluirRelease] ERRO:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Incluir nas Releases?
          </DialogTitle>
          <DialogDescription>
            A demanda {demanda.codigo} foi marcada como Entregue. Deseja
            adicioná-la no feed de Releases que seus clientes acompanham?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium text-foreground">{demanda.titulo}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Você poderá editar título, tipo e resumo antes de publicar. Nenhuma
          informação aparece pro cliente até você clicar em &quot;Publicar&quot;.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button onClick={handleIncluir} disabled={marcar.isPending}>
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Incluir nas Releases
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
