import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "nome" | "avatar_url" | "role" | "ativo"
>;

export function useProfile() {
  const { user } = useAuth();
  const query = useQuery<Profile>({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("no user");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, role, ativo")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    isDevGestor: query.data?.role === "dev_gestor",
    refetch: query.refetch,
  };
}
