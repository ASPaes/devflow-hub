import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Film, FileText, ImageIcon, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmOpen(true);
  };

  return (
    <>
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!url) e.preventDefault();
        }}
        className={cn(
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
      </a>

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
