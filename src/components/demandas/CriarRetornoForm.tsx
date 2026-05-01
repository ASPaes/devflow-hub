import * as React from "react";
import { Image as ImageIcon, Video, Mic, Square, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCriarRetorno } from "@/hooks/useRetornosDemanda";
import { useGravadorAudio, audioBlobParaFile } from "@/hooks/useGravadorAudio";
import { cn } from "@/lib/utils";
import type { TipoMidiaRetorno } from "@/types/retorno";

const MAX_BYTES = 50 * 1024 * 1024;

export function CriarRetornoForm({ demandaId }: { demandaId: string }) {
  const criar = useCriarRetorno();
  const gravador = useGravadorAudio();
  const [texto, setTexto] = React.useState("");
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [tipoArquivo, setTipoArquivo] = React.useState<TipoMidiaRetorno | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputImagemRef = React.useRef<HTMLInputElement>(null);
  const inputVideoRef = React.useRef<HTMLInputElement>(null);

  const limparMidia = React.useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setArquivo(null);
    setTipoArquivo(null);
  }, [previewUrl]);

  const limparTudo = React.useCallback(() => {
    setTexto("");
    limparMidia();
    gravador.cancelar();
  }, [limparMidia, gravador]);

  // Quando termina de gravar, transforma em File
  React.useEffect(() => {
    if (gravador.audioBlob && gravador.status === "parado") {
      const file = audioBlobParaFile(gravador.audioBlob);
      setArquivo(file);
      setTipoArquivo("audio");
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(gravador.audioBlob!);
      });
    }
  }, [gravador.audioBlob, gravador.status]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelecionarArquivo = (
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: TipoMidiaRetorno,
  ) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_BYTES) {
      alert("Arquivo maior que 50MB. Por favor reduza o tamanho.");
      e.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArquivo(f);
    setTipoArquivo(tipo);
    setPreviewUrl(URL.createObjectURL(f));
    e.target.value = "";
  };

  const handleEnviar = async () => {
    const temTexto = texto.trim().length > 0;
    if (!temTexto && !arquivo) {
      alert("Informe um texto ou anexe uma mídia");
      return;
    }
    try {
      await criar.mutateAsync({
        demandaId,
        texto: temTexto ? texto : undefined,
        arquivo: arquivo ?? undefined,
        tipo: tipoArquivo ?? undefined,
      });
      limparTudo();
    } catch {
      // toast já mostrado
    }
  };

  const podeEnviar =
    (texto.trim().length > 0 || !!arquivo) && !criar.isPending;
  const isGravando = gravador.status === "gravando";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Publicar retorno
      </h3>

      {/* Preview de mídia */}
      {previewUrl && tipoArquivo && (
        <div className="relative rounded-md border border-border bg-muted/20 p-2">
          {tipoArquivo === "imagem" && (
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-64 w-full rounded object-contain"
            />
          )}
          {tipoArquivo === "video" && (
            <video
              src={previewUrl}
              controls
              className="max-h-64 w-full rounded"
            />
          )}
          {tipoArquivo === "audio" && (
            <audio src={previewUrl} controls className="w-full" />
          )}
          <button
            type="button"
            onClick={limparMidia}
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-destructive"
            title="Remover mídia"
            aria-label="Remover mídia"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {arquivo && (
            <div className="mt-2 text-xs text-muted-foreground">
              {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>
      )}

      {/* Status de gravação ao vivo */}
      {isGravando && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
          <span className="font-mono">
            {String(Math.floor(gravador.duracaoSegundos / 60)).padStart(2, "0")}
            :{String(gravador.duracaoSegundos % 60).padStart(2, "0")}
          </span>
          <span className="text-muted-foreground">Gravando áudio...</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="default" onClick={() => gravador.parar()}>
              <Square className="mr-1 h-3 w-3" />
              Parar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => gravador.cancelar()}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Erro de gravador */}
      {gravador.error && (
        <p className="text-xs text-destructive">{gravador.error}</p>
      )}

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Descreva o que está sendo entregue ou explique a mídia..."
        rows={3}
        className="resize-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputImagemRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleSelecionarArquivo(e, "imagem")}
        />
        <input
          ref={inputVideoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleSelecionarArquivo(e, "video")}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => inputImagemRef.current?.click()}
          disabled={isGravando || criar.isPending}
        >
          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          Imagem
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputVideoRef.current?.click()}
          disabled={isGravando || criar.isPending}
        >
          <Video className="mr-1.5 h-3.5 w-3.5" />
          Vídeo
        </Button>
        {!isGravando && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => gravador.iniciar()}
            disabled={criar.isPending}
            className={cn(
              arquivo && tipoArquivo === "audio" && "opacity-60",
            )}
          >
            <Mic className="mr-1.5 h-3.5 w-3.5" />
            Gravar áudio
          </Button>
        )}

        <div className="flex-1" />

        <Button onClick={handleEnviar} disabled={!podeEnviar} size="sm">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {criar.isPending ? "Enviando..." : "Publicar"}
        </Button>
      </div>
    </div>
  );
}
