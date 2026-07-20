import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, AlertTriangle } from "lucide-react";
import { useAcionarAgente } from "@/hooks/useAgente";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string;
  demandaCodigo: string;
}

export function AcionarAgenteDialog({ open, onOpenChange, demandaId, demandaCodigo }: Props) {
  const acionar = useAcionarAgente();

  const handleAcionar = async () => {
    try {
      await acionar.mutateAsync({ demandaId });
      onOpenChange(false);
    } catch {
      // toast via hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-500" />
            Acionar agente — {demandaCodigo}
          </DialogTitle>
          <DialogDescription>
            O agente vai ler o contexto da demanda (descrição, comentários e os prints anexados),
            corrigir o problema no repositório do produto e, se o produto estiver com deploy
            automático ligado, publicar a correção. Ao final, grava a devolutiva como Retorno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Isso altera o código do produto. Com deploy automático ativo, a mudança pode ir a
            produção sozinha (só com CI verde). Sem ele, o agente apenas abre um PR para revisão.
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAcionar} disabled={acionar.isPending}>
            {acionar.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Acionando...
              </>
            ) : (
              <>
                <Bot className="mr-1.5 h-3.5 w-3.5" />
                Acionar agente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
