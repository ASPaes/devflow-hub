import { supabase } from "@/lib/supabase";

export const ANEXO_BUCKET = "demanda-anexos";
export const ANEXO_MAX_BYTES = 25 * 1024 * 1024; // 25MB
export const ANEXO_MAX_FILES = 10;

export const ANEXO_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
] as const;

export type AnexoMime = (typeof ANEXO_ALLOWED_MIME)[number];

export function isMimePermitido(mime: string): mime is AnexoMime {
  return (ANEXO_ALLOWED_MIME as readonly string[]).includes(mime);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type AnexoValidationError =
  | { kind: "size"; file: File }
  | { kind: "mime"; file: File }
  | { kind: "limit"; max: number };

export function validarAnexos(
  novos: File[],
  jaSelecionados: File[],
): { ok: File[]; erros: AnexoValidationError[] } {
  const erros: AnexoValidationError[] = [];
  const ok: File[] = [];

  const totalAposAdd = jaSelecionados.length + novos.length;
  if (totalAposAdd > ANEXO_MAX_FILES) {
    erros.push({ kind: "limit", max: ANEXO_MAX_FILES });
  }

  const espacoRestante = Math.max(0, ANEXO_MAX_FILES - jaSelecionados.length);

  for (const [idx, file] of novos.entries()) {
    if (idx >= espacoRestante) break;
    if (file.size > ANEXO_MAX_BYTES) {
      erros.push({ kind: "size", file });
      continue;
    }
    if (!isMimePermitido(file.type)) {
      erros.push({ kind: "mime", file });
      continue;
    }
    ok.push(file);
  }

  return { ok, erros };
}

interface UploadAnexoArgs {
  demandaId: string;
  file: File;
  userId: string;
}

export async function uploadAnexo({ demandaId, file, userId }: UploadAnexoArgs) {
  const uuid = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(0, 100);
  const path = `demandas/${demandaId}/${uuid}-${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(ANEXO_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) throw uploadErr;

  const { error: metaErr } = await supabase.from("demanda_anexos").insert({
    demanda_id: demandaId,
    autor_id: userId,
    storage_path: path,
    nome_arquivo: file.name,
    mime_type: file.type,
    tamanho_bytes: file.size,
  });
  if (metaErr) {
    // Tenta limpar o objeto órfão no storage; ignora erro de cleanup.
    await supabase.storage.from(ANEXO_BUCKET).remove([path]).catch(() => {});
    throw metaErr;
  }
}
