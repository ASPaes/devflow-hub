import * as React from "react";
import { Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ANEXO_ALLOWED_MIME,
  validarAnexos,
} from "@/lib/upload-anexos";
import {
  useDemandaAnexos,
  useUploadAnexos,
  type DemandaAnexo,
} from "@/hooks/useDemandas";
import { useProfile } from "@/hooks/useProfile";
import { AnexoCard, AnexoCardSkeleton } from "@/components/demandas/AnexoCard";

interface AnexosSecaoProps {
  demandaId: string;
  userId: string;
  podeRemoverDeOutros: boolean;
}

export function AnexosSecao({
  demandaId,
  userId,
  podeRemoverDeOutros,
}: AnexosSecaoProps) {
  const { temPermissao } = useProfile();
  const podeAnexar = temPermissao("comentar_demanda");
  const { data: anexos = [], isLoading } = useDemandaAnexos(demandaId);
  const uploadMut = useUploadAnexos();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragDepth = React.useRef(0);

  const handleFiles = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const { ok, erros } = validarAnexos(files, []);

      // Cap total: max 10 anexos por demanda
      const espaco = Math.max(0, 10 - anexos.length);
      const aceitos = ok.slice(0, espaco);
      const excedente = ok.length - aceitos.length;

      for (const erro of erros) {
        if (erro.kind === "size") {
          toast.error(`"${erro.file.name}" excede 25MB`);
        } else if (erro.kind === "mime") {
          toast.error(`"${erro.file.name}" tem formato não permitido`);
        } else if (erro.kind === "limit") {
          toast.error(`Máximo ${erro.max} arquivos por demanda`);
        }
      }
      if (excedente > 0) {
        toast.error(
          `Máximo 10 anexos por demanda (você tem ${anexos.length})`,
        );
      }

      if (aceitos.length > 0) {
        uploadMut.mutate({ demandaId, files: aceitos, userId });
      }
    },
    [anexos.length, demandaId, userId, uploadMut],
  );

  const triggerUpload = () => inputRef.current?.click();

  const onDragEnter = (e: React.DragEvent) => {
    if (!podeAnexar) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!podeAnexar) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!podeAnexar) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!podeAnexar) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const isUploading = uploadMut.isPending;
  const podeAdicionar = anexos.length < 10;

  return (
    <Card
      className={cn(
        "relative transition-colors",
        isDragging && "border-primary bg-primary/5",
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Anexos {anexos.length > 0 && `(${anexos.length})`}
        </CardTitle>
        {podeAnexar && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={triggerUpload}
            disabled={isUploading || !podeAdicionar}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <AnexoCardSkeleton key={i} />
            ))}
          </div>
        ) : anexos.length === 0 ? (
          <EmptyAnexos onClick={triggerUpload} disabled={isUploading} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {anexos.map((a) => (
              <AnexoCard
                key={a.id}
                anexo={a}
                podeRemover={a.autor_id === userId || podeRemoverDeOutros}
              />
            ))}
          </div>
        )}
      </CardContent>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ANEXO_ALLOWED_MIME.join(",")}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) handleFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <Upload className="h-8 w-8 text-primary" />
          <p className="mt-2 text-sm font-medium text-primary">
            Solte para enviar
          </p>
        </div>
      )}

      {/* Upload spinner overlay */}
      {isUploading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Enviando anexo(s)…
          </p>
        </div>
      )}
    </Card>
  );
}

function EmptyAnexos({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/10 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <div className="text-sm">
        <span className="font-medium text-foreground">
          Arraste arquivos aqui
        </span>{" "}
        <span className="text-muted-foreground">ou clique pra selecionar</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Imagens, vídeos ou PDFs, até 25MB cada. Máximo 10 arquivos.
      </p>
    </button>
  );
}

export type { DemandaAnexo };
