import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

export type Comentario =
  Database["public"]["Tables"]["demanda_comentarios"]["Row"] & {
    autor: Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "id" | "nome" | "avatar_url"
    > | null;
  };

export function useComentarios(demandaId: string | undefined) {
  return useQuery({
    queryKey: ["comentarios", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase
        .from("demanda_comentarios")
        .select("*, autor:profiles(id, nome, avatar_url)")
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Comentario[];
    },
    enabled: !!demandaId,
    staleTime: 10_000,
  });
}

export function useCreateComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demanda_id,
      conteudo,
      user_id,
    }: {
      demanda_id: string;
      conteudo: string;
      user_id: string;
    }) => {
      const { data, error } = await supabase
        .from("demanda_comentarios")
        .insert({
          demanda_id,
          autor_id: user_id,
          conteudo: conteudo.trim(),
        })
        .select("*, autor:profiles(id, nome, avatar_url)")
        .single();
      if (error) throw error;
      return data as Comentario;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["comentarios", data.demanda_id] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
    },
    onError: (err) => toast.error(translateSupabaseError(err, "comentario")),
  });
}

export function useUpdateComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      conteudo,
    }: {
      id: string;
      conteudo: string;
    }) => {
      const { data, error } = await supabase
        .from("demanda_comentarios")
        .update({
          conteudo: conteudo.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*, autor:profiles(id, nome, avatar_url)")
        .single();
      if (error) throw error;
      return data as Comentario;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["comentarios", data.demanda_id] });
    },
    onError: (err) => toast.error(translateSupabaseError(err, "comentario")),
  });
}

export function useDeleteComentario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      demanda_id,
    }: {
      id: string;
      demanda_id: string;
    }) => {
      const { error } = await supabase
        .from("demanda_comentarios")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { demanda_id };
    },
    onSuccess: ({ demanda_id }) => {
      qc.invalidateQueries({ queryKey: ["comentarios", demanda_id] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Comentário removido");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "comentario")),
  });
}
