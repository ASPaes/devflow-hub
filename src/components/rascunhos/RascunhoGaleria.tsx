import * as React from "react";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  gerarSignedUrlRascunhoImagem,
  useExcluirImagemRascunho,
  useRascunhoImagens,
  useUploadImagemRascunho,
} from "@/hooks/useRascunhoImagens";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RascunhoImagem } from "@/types/rascunho";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGENS = 10;

export function RascunhoGaleria({
  rascunhoId,
  ehDono,
  expandido,
}: {
  rascunhoId: string;
  ehDono: boolean;
  expandido: boolean;
}) {
  const { data: imagens = [] } = useRascunhoImagens(rascunhoId);
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  if (imagens.length === 0 && (!ehDono || !expandido)) return null;

  const visiveis = expandido ? imagens : imagens.slice(0, 6);
  const restante = imagens.length - visiveis.length;
  const cols =
    imagens.length === 1
      ? "grid-cols-1"
      : imagens.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className="space-y-2">
      {imagens.length > 0 && (
        <div className={cn("grid gap-1", cols)}>
          {visiveis.map((img) => (
            <Thumb
              key={img.id}
              imagem={img}
              ehDono={ehDono}
              onAbrir={(u) => setLightbox(u)}
            />
          ))}
          {!expandido && restante > 0 && (
            <div className="flex aspect-square items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground">
              +{restante}
            </div>
          )}
        </div>
      )}

      {ehDono && expandido && imagens.length < MAX_IMAGENS && (
        <UploadBotao rascunhoId={rascunhoId} />
      )}

      {lightbox && (
        <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

function Thumb({
  imagem,
  ehDono,
  onAbrir,
}: {
  imagem: RascunhoImagem;
  ehDono: boolean;
  onAbrir: (url: string) => void;
}) {
  const [url, setUrl] = React.useState<string | null>(null);
  const excluir = useExcluirImagemRascunho();

  React.useEffect(() => {
    let cancelled = false;
    gerarSignedUrlRascunhoImagem(imagem.storage_path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [imagem.storage_path]);

  if (!url) {
    return (
      <div className="flex aspect-square animate-pulse items-center justify-center rounded bg-muted">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded">
      <img
        src={url}
        alt={imagem.nome_original ?? ""}
        className="h-full w-full cursor-zoom-in object-cover"
        onClick={() => onAbrir(url)}
      />
      {ehDono && (
        <button
          type="button"
          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Excluir esta imagem?")) {
              excluir.mutate({
                imagemId: imagem.id,
                rascunhoId: imagem.rascunho_id,
              });
            }
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function UploadBotao({ rascunhoId }: { rascunhoId: string }) {
  const upload = useUploadImagemRascunho();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("Imagem maior que 10MB");
      e.target.value = "";
      return;
    }
    upload.mutate({ rascunhoId, arquivo: f });
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImageIcon className="mr-1 h-3.5 w-3.5" />
        )}
        {upload.isPending ? "Enviando…" : "Adicionar imagem"}
      </Button>
    </>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <img
        src={url}
        alt=""
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
