import * as React from "react";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gerarSignedUrl } from "@/hooks/useRetornosDemanda";
import type { TipoMidiaRetorno } from "@/types/retorno";

interface Props {
  path: string;
  tipo: TipoMidiaRetorno;
  nome: string | null;
}

export function RetornoMidiaPlayer({ path, tipo, nome }: Props) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gerarSignedUrl(path).then((u) => {
      if (!cancelled) {
        setUrl(u);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-border bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        Erro ao carregar mídia
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tipo === "imagem" && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-border bg-muted/20"
        >
          <img
            src={url}
            alt={nome ?? "Mídia do retorno"}
            className="max-h-[480px] w-full object-contain"
            loading="lazy"
          />
        </a>
      )}

      {tipo === "video" && (
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-[480px] w-full rounded-md border border-border bg-black"
        />
      )}

      {tipo === "audio" && (
        <audio src={url} controls preload="metadata" className="w-full" />
      )}

      {nome && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{nome}</span>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <a href={url} download={nome} target="_blank" rel="noopener noreferrer">
              <Download className="mr-1 h-3 w-3" />
              Baixar
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
