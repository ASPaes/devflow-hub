import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  ExternalLink,
  Eye,
  Film,
  FileText,
  ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import { formatRelativeSP } from "@/lib/format";
import { getAnexoUrl } from "@/lib/storage";
import { useDeleteAnexo, type DemandaAnexo } from "@/hooks/useDemandas";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface AnexoCardProps {
  anexo: DemandaAnexo;
  podeRemover?: boolean;
}

export function AnexoCard({ anexo, podeRemover = false }: AnexoCardProps) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["anexo-url", anexo.id],
    queryFn: () => getAnexoUrl(anexo.storage_path),
    staleTime: 50 * 60_000,
  });

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const deleteMut = useDeleteAnexo();

  const isImage = anexo.mime_type.startsWith("image/");
  const isVideo = anexo.mime_type.startsWith("video/");
  const isPdf = anexo.mime_type === "application/pdf";

  const Icon = isVideo ? Film : isPdf ? FileText : ImageIcon;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const downloadUrl = url ?? (await getAnexoUrl(anexo.storage_path));
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = anexo.nome_arquivo;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // silently ignore — toast elsewhere already handles signed-url errors
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (url) setPreviewOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={url ? 0 : -1}
        onClick={handlePreview}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (url) setPreviewOpen(true);
          }
        }}
        aria-label={`Visualizar ${anexo.nome_arquivo}`}
        className={cn(
          "cursor-pointer",
          "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50",
          !url && "pointer-events-none opacity-60",
        )}
      >
        {/* Hover actions */}
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7 shadow-sm"
            onClick={handlePreview}
            aria-label={`Visualizar ${anexo.nome_arquivo}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7 shadow-sm"
            onClick={handleDownload}
            aria-label={`Baixar ${anexo.nome_arquivo}`}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {podeRemover && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-7 w-7 shadow-sm"
              onClick={handleDeleteClick}
              aria-label={`Remover ${anexo.nome_arquivo}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="relative flex h-40 items-center justify-center bg-secondary/30">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : isImage && url ? (
            <img
              src={url}
              alt={anexo.nome_arquivo}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="space-y-0.5 p-3">
          <p className="truncate text-sm font-medium text-foreground">
            {anexo.nome_arquivo}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(anexo.tamanho_bytes)} · {anexo.autor?.nome ?? "—"} ·{" "}
            {formatRelativeSP(anexo.created_at)}
          </p>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[92vh] w-[95vw] max-w-6xl flex-col gap-3 p-4">
          <div className="min-w-0 pr-8">
            <DialogTitle className="truncate text-sm">
              {anexo.nome_arquivo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {formatBytes(anexo.tamanho_bytes)} · {anexo.autor?.nome ?? "—"} ·{" "}
              {formatRelativeSP(anexo.created_at)}
            </DialogDescription>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md bg-black/40">
            {url && isImage ? (
              <ImagemComZoom src={url} alt={anexo.nome_arquivo} />
            ) : url && isVideo ? (
              <video src={url} controls autoPlay className="max-h-[75vh] max-w-full" />
            ) : url && isPdf ? (
              <iframe
                src={url}
                title={anexo.nome_arquivo}
                className="h-[75vh] w-full bg-white"
              />
            ) : (
              <p className="py-10 text-sm text-muted-foreground">
                Pré-visualização indisponível para este arquivo.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {url && (
              <Button asChild size="sm" variant="outline">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Abrir em nova guia
                </a>
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={handleDownload}>
              <Download className="mr-1 h-4 w-4" />
              Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remover anexo?"
        description={
          <>
            <span className="font-medium">{anexo.nome_arquivo}</span> será
            removido permanentemente.
          </>
        }
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={async () => {
          await deleteMut.mutateAsync({
            anexoId: anexo.id,
            storagePath: anexo.storage_path,
            demandaId: anexo.demanda_id,
          });
        }}
      />
    </>
  );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

function limitarZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

// Roda do mouse aproxima no ponto do cursor, arrastar move a imagem ampliada,
// duplo clique alterna entre 100% e 250%.
function ImagemComZoom({ src, alt }: { src: string; alt: string }) {
  const areaRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });
  const arraste = React.useRef<{ x: number; y: number } | null>(null);

  const aplicarZoom = React.useCallback(
    (novo: number, ponto?: { x: number; y: number }) => {
      const z = limitarZoom(novo);
      if (z === 1) {
        setZoom(1);
        setPos({ x: 0, y: 0 });
        return;
      }
      const p = ponto ?? { x: 0, y: 0 };
      setPos((atual) => ({
        x: p.x - (p.x - atual.x) * (z / zoom),
        y: p.y - (p.y - atual.y) * (z / zoom),
      }));
      setZoom(z);
    },
    [zoom],
  );

  const pontoRelativoAoCentro = (clientX: number, clientY: number) => {
    const r = areaRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  // Listener nativo: o onWheel do React é passivo e não deixa cancelar o scroll.
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fator = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      aplicarZoom(zoom * fator, pontoRelativoAoCentro(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [aplicarZoom, zoom]);

  return (
    <div className="relative h-[75vh] w-full">
      <div
        ref={areaRef}
        className={cn(
          "flex h-full w-full touch-none select-none items-center justify-center overflow-hidden",
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
        onDoubleClick={(e) =>
          aplicarZoom(zoom > 1 ? 1 : 2.5, pontoRelativoAoCentro(e.clientX, e.clientY))
        }
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          arraste.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
        onPointerMove={(e) => {
          if (!arraste.current) return;
          setPos({ x: e.clientX - arraste.current.x, y: e.clientY - arraste.current.y });
        }}
        onPointerUp={() => (arraste.current = null)}
        onPointerCancel={() => (arraste.current = null)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
            transition: arraste.current ? "none" : "transform 120ms ease-out",
          }}
        />
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 p-1 shadow-md backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          onClick={() => aplicarZoom(zoom / 1.5)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Diminuir zoom"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="min-w-12 px-1 text-center text-xs tabular-nums text-muted-foreground hover:text-foreground"
          onClick={() => aplicarZoom(1)}
          title="Voltar ao tamanho original"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full"
          onClick={() => aplicarZoom(zoom * 1.5)}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Aumentar zoom"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        {zoom > 1 && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full"
            onClick={() => aplicarZoom(1)}
            aria-label="Restaurar"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AnexoCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="h-40 w-full" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
