import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  HoraMinutoInput,
  formatHMFromSegundos,
} from "@/components/ui/HoraMinutoInput";
import { usePausarTimerComAjuste } from "@/hooks/useTempoManual";

interface PausarComAjusteDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string;
  segundosTotais: number;
  distribuicao: Array<{ data: string; segundos: number }>;
  onConfirmarNormal: () => void;
}

export function PausarComAjusteDialog({
  open,
  onOpenChange,
  demandaId,
  segundosTotais,
  distribuicao,
  onConfirmarNormal,
}: PausarComAjusteDialogProps) {
  const [modo, setModo] = React.useState<"confirmar" | "ajustar">("confirmar");
  const ajustar = usePausarTimerComAjuste();
  const [ajustes, setAjustes] = React.useState<
    Array<{ data: string; segundos: number }>
  >([]);

  React.useEffect(() => {
    if (open) {
      setAjustes(distribuicao);
      setModo("confirmar");
    }
  }, [open, distribuicao]);

  const totalAjustadoSegundos = ajustes.reduce((s, a) => s + a.segundos, 0);

  const formatarData = (d: string) =>
    format(new Date(d + "T00:00:00"), "EEE dd/MM/yyyy", { locale: ptBR });

  const handleSalvarAjuste = async () => {
    try {
      await ajustar.mutateAsync({
        demandaId,
        ajustes: ajustes.filter((a) => a.segundos > 0),
      });
      onOpenChange(false);
    } catch {
      // toast tratado no hook
    }
  };

  if (modo === "confirmar") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Sessão longa detectada
            </DialogTitle>
            <DialogDescription>
              Você trabalhou {formatHMFromSegundos(segundosTotais)} direto sem
              pausar.
              {distribuicao.length > 1 && (
                <>
                  {" "}
                  Esse tempo está distribuído em {distribuicao.length} dias.
                </>
              )}{" "}
              Confirma esse tempo?
            </DialogDescription>
          </DialogHeader>

          {distribuicao.length > 1 && (
            <ul className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3 text-sm">
              {distribuicao.map((d) => (
                <li key={d.data} className="flex justify-between">
                  <span>{formatarData(d.data)}</span>
                  <span className="font-mono">
                    {formatHMFromSegundos(d.segundos)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModo("ajustar")}>
              Não, ajustar
            </Button>
            <Button onClick={onConfirmarNormal}>Sim, está correto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar tempo trabalhado</DialogTitle>
          <DialogDescription>
            Edite o tempo de cada dia. Lançamentos serão registrados como
            manuais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {ajustes.map((ajuste, idx) => (
            <div
              key={ajuste.data}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-sm">{formatarData(ajuste.data)}</span>
              <div className="w-32">
                <HoraMinutoInput
                  value={ajuste.segundos / 3600}
                  onChange={(v) => {
                    const novosSegundos = Math.round((v ?? 0) * 3600);
                    setAjustes((prev) =>
                      prev.map((a, i) =>
                        i === idx ? { ...a, segundos: novosSegundos } : a,
                      ),
                    );
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Total ajustado</span>
          <span className="font-mono font-semibold">
            {formatHMFromSegundos(totalAjustadoSegundos)}
          </span>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setModo("confirmar")}
            disabled={ajustar.isPending}
          >
            Voltar
          </Button>
          <Button
            onClick={handleSalvarAjuste}
            disabled={ajustar.isPending || totalAjustadoSegundos <= 0}
          >
            {ajustar.isPending ? "Salvando..." : "Salvar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
