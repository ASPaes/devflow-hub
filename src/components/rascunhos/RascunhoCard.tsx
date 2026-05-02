import * as React from "react";
import {
  Copy,
  Maximize2,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAdicionarItem,
  useAtualizarItem,
  useAtualizarRascunho,
  useDuplicarRascunho,
  useExcluirItem,
  useExcluirRascunho,
  useToggleItem,
} from "@/hooks/useRascunhos";
import { useAuth } from "@/hooks/useAuth";
import {
  COR_RASCUNHO_CLASSES,
  COR_RASCUNHO_LABEL,
  COR_RASCUNHO_SWATCH,
  type CorRascunho,
  type RascunhoComItens,
} from "@/types/rascunho";
import { cn } from "@/lib/utils";
import { formatRelativeSP } from "@/lib/format";

const CORES: CorRascunho[] = ["cinza", "verde", "azul", "amarelo", "vermelho"];

export function RascunhoCard({ rascunho }: { rascunho: RascunhoComItens }) {
  const [expandido, setExpandido] = React.useState(false);

  return (
    <>
      <CardConteudo
        rascunho={rascunho}
        expandido={false}
        onExpandir={() => setExpandido(true)}
      />
      <Dialog open={expandido} onOpenChange={setExpandido}>
        <DialogContent
          className={cn(
            "max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl",
            COR_RASCUNHO_CLASSES[rascunho.cor],
          )}
        >
          <DialogTitle className="sr-only">
            {rascunho.titulo || "Rascunho"}
          </DialogTitle>
          <div className="p-5">
            <CardConteudo rascunho={rascunho} expandido={true} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CardConteudo({
  rascunho,
  expandido,
  onExpandir,
}: {
  rascunho: RascunhoComItens;
  expandido: boolean;
  onExpandir?: () => void;
}) {
  const { user } = useAuth();
  const ehDono = user?.id === rascunho.autor_id;
  const atualizar = useAtualizarRascunho();
  const excluir = useExcluirRascunho();
  const duplicar = useDuplicarRascunho();
  const toggleItem = useToggleItem();
  const addItem = useAdicionarItem();
  const updItem = useAtualizarItem();
  const delItem = useExcluirItem();

  const [titulo, setTitulo] = React.useState(rascunho.titulo ?? "");
  const [texto, setTexto] = React.useState(rascunho.conteudo_texto ?? "");
  const [novoItem, setNovoItem] = React.useState("");

  React.useEffect(() => setTitulo(rascunho.titulo ?? ""), [rascunho.titulo]);
  React.useEffect(
    () => setTexto(rascunho.conteudo_texto ?? ""),
    [rascunho.conteudo_texto],
  );

  const salvarTitulo = () => {
    if ((rascunho.titulo ?? "") !== titulo)
      atualizar.mutate({ id: rascunho.id, patch: { titulo: titulo || null } });
  };
  const salvarTexto = () => {
    if ((rascunho.conteudo_texto ?? "") !== texto)
      atualizar.mutate({
        id: rascunho.id,
        patch: { conteudo_texto: texto || null },
      });
  };

  const Wrapper: React.ElementType = expandido ? "div" : Card;
  const wrapperProps = expandido
    ? { className: "flex flex-col gap-2" }
    : {
        className: cn(
          "flex h-64 flex-col gap-2 p-3 transition-shadow hover:shadow-md",
          COR_RASCUNHO_CLASSES[rascunho.cor],
        ),
      };

  return (
    <Wrapper {...wrapperProps}>
      <div className="flex items-start gap-1">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={salvarTitulo}
          placeholder="Título"
          disabled={!ehDono}
          className="h-7 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
        />
        {!expandido && onExpandir && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onExpandir}
            title="Expandir"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
        {ehDono && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() =>
              atualizar.mutate({
                id: rascunho.id,
                patch: { fixada: !rascunho.fixada },
              })
            }
            title={rascunho.fixada ? "Desafixar" : "Fixar"}
          >
            {rascunho.fixada ? (
              <PinOff className="h-3.5 w-3.5" />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {rascunho.tipo === "texto" ? (
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvarTexto}
          placeholder="Sem conteúdo"
          rows={expandido ? 16 : 5}
          disabled={!ehDono}
          className={cn(
            "resize-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0",
            expandido ? "min-h-[300px]" : "flex-1 overflow-hidden",
          )}
        />
      ) : (
        <div
          className={cn(
            "space-y-1",
            expandido ? "" : "flex-1 overflow-hidden",
          )}
        >
          {rascunho.itens.map((it) => (
            <div key={it.id} className="group flex items-center gap-2">
              <Checkbox
                checked={it.marcado}
                disabled={!ehDono}
                onCheckedChange={(v) =>
                  toggleItem.mutate({ itemId: it.id, marcado: !!v })
                }
              />
              <Input
                defaultValue={it.texto}
                disabled={!ehDono}
                onBlur={(e) => {
                  if (e.target.value.trim() !== it.texto)
                    updItem.mutate({ itemId: it.id, texto: e.target.value });
                }}
                className={cn(
                  "h-6 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0",
                  it.marcado && "line-through text-muted-foreground",
                )}
              />
              {ehDono && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={() => delItem.mutate({ itemId: it.id })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {ehDono && (
            <div className="flex items-center gap-2 pt-1">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novoItem.trim()) {
                    addItem.mutate({
                      rascunhoId: rascunho.id,
                      texto: novoItem,
                      ordem: rascunho.itens.length,
                    });
                    setNovoItem("");
                  }
                }}
                placeholder="Item"
                className="h-6 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-1 border-t border-border/50 pt-2">
        <span className="truncate text-[10px] text-muted-foreground">
          {ehDono ? "" : `${rascunho.autor_nome ?? "—"} · `}
          {formatRelativeSP(rascunho.updated_at)}
          {rascunho.compartilhada && " · compartilhado"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ehDono && (
              <>
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Cor
                </div>
                <div className="flex items-center gap-1 px-2 pb-1.5">
                  {CORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        atualizar.mutate({
                          id: rascunho.id,
                          patch: { cor: c },
                        })
                      }
                      title={COR_RASCUNHO_LABEL[c]}
                      className={cn(
                        "h-5 w-5 rounded-full border",
                        COR_RASCUNHO_SWATCH[c],
                        rascunho.cor === c
                          ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                          : "border-border",
                      )}
                    />
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    atualizar.mutate({
                      id: rascunho.id,
                      patch: { compartilhada: !rascunho.compartilhada },
                    })
                  }
                >
                  <Share2 className="mr-2 h-3.5 w-3.5" />
                  {rascunho.compartilhada
                    ? "Tornar privado"
                    : "Compartilhar com time"}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onSelect={() => duplicar.mutate({ id: rascunho.id })}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Duplicar
            </DropdownMenuItem>
            {ehDono && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    if (confirm("Excluir este rascunho?"))
                      excluir.mutate({ id: rascunho.id });
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Wrapper>
  );
}
