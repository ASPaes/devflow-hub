import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExcluirDemanda } from "@/hooks/useExcluirDemanda";

interface ExcluirDemandaDialogProps {
  demandaId: string;
  demandaCodigo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExcluirDemandaDialog({
  demandaId,
  demandaCodigo,
  open,
  onOpenChange,
}: ExcluirDemandaDialogProps) {
  const [motivo, setMotivo] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const excluir = useExcluirDemanda();
  const navigate = useNavigate();

  const motivoTrim = motivo.trim();
  const motivoEmpty = motivoTrim.length === 0;
  const motivoTooShort = !motivoEmpty && motivoTrim.length < 5;
  const motivoInvalido = motivoEmpty || motivoTooShort;

  React.useEffect(() => {
    if (!open) {
      setMotivo("");
      setTouched(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    setTouched(true);
    if (motivoInvalido) return;
    try {
      await excluir.mutateAsync({ demandaId, motivo: motivoTrim });
      onOpenChange(false);
      navigate({ to: "/demandas" });
    } catch {
      // erro já mostrado via toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir demanda {demandaCodigo}
          </DialogTitle>
          <DialogDescription>
            A demanda será marcada como excluída e não aparecerá nas listagens.
            O registro fica preservado para auditoria. Apenas Administradores e
            Desenvolvedores poderão consultá-la.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-exclusao">Motivo da exclusão *</Label>
          <Textarea
            id="motivo-exclusao"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Por que essa demanda está sendo excluída?"
            rows={3}
            autoFocus
          />
          {touched && motivoEmpty && (
            <p className="text-xs text-destructive">Motivo é obrigatório.</p>
          )}
          {touched && motivoTooShort && (
            <p className="text-xs text-destructive">
              Motivo deve ter pelo menos 5 caracteres.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={excluir.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={motivoInvalido || excluir.isPending}
          >
            {excluir.isPending ? "Excluindo..." : "Excluir demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
