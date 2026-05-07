import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type {
  DemandaRetorno,
  DemandaRetornoComAutor,
  TipoMidiaRetorno,
} from "@/types/retorno";

const BUCKET = "demanda-retornos";

/** Lista retornos de uma demanda, ordenados por created_at asc (timeline). */
export function useRetornosDemanda(demandaId: string | undefined) {
  return useQuery({
    queryKey: ["demanda-retornos", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase
        .from("demanda_retornos")
        .select(
          `id, demanda_id, ordem, texto,
           midia_url, midia_tipo, midia_nome_original, midia_tamanho_bytes,
           autor_id, created_at, updated_at,
           autor:profiles!demanda_retornos_autor_id_fkey(nome, avatar_url)`,
        )
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        autor_nome: r.autor?.nome ?? null,
        autor_avatar: r.autor?.avatar_url ?? null,
      })) as DemandaRetornoComAutor[];
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}

/**
 * Cria retorno (com ou sem mídia).
 * Insere o registro primeiro pra ter o ID. Se houver arquivo,
 * faz upload em demanda-<id>/<retorno_id>/arquivo.<ext> e atualiza o path.
 * Se o upload falhar, apaga o registro órfão.
 */
export function useCriarRetorno() {
  const qc = useQueryClient();
  return useMutation<
    DemandaRetorno,
    Error,
    {
      demandaId: string;
      texto?: string;
      arquivo?: File | null;
      tipo?: TipoMidiaRetorno;
    }
  >({
    mutationFn: async ({ demandaId, texto, arquivo, tipo }) => {
      const temTexto = !!(texto && texto.trim().length > 0);
      const temMidia = !!(arquivo && tipo);
      if (!temTexto && !temMidia) {
        throw new Error("Informe um texto ou uma mídia");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: criado, error: errInsert } = await supabase
        .from("demanda_retornos")
        .insert({
          demanda_id: demandaId,
          autor_id: user.id,
          texto: temTexto ? texto!.trim() : null,
          midia_tipo: temMidia ? tipo! : null,
        })
        .select()
        .single();
      if (errInsert) throw errInsert;

      let midiaUrl: string | null = null;
      let midiaNome: string | null = null;
      let midiaTamanho: number | null = null;

      if (arquivo && tipo) {
        const ext = arquivo.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `demanda-${demandaId}/${criado.id}/arquivo.${ext}`;

        const { error: errUpload } = await supabase.storage
          .from(BUCKET)
          .upload(path, arquivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: arquivo.type,
          });

        if (errUpload) {
          await supabase.from("demanda_retornos").delete().eq("id", criado.id);
          throw errUpload;
        }

        midiaUrl = path;
        midiaNome = arquivo.name;
        midiaTamanho = arquivo.size;

        const { error: errUpdate } = await supabase
          .from("demanda_retornos")
          .update({
            midia_url: midiaUrl,
            midia_nome_original: midiaNome,
            midia_tamanho_bytes: midiaTamanho,
          })
          .eq("id", criado.id);
        if (errUpdate) throw errUpdate;
      }

      return {
        ...(criado as DemandaRetorno),
        midia_url: midiaUrl,
        midia_nome_original: midiaNome,
        midia_tamanho_bytes: midiaTamanho,
      };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["demanda-retornos", vars.demandaId] });
      toast.success("Retorno publicado");
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("permissão") || m.toLowerCase().includes("permission")) {
        toast.error("Você não tem permissão para publicar retornos");
      } else if (m.includes("texto ou uma mídia")) {
        toast.error("Informe um texto ou anexe uma mídia");
      } else if (
        m.toLowerCase().includes("payload too large") ||
        m.toLowerCase().includes("exceeded the maximum") ||
        m.toLowerCase().includes("size")
      ) {
        toast.error("Arquivo maior que 50MB. Reduza o tamanho.");
      } else {
        toast.error("Erro ao publicar retorno");
      }
    },
  });
}

/** Atualiza apenas o texto. Pra trocar mídia: exclui e cria novo. */
export function useAtualizarTextoRetorno() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { retornoId: string; demandaId: string; texto: string }
  >({
    mutationFn: async ({ retornoId, texto }) => {
      const { error } = await supabase
        .from("demanda_retornos")
        .update({ texto: texto.trim() || null })
        .eq("id", retornoId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["demanda-retornos", vars.demandaId] });
      toast.success("Retorno atualizado");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });
}

/** Hard delete via RPC: apaga registro + arquivo do Storage. */
export function useExcluirRetorno() {
  const qc = useQueryClient();
  return useMutation<void, Error, { retornoId: string; demandaId: string }>({
    mutationFn: async ({ retornoId }) => {
      const { error } = await supabase.rpc("excluir_retorno_demanda", {
        p_retorno_id: retornoId,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["demanda-retornos", vars.demandaId] });
      toast.success("Retorno excluído");
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir"),
  });
}

/** Gera signed URL temporária (1h) pra exibir mídia privada. */
export async function gerarSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) {
    console.error("Erro signed URL:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
