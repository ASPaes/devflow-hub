import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, FileText, ImageIcon, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeSP } from "@/lib/format";
import { getAnexoUrl } from "@/lib/storage";
import type { DemandaAnexo } from "@/hooks/useDemandas";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface AnexoCardProps {
  anexo: DemandaAnexo;
}

export function AnexoCard({ anexo }: AnexoCardProps) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["anexo-url", anexo.id],
    queryFn: () => getAnexoUrl(anexo.storage_path),
    staleTime: 50 * 60_000,
  });

  const isImage = anexo.mime_type.startsWith("image/");
  const isVideo = anexo.mime_type.startsWith("video/");
  const isPdf = anexo.mime_type === "application/pdf";

  const Icon = isVideo ? Film : isPdf ? FileText : ImageIcon;

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50",
        !url && "pointer-events-none opacity-60",
      )}
    >
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
