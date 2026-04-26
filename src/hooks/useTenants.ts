import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import type { Database } from "@/integrations/supabase/types";

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

export const tenantSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
  doctorsaas_tenant_id: z
    .string()
    .trim()
    .uuid("Deve ser um UUID válido")
    .optional()
    .or(z.literal("")),
  ativo: z.boolean(),
});

export type TenantInput = z.infer<typeof tenantSchema>;

const tenantsKey = ["tenants"] as const;

function normalize(input: TenantInput) {
  return {
    nome: input.nome.trim(),
    descricao: input.descricao?.trim() ? input.descricao.trim() : null,
    doctorsaas_tenant_id: input.doctorsaas_tenant_id?.trim()
      ? input.doctorsaas_tenant_id.trim()
      : null,
    ativo: input.ativo,
  };
}

export function useTenants() {
  return useQuery<Tenant[]>({
    queryKey: tenantsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TenantInput) => {
      const { data, error } = await supabase
        .from("tenants")
        .insert(normalize(input))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantsKey });
      qc.invalidateQueries({ queryKey: ["usuarios_admin"] });
      toast.success("Empresa criada");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "tenant")),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TenantInput }) => {
      const { data, error } = await supabase
        .from("tenants")
        .update(normalize(input))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantsKey });
      qc.invalidateQueries({ queryKey: ["usuarios_admin"] });
      toast.success("Tenant atualizado");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "tenant")),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantsKey });
      toast.success("Tenant excluído");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "tenant")),
  });
}
