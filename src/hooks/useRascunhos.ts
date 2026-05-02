import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type {
  CorRascunho,
  Rascunho,
  RascunhoChecklistItem,
  RascunhoComItens,
  TipoRascunho,
} from "@/types/rascunho";

type Filtro = "meus" | "compartilhados" | "todos" | "lixeira";

export function useRascunhos(filtro: Filtro = "todos") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rascunhos", filtro, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("rascunhos")
        .select(
          `id, autor_id, titulo, tipo, conteudo_texto, cor, fixada, compartilhada,
           created_at, updated_at,
           autor:profiles!rascunhos_autor_id_fkey(nome, avatar_url),
           itens:rascunho_checklist_itens(id, rascunho_id, texto, marcado, ordem, created_at),
           compartilhamentos:rascunho_compartilhamentos(
             id, rascunho_id, usuario_id, tenant_id, created_at, created_by,
             usuario:profiles!rascunho_compartilhamentos_usuario_id_fkey(nome),
             tenant:tenants!rascunho_compartilhamentos_tenant_id_fkey(nome)
           )`,
        )
        .order("fixada", { ascending: false })
        .order("updated_at", { ascending: false });

      if (filtro === "lixeira" && user?.id) {
        q = q.eq("autor_id", user.id).not("deleted_at", "is", null);
      } else {
        q = q.is("deleted_at", null);
        if (filtro === "meus" && user?.id) q = q.eq("autor_id", user.id);
        if (filtro === "compartilhados" && user?.id)
          q = q.neq("autor_id", user.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        autor_nome: r.autor?.nome ?? null,
        autor_avatar: r.autor?.avatar_url ?? null,
        itens: (r.itens ?? []).sort(
          (a: RascunhoChecklistItem, b: RascunhoChecklistItem) =>
            a.ordem - b.ordem,
        ),
        compartilhamentos: (r.compartilhamentos ?? []).map((c: any) => ({
          id: c.id,
          rascunho_id: c.rascunho_id,
          usuario_id: c.usuario_id,
          tenant_id: c.tenant_id,
          created_at: c.created_at,
          created_by: c.created_by,
          usuario_nome: c.usuario?.nome ?? null,
          tenant_nome: c.tenant?.nome ?? null,
        })),
      })) as RascunhoComItens[];
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

export function useCriarRascunho() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation<
    Rascunho,
    Error,
    {
      titulo?: string | null;
      tipo: TipoRascunho;
      conteudo_texto?: string | null;
      cor?: CorRascunho;
      itens?: { texto: string; marcado?: boolean }[];
    }
  >({
    mutationFn: async (input) => {
      // Revalida a sessão direto no Supabase pra evitar autor_id stale
      // após refresh de token (causa de RLS violation intermitente)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user?.id) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      const autorId = authData.user.id;
      if (!user?.id || user.id !== autorId) {
        // continua, mas usa o ID do Supabase como fonte da verdade
      }
      const { data: criado, error } = await supabase
        .from("rascunhos")
        .insert({
          autor_id: autorId,
          titulo: input.titulo?.trim() || null,
          tipo: input.tipo,
          conteudo_texto:
            input.tipo === "texto"
              ? input.conteudo_texto?.trim() || null
              : null,
          cor: input.cor ?? "cinza",
        })
        .select()
        .single();
      if (error) throw error;

      if (input.tipo === "checklist" && input.itens && input.itens.length > 0) {
        const linhas = input.itens
          .filter((i) => i.texto.trim().length > 0)
          .map((i, idx) => ({
            rascunho_id: criado.id,
            texto: i.texto.trim(),
            marcado: !!i.marcado,
            ordem: idx,
          }));
        if (linhas.length > 0) {
          const { error: errItens } = await supabase
            .from("rascunho_checklist_itens")
            .insert(linhas);
          if (errItens) throw errItens;
        }
      }
      return criado as Rascunho;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Rascunho criado");
    },
    onError: (err) => toast.error(err.message || "Erro ao criar rascunho"),
  });
}

export function useAtualizarRascunho() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    {
      id: string;
      patch: Partial<
        Pick<
          Rascunho,
          "titulo" | "conteudo_texto" | "cor" | "fixada" | "compartilhada"
        >
      >;
    }
  >({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase
        .from("rascunhos")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rascunhos"] }),
    onError: (err) => toast.error(err.message || "Erro ao atualizar"),
  });
}

export function useExcluirRascunho() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from("rascunhos")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Rascunho movido para a Lixeira");
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir"),
  });
}

export function useRestaurarRascunho() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from("rascunhos")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Rascunho restaurado");
    },
    onError: (err) => toast.error(err.message || "Erro ao restaurar"),
  });
}

export function useExcluirRascunhoDefinitivo() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from("rascunhos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Rascunho excluído definitivamente");
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir"),
  });
}

export function useDuplicarRascunho() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase.rpc("duplicar_rascunho", {
        p_rascunho_id: id,
      });
      if (error) throw error;
      const novo = Array.isArray(data) ? data[0] : data;
      return (novo as any)?.id ?? "";
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Rascunho duplicado");
    },
    onError: (err) => toast.error(err.message || "Erro ao duplicar"),
  });
}

/* ====== Checklist itens ====== */

export function useToggleItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, { itemId: string; marcado: boolean }>({
    mutationFn: async ({ itemId, marcado }) => {
      const { error } = await supabase
        .from("rascunho_checklist_itens")
        .update({ marcado })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rascunhos"] }),
  });
}

export function useAdicionarItem() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { rascunhoId: string; texto: string; ordem: number }
  >({
    mutationFn: async ({ rascunhoId, texto, ordem }) => {
      if (!texto.trim()) return;
      const { error } = await supabase
        .from("rascunho_checklist_itens")
        .insert({ rascunho_id: rascunhoId, texto: texto.trim(), ordem });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rascunhos"] }),
    onError: (err) => toast.error(err.message || "Erro ao adicionar item"),
  });
}

export function useAtualizarItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, { itemId: string; texto: string }>({
    mutationFn: async ({ itemId, texto }) => {
      const { error } = await supabase
        .from("rascunho_checklist_itens")
        .update({ texto: texto.trim() })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rascunhos"] }),
  });
}

export function useExcluirItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, { itemId: string }>({
    mutationFn: async ({ itemId }) => {
      const { error } = await supabase
        .from("rascunho_checklist_itens")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rascunhos"] }),
  });
}

/* ====== Compartilhamentos granulares ====== */

export function useAdicionarCompartilhamento() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation<
    void,
    Error,
    { rascunhoId: string; usuarioId?: string; tenantId?: string }
  >({
    mutationFn: async ({ rascunhoId, usuarioId, tenantId }) => {
      if (!user?.id) throw new Error("Não autenticado");
      if (!usuarioId && !tenantId) throw new Error("Selecione um destinatário");
      const { error } = await supabase
        .from("rascunho_compartilhamentos")
        .insert({
          rascunho_id: rascunhoId,
          usuario_id: usuarioId ?? null,
          tenant_id: tenantId ?? null,
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Compartilhamento adicionado");
    },
    onError: (err) => toast.error(err.message || "Erro ao compartilhar"),
  });
}

export function useRemoverCompartilhamento() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from("rascunho_compartilhamentos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rascunhos"] });
      toast.success("Compartilhamento removido");
    },
    onError: (err) => toast.error(err.message || "Erro ao remover"),
  });
}
