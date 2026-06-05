import * as React from "react";
import { createPortal } from "react-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2,
  Maximize2,
  MessageSquare,
  Paperclip,
  User,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRetornosReleasePublica } from "@/hooks/useReleases";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string | null;
  demandaCodigo: string | null;
  releaseTitulo: string | null;
}


export function ReleaseDetalhesSheet({
  open,
  onOpenChange,
  demandaId,
  demandaCodigo,
  releaseTitulo,
}: Props) {
  const { data: retornos = [], isLoading } = useRetornosReleasePublica(demandaId);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const imagemConteudoRef = React.useRef<HTMLDivElement | null>(null);

  const [imagemExpandida, setImagemExpandida] = React.useState<{
    url: string;
    alt: string;
  } | null>(null);

  React.useEffect(() => {
    if (imagemExpandida) {
      overlayRef.current?.focus();
    }
  }, [imagemExpandida]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-lg"
        onInteractOutside={(event) => {
          if (!imagemExpandida) return;

          const alvo = event.target as Node | null;

          if (alvo && imagemConteudoRef.current?.contains(alvo)) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          setImagemExpandida(null);
        }}
        onEscapeKeyDown={(event) => {
          if (!imagemExpandida) return;

          event.preventDefault();
          setImagemExpandida(null);
        }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {releaseTitulo ?? "Detalhes"}
          </SheetTitle>
          <SheetDescription>
            Histórico de retornos da demanda {demandaCodigo}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && retornos.length === 0 && (
            <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Esta demanda não tem retornos registrados.
            </div>
          )}

          {!isLoading &&
            retornos.map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">
                    {r.autor_nome ?? "Desconhecido"}
                  </span>
                  <span>•</span>
                  <span>
                    {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {r.texto && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {r.texto}
                  </p>
                )}

                {r.midia_url && r.midia_tipo === "imagem" && (
                  <div className="group relative mt-3 cursor-pointer">
                    <img
                      src={r.midia_url}
                      alt={r.midia_nome_original ?? "Imagem"}
                      className="max-w-full rounded-md border border-border"
                      onClick={() =>
                        setImagemExpandida({
                          url: r.midia_url!,
                          alt: r.midia_nome_original ?? "Imagem",
                        })
                      }
                    />
                    <button
                      onClick={() =>
                        setImagemExpandida({
                          url: r.midia_url!,
                          alt: r.midia_nome_original ?? "Imagem",
                        })
                      }
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Expandir imagem"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {r.midia_url && r.midia_tipo === "audio" && (
                  <div className="mt-3">
                    <audio controls className="w-full">
                      <source src={r.midia_url} />
                      Seu navegador não suporta áudio.
                    </audio>
                  </div>
                )}

                {r.midia_url && r.midia_tipo === "video" && (
                  <div className="mt-3">
                    <video
                      controls
                      className="max-w-full rounded-md border border-border"
                      preload="metadata"
                    >
                      <source src={r.midia_url} />
                      Seu navegador não suporta vídeo.
                    </video>
                  </div>
                )}

                {r.midia_url && !["imagem", "audio", "video"].includes(r.midia_tipo ?? "") && (
                  <a
                    href={r.midia_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground"
                  >
                    <Paperclip className="h-3 w-3" />
                    {r.midia_nome_original ?? "Anexo"}
                  </a>
                )}
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>

    {imagemExpandida && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            ref={overlayRef}
            onClick={() => setImagemExpandida(null)}
            onKeyDown={(e) => e.key === "Escape" && setImagemExpandida(null)}
            tabIndex={-1}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 outline-none"
          >
            <div
              ref={imagemConteudoRef}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImagemExpandida(null);
                }}
                aria-label="Fechar"
                className="absolute top-4 right-4 rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={imagemExpandida.url}
                alt={imagemExpandida.alt}
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-md"
              />
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
