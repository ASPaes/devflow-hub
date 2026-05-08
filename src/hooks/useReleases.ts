import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Release, ReleasePublicada, TipoRelease } from "@/types/release";

/** Carrega release de uma demanda específica (rascunho ou publicada) */
export function useReleaseDaDemanda(demandaId: string | undefined) {
  return useQuery<Release | null>({
    queryKey: ["release-da-demanda", demandaId],
    queryFn: async () => {
      if (!demandaId) return null;
      const { data, error } = await supabase
        .from("releases")
        .select("*")
        .eq("demanda_id", demandaId)
        .maybeSingle();
      if (error) throw error;
      return (data as Release | null) ?? null;
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}

/** Toggle flag incluir_release + cria/apaga rascunho */
export function useMarcarIncluirRelease() {
  const qc = useQueryClient();
  return useMutation<void, Error, { demandaId: string; incluir: boolean }>({
    mutationFn: async ({ demandaId, incluir }) => {
      console.log("[marcar_incluir_release] CALL:", { demandaId, incluir });
      const { data, error } = await supabase.rpc("marcar_incluir_release", {
        p_demanda_id: demandaId,
        p_incluir: incluir,
      });
      console.log("[marcar_incluir_release] result:", { data, error });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["release-da-demanda", vars.demandaId] });
      qc.invalidateQueries({ queryKey: ["demanda"] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
    },
    onError: (err) => toast.error(err.message || "Erro ao alterar inclusão"),
  });
}

/** Salva rascunho (upsert) */
export function useSalvarRascunhoRelease() {
  const qc = useQueryClient();
  return useMutation<
    Release,
    Error,
    {
      demandaId: string;
      tipoRelease: TipoRelease;
      titulo: string;
      resumo: string;
    }
  >({
    mutationFn: async ({ demandaId, tipoRelease, titulo, resumo }) => {
      const { data, error } = await supabase.rpc("salvar_rascunho_release", {
        p_demanda_id: demandaId,
        p_tipo_release: tipoRelease,
        p_titulo: titulo,
        p_resumo: resumo,
      });
      if (error) throw error;
      return data as unknown as Release;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["release-da-demanda", vars.demandaId] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Rascunho salvo");
    },
    onError: (err) => toast.error(err.message || "Erro ao salvar rascunho"),
  });
}

/** Publica release */
export function usePublicarRelease() {
  const qc = useQueryClient();
  return useMutation<Release, Error, string>({
    mutationFn: async (releaseId) => {
      const { data, error } = await supabase.rpc("publicar_release", {
        p_release_id: releaseId,
      });
      if (error) throw error;
      return data as unknown as Release;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release-da-demanda"] });
      qc.invalidateQueries({ queryKey: ["releases-publicadas"] });
      toast.success("Release publicada");
    },
    onError: (err) => toast.error(err.message || "Erro ao publicar"),
  });
}

/** Despublica release (volta pra rascunho) */
export function useDespublicarRelease() {
  const qc = useQueryClient();
  return useMutation<Release, Error, string>({
    mutationFn: async (releaseId) => {
      const { data, error } = await supabase.rpc("despublicar_release", {
        p_release_id: releaseId,
      });
      if (error) throw error;
      return data as unknown as Release;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["release-da-demanda"] });
      qc.invalidateQueries({ queryKey: ["releases-publicadas"] });
      toast.success("Release despublicada");
    },
    onError: (err) => toast.error(err.message || "Erro ao despublicar"),
  });
}

/** Gera resumo via Edge Function (IA) */
export function useGerarResumoReleaseIA() {
  return useMutation<
    { titulo: string; resumo: string },
    Error,
    { demandaId: string }
  >({
    mutationFn: async ({ demandaId }) => {
      const { data, error } = await supabase.functions.invoke(
        "gerar-resumo-release-ia",
        { body: { demanda_id: demandaId } },
      );
      if (error) throw new Error(error.message || "Erro ao gerar resumo");
      if (data?.error) throw new Error(data.error);
      if (!data?.titulo || !data?.resumo) {
        throw new Error("IA retornou resposta incompleta");
      }
      return { titulo: data.titulo as string, resumo: data.resumo as string };
    },
    onError: (err) => toast.error(err.message || "Erro ao gerar resumo"),
  });
}

/** Lista releases publicadas */
export function useReleasesPublicadas() {
  return useQuery<ReleasePublicada[]>({
    queryKey: ["releases-publicadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_releases_publicadas")
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as ReleasePublicada[];
    },
    staleTime: 30_000,
  });
}
