import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

export type Modulo = Database["public"]["Tables"]["modulos"]["Row"];

export const moduloSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  cor: z.string().regex(/^#[0-9a-f]{6}$/i, "Cor deve ser hex (#RRGGBB)"),
  ativo: z.boolean(),
});

export type ModuloInput = z.infer<typeof moduloSchema>;

const modulosKey = ["modulos"] as const;

export function useModulos() {
  return useQuery<Modulo[]>({
    queryKey: modulosKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

function normalizeInput(input: ModuloInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() ? input.descricao.trim() : null,
    cor: input.cor.toUpperCase(),
    ativo: input.ativo,
  };
}

export function useCreateModulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ModuloInput) => {
      const { data, error } = await supabase
        .from("modulos")
        .insert(normalizeInput(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: modulosKey });
      qc.invalidateQueries({ queryKey: ["submodulos"] });
      toast.success("Módulo criado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "modulo"));
    },
  });
}

export function useUpdateModulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ModuloInput }) => {
      const { data, error } = await supabase
        .from("modulos")
        .update(normalizeInput(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: modulosKey });
      qc.invalidateQueries({ queryKey: ["submodulos"] });
      toast.success("Módulo atualizado");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "modulo"));
    },
  });
}

export function useDeleteModulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modulos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: modulosKey });
      qc.invalidateQueries({ queryKey: ["submodulos"] });
      toast.success("Módulo excluído");
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "modulo"));
    },
  });
}
