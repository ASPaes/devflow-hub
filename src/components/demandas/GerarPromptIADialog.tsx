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
import { Sparkles, Copy, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useGerarPromptIA } from "@/hooks/useGerarPromptIA";

interface GerarPromptIADialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string;
  demandaCodigo: string;
}

export function GerarPromptIADialog({
  open,
  onOpenChange,
  demandaId,
  demandaCodigo,
}: GerarPromptIADialogProps) {
  const gerar = useGerarPromptIA();
  const [prompt, setPrompt] = React.useState("");
  const [usage, setUsage] = React.useState<{ input: number; output: number } | null>(null);
  const [copiado, setCopiado] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPrompt("");
      setUsage(null);
      setCopiado(false);
    }
  }, [open]);

  const handleGerar = async () => {
    try {
      const res = await gerar.mutateAsync({ demandaId });
      setPrompt(res.prompt);
      setUsage({ input: res.usage.input_tokens, output: res.usage.output_tokens });
    } catch {
      // toast via hook
    }
  };

  const handleCopiar = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      toast.success("Prompt copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Gerar prompt com IA — {demandaCodigo}
          </DialogTitle>
          <DialogDescription>
            A IA gera um prompt formatado com o contexto desta demanda
            (descrição, comentários, anexos) pra você colar no Claude Code,
            Cursor ou outra ferramenta de codificação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col min-h-[340px]">
          {!prompt && !gerar.isPending && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-8">
              <Sparkles className="h-10 w-10 text-purple-500" />
              <p className="text-sm text-muted-foreground max-w-md">
                Clique em "Gerar com IA" pra criar um prompt baseado em todos
                os dados da demanda.
              </p>
              <Button onClick={handleGerar} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Gerar com IA
              </Button>
              <p className="text-xs text-muted-foreground">
                Custo aproximado: R$ 0,03 por geração
              </p>
            </div>
          )}

          {gerar.isPending && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Gerando prompt...</p>
            </div>
          )}

          {prompt && !gerar.isPending && (
            <div className="flex flex-col flex-1 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Prompt gerado. Você pode editar antes de copiar.
                </span>
                {usage && (
                  <span className="text-xs text-muted-foreground">
                    {usage.input + usage.output} tokens
                  </span>
                )}
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 min-h-[300px] font-mono text-xs resize-none"
                placeholder="Prompt aparecerá aqui após geração..."
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {prompt && !gerar.isPending && (
            <>
              <Button
                variant="outline"
                onClick={handleGerar}
                disabled={gerar.isPending}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Gerar novamente
              </Button>
              <Button onClick={handleCopiar}>
                {copiado ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar prompt
                  </>
                )}
              </Button>
            </>
          )}
          <Button
            variant={prompt ? "ghost" : "outline"}
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
