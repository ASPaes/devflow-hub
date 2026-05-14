import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useMarcarIncluirRelease, useGerarResumoReleaseIA } from "@/hooks/useReleases";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demanda: { id: string; codigo: string; titulo: string; tipo: string } | null;
  onConcluido?: (args: { tituloIA: string; resumoIA: string }) => void;
}

export function IncluirReleaseDialog({
  open,
  onOpenChange,
  demanda,
  onConcluido,
}: Props) {
  const marcar = useMarcarIncluirRelease();
  const gerarIA = useGerarResumoReleaseIA();

  if (!demanda) return null;
  const loading = marcar.isPending || gerarIA.isPending;

  const handleIncluir = async () => {
    try {
      await marcar.mutateAsync({ demandaId: demanda.id, incluir: true });
      const ia = await gerarIA.mutateAsync({ demandaId: demanda.id });
      onOpenChange(false);
      onConcluido?.({ tituloIA: ia.titulo, resumoIA: ia.resumo });
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
          Vamos gerar um resumo com IA e abrir a aba Releases pra você revisar e publicar.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Agora não
          </Button>
          <Button onClick={handleIncluir} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-3.5 w-3.5" />
            )}
            {gerarIA.isPending ? "Gerando resumo..." : "Incluir e gerar resumo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
