import * as React from "react";
import { CheckSquare, Pin, Plus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useCriarRascunho } from "@/hooks/useRascunhos";
import {
  COR_RASCUNHO_LABEL,
  COR_RASCUNHO_SWATCH,
  type CorRascunho,
  type TipoRascunho,
} from "@/types/rascunho";
import { cn } from "@/lib/utils";

const CORES: CorRascunho[] = ["cinza", "verde", "azul", "amarelo", "vermelho"];

export function CriarRascunhoForm() {
  const [aberto, setAberto] = React.useState(false);
  const [tipo, setTipo] = React.useState<TipoRascunho>("texto");
  const [titulo, setTitulo] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [cor, setCor] = React.useState<CorRascunho>("cinza");
  const [itens, setItens] = React.useState<string[]>([""]);
  const criar = useCriarRascunho();

  const reset = () => {
    setTipo("texto");
    setTitulo("");
    setTexto("");
    setCor("cinza");
    setItens([""]);
    setAberto(false);
  };

  const handleSubmit = async () => {
    const itensValidos = itens.filter((t) => t.trim().length > 0);
    const temConteudo =
      tipo === "texto"
        ? texto.trim().length > 0 || titulo.trim().length > 0
        : itensValidos.length > 0 || titulo.trim().length > 0;
    if (!temConteudo) return;

    await criar.mutateAsync({
      titulo,
      tipo,
      cor,
      conteudo_texto: tipo === "texto" ? texto : null,
      itens:
        tipo === "checklist"
          ? itensValidos.map((t) => ({ texto: t }))
          : undefined,
    });
    reset();
  };

  if (!aberto) {
    return (
      <Card
        onClick={() => setAberto(true)}
        className="cursor-text p-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
      >
        Criar um rascunho…
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-3">
      <Input
        placeholder="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        className="border-0 px-0 text-base font-medium shadow-none focus-visible:ring-0"
      />

      {tipo === "texto" ? (
        <Textarea
          placeholder="Anote alguma coisa…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          className="resize-none border-0 px-0 shadow-none focus-visible:ring-0"
          autoFocus
        />
      ) : (
        <div className="space-y-1.5">
          {itens.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <Input
                value={it}
                onChange={(e) => {
                  const next = [...itens];
                  next[idx] = e.target.value;
                  setItens(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setItens([...itens, ""]);
                  }
                }}
                placeholder="Item"
                className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setItens([...itens, ""])}
            className="h-7 text-xs text-muted-foreground"
          >
            <Plus className="mr-1 h-3 w-3" /> Adicionar item
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant={tipo === "texto" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTipo("texto")}
          className="h-8"
        >
          <Type className="mr-1 h-3.5 w-3.5" /> Texto
        </Button>
        <Button
          type="button"
          variant={tipo === "checklist" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTipo("checklist")}
          className="h-8"
        >
          <CheckSquare className="mr-1 h-3.5 w-3.5" /> Checklist
        </Button>

        <div className="ml-2 flex items-center gap-1">
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCor(c)}
              title={COR_RASCUNHO_LABEL[c]}
              className={cn(
                "h-5 w-5 rounded-full border transition-all",
                COR_RASCUNHO_SWATCH[c],
                cor === c
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "border-border",
              )}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reset}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={criar.isPending}
          >
            {criar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
      {/* Pin não usado aqui (default unpinned), import para evitar tree-shake hint */}
      <Pin className="hidden" />
    </Card>
  );
}
