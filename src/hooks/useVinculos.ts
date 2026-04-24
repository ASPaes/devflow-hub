import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";
import type { StatusDemanda } from "@/hooks/useDemandas";

export const TIPOS_VINCULO_VALUES = [
  "depende_de",
  "bloqueia",
  "relacionada",
  "duplicada",
] as const;

export type TipoVinculo = (typeof TIPOS_VINCULO_VALUES)[number];

export type DemandaVinculada = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: StatusDemanda;
};

export type Vinculo =
  Database["public"]["Tables"]["demanda_vinculos"]["Row"] & {
    demanda_destino: DemandaVinculada | null;
  };

export function useVinculos(demandaId: string | undefined) {
  return useQuery<Vinculo[]>({
    queryKey: ["vinculos", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase
        .from("demanda_vinculos")
        .select(
          `*,
          demanda_destino:demandas!demanda_vinculos_demanda_destino_id_fkey(id, codigo, titulo, status)`,
        )
        .eq("demanda_origem_id", demandaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Vinculo[];
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}

export function useCreateVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      demanda_origem_id,
      demanda_destino_id,
      tipo_vinculo,
      user_id,
    }: {
      demanda_origem_id: string;
      demanda_destino_id: string;
      tipo_vinculo: TipoVinculo;
      user_id: string;
    }) => {
      const { data, error } = await supabase
        .from("demanda_vinculos")
        .insert({
          demanda_origem_id,
          demanda_destino_id,
          tipo_vinculo,
          created_by: user_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vinculos", data.demanda_origem_id] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
    },
    onError: (err) => toast.error(translateSupabaseError(err, "vinculo")),
  });
}

export function useDeleteVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      demanda_origem_id,
    }: {
      id: string;
      demanda_origem_id: string;
    }) => {
      const { error } = await supabase
        .from("demanda_vinculos")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { demanda_origem_id };
    },
    onSuccess: ({ demanda_origem_id }) => {
      qc.invalidateQueries({ queryKey: ["vinculos", demanda_origem_id] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Vínculo removido");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "vinculo")),
  });
}

export function useDemandasParaVincular(demandaAtualId: string | undefined) {
  return useQuery<DemandaVinculada[]>({
    queryKey: ["demandas-para-vincular", demandaAtualId],
    queryFn: async () => {
      if (!demandaAtualId) return [];
      const { data, error } = await supabase
        .from("demandas")
        .select("id, codigo, titulo, status")
        .neq("id", demandaAtualId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DemandaVinculada[];
    },
    enabled: !!demandaAtualId,
    staleTime: 60_000,
  });
}
