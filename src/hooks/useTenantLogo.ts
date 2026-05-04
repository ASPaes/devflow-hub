import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const BUCKET = "tenant-logos";
const MAX_BYTES = 2 * 1024 * 1024;

export function useUploadTenantLogo() {
  const qc = useQueryClient();
  return useMutation<string, Error, { tenantId: string; arquivo: File }>({
    mutationFn: async ({ tenantId, arquivo }) => {
      if (arquivo.size > MAX_BYTES) {
        throw new Error("Logo maior que 2MB");
      }
      const ext = arquivo.name.split(".").pop()?.toLowerCase() || "png";
      const path = `tenant-${tenantId}.${ext}`;

      const { error: errUpload } = await supabase.storage
        .from(BUCKET)
        .upload(path, arquivo, {
          cacheControl: "3600",
          upsert: true,
          contentType: arquivo.type,
        });
      if (errUpload) throw errUpload;

      const { error: errUpdate } = await supabase
        .from("tenants")
        .update({ logo_url: path })
        .eq("id", tenantId);
      if (errUpdate) throw errUpdate;

      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Logo atualizada");
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("2MB") || m.toLowerCase().includes("size")) {
        toast.error("Logo maior que 2MB. Reduza o tamanho.");
      } else if (m.toLowerCase().includes("permission") || m.includes("permissão")) {
        toast.error("Sem permissão para alterar logo");
      } else {
        toast.error("Erro ao enviar logo");
      }
    },
  });
}

export function useRemoverTenantLogo() {
  const qc = useQueryClient();
  return useMutation<void, Error, { tenantId: string; logoUrl: string }>({
    mutationFn: async ({ tenantId, logoUrl }) => {
      await supabase.storage.from(BUCKET).remove([logoUrl]);
      const { error } = await supabase
        .from("tenants")
        .update({ logo_url: null })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Logo removida");
    },
    onError: () => toast.error("Erro ao remover logo"),
  });
}
