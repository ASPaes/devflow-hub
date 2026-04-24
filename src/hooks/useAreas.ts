import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

export type Area = Database["public"]["Tables"]["areas"]["Row"];

export const areaSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  ativo: z.boolean(),
});

export type AreaInput = z.infer<typeof areaSchema>;

const areasKey = ["areas"] as const;

export function useAreas() {
  return useQuery<Area[]>({
    queryKey: areasKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("areas")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

function normalizeInput(input: AreaInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() ? input.descricao.trim() : null,
    ativo: input.ativo,
  };
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AreaInput) => {
      const { data, error } = await supabase
        .from("areas")
        .insert(normalizeInput(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: areasKey });
      toast.success("Área criada");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "area"));
    },
  });
}

export function useUpdateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AreaInput }) => {
      const { data, error } = await supabase
        .from("areas")
        .update(normalizeInput(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: areasKey });
      toast.success("Área atualizada");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "area"));
    },
  });
}

export function useDeleteArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: areasKey });
      toast.success("Área excluída");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "area"));
    },
  });
}
