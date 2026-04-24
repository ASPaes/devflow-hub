import * as React from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ANEXO_ALLOWED_MIME,
  ANEXO_MAX_FILES,
  formatBytes,
  validarAnexos,
} from "@/lib/upload-anexos";

interface AnexosUploadProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function AnexosUpload({ files, onChange, disabled }: AnexosUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = React.useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      if (arr.length === 0) return;

      const { ok, erros } = validarAnexos(arr, files);

      for (const erro of erros) {
        if (erro.kind === "size") {
          toast.error(`"${erro.file.name}" excede 25MB`);
        } else if (erro.kind === "mime") {
          toast.error(`"${erro.file.name}" tem formato não permitido`);
        } else if (erro.kind === "limit") {
          toast.error(`Máximo ${erro.max} arquivos por demanda`);
        }
      }

      if (ok.length > 0) {
        onChange([...files, ...ok]);
      }
    },
    [files, onChange],
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (idx: number) => {
    const next = files.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/20 px-4 py-8 text-center transition-colors",
          "hover:border-primary/50 hover:bg-muted/30",
          isDragging && "border-primary bg-primary/5",
          disabled && "cursor-not-allowed opacity-50 hover:border-input hover:bg-muted/20",
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <Paperclip className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium text-foreground">Arraste arquivos aqui</span>{" "}
          <span className="text-muted-foreground">ou clique pra selecionar</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Imagens, vídeos ou PDFs, até 25MB cada. Máximo {ANEXO_MAX_FILES} arquivos.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ANEXO_ALLOWED_MIME.join(",")}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            // reset for re-selecting the same file
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-foreground">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleRemove(idx)}
                disabled={disabled}
                aria-label={`Remover ${file.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
