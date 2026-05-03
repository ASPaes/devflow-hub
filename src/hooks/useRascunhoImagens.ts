import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { RascunhoImagem } from "@/types/rascunho";

const BUCKET = "rascunho-imagens";
const MAX_BYTES = 10 * 1024 * 1024;

export function useRascunhoImagens(rascunhoId: string | undefined) {
  return useQuery({
    queryKey: ["rascunho-imagens", rascunhoId],
    queryFn: async () => {
      if (!rascunhoId) return [];
      const { data, error } = await supabase
        .from("rascunho_imagens")
        .select("*")
        .eq("rascunho_id", rascunhoId)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RascunhoImagem[];
    },
    enabled: !!rascunhoId,
    staleTime: 60_000,
  });
}

export function useUploadImagemRascunho() {
  const qc = useQueryClient();
  return useMutation<
    RascunhoImagem,
    Error,
    { rascunhoId: string; arquivo: File }
  >({
    mutationFn: async ({ rascunhoId, arquivo }) => {
      if (arquivo.size > MAX_BYTES) {
        throw new Error("Imagem maior que 10MB");
      }
      const { data: existentes } = await supabase
        .from("rascunho_imagens")
        .select("ordem")
        .eq("rascunho_id", rascunhoId)
        .order("ordem", { ascending: false })
        .limit(1);
      const proximaOrdem = (existentes?.[0]?.ordem ?? -1) + 1;

      const { data: criado, error: errInsert } = await supabase
        .from("rascunho_imagens")
        .insert({
          rascunho_id: rascunhoId,
          ordem: proximaOrdem,
          storage_path: "",
          nome_original: arquivo.name,
          tamanho_bytes: arquivo.size,
        })
        .select()
        .single();
      if (errInsert) throw errInsert;

      const ext = arquivo.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `rascunho-${rascunhoId}/${criado.id}.${ext}`;

      const { error: errUpload } = await supabase.storage
        .from(BUCKET)
        .upload(path, arquivo, {
          cacheControl: "3600",
          upsert: false,
          contentType: arquivo.type,
        });

      if (errUpload) {
        await supabase.from("rascunho_imagens").delete().eq("id", criado.id);
        throw errUpload;
      }

      const { error: errUpdate } = await supabase
        .from("rascunho_imagens")
        .update({ storage_path: path })
        .eq("id", criado.id);
      if (errUpdate) throw errUpdate;

      return { ...criado, storage_path: path } as RascunhoImagem;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["rascunho-imagens", vars.rascunhoId] });
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("Limite de 10") || m.toLowerCase().includes("max")) {
        toast.error("Máximo de 10 imagens por rascunho");
      } else if (m.includes("10MB") || m.toLowerCase().includes("payload")) {
        toast.error("Imagem maior que 10MB");
      } else {
        toast.error(m || "Erro ao enviar imagem");
      }
    },
  });
}

export function useExcluirImagemRascunho() {
  const qc = useQueryClient();
  return useMutation<void, Error, { imagemId: string; rascunhoId: string }>({
    mutationFn: async ({ imagemId }) => {
      const { error } = await supabase.rpc("excluir_imagem_rascunho", {
        p_imagem_id: imagemId,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["rascunho-imagens", vars.rascunhoId] });
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
    },
    onError: () => toast.error("Erro ao excluir imagem"),
  });
}

const urlCache = new Map<string, { url: string; exp: number }>();

export async function gerarSignedUrlRascunhoImagem(
  path: string,
): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cached = urlCache.get(path);
  if (cached && cached.exp > now + 30_000) return cached.url;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, exp: now + 3600 * 1000 });
  return data.signedUrl;
}
