import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";

export type HistoricoItem =
  Database["public"]["Tables"]["demanda_historico"]["Row"] & {
    autor: Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "id" | "nome" | "avatar_url"
    > | null;
  };

export function useHistorico(demandaId: string | undefined) {
  return useQuery<HistoricoItem[]>({
    queryKey: ["historico", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase
        .from("demanda_historico")
        .select("*, autor:profiles(id, nome, avatar_url)")
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HistoricoItem[];
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}
