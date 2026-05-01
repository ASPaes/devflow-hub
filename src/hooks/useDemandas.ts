import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import type { DateRange } from "react-day-picker";

import { supabase } from "@/lib/supabase";
import { translateSupabaseError } from "@/lib/supabase-errors";
import { ANEXO_BUCKET, uploadAnexo } from "@/lib/upload-anexos";
import { toIsoDate, type TipoData } from "@/lib/date-presets";
import type { Database } from "@/integrations/supabase/types";

export type Demanda = Database["public"]["Tables"]["demandas"]["Row"];
export type DemandaListaRow =
  Database["public"]["Views"]["vw_demandas_lista"]["Row"];

export type DemandaCompleta = Demanda & {
  modulo: Pick<
    Database["public"]["Tables"]["modulos"]["Row"],
    "id" | "nome" | "cor"
  > | null;
  submodulo: Pick<
    Database["public"]["Tables"]["submodulos"]["Row"],
    "id" | "nome"
  > | null;
  area: Pick<Database["public"]["Tables"]["areas"]["Row"], "id" | "nome"> | null;
  tenant: Pick<Database["public"]["Tables"]["tenants"]["Row"], "id" | "nome"> | null;
  produto: Pick<
    Database["public"]["Tables"]["produtos"]["Row"],
    "id" | "nome"
  > | null;
  solicitante: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "nome" | "avatar_url"
  > | null;
  responsavel: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "nome" | "avatar_url"
  > | null;
};

export type DemandaAnexo =
  Database["public"]["Tables"]["demanda_anexos"]["Row"] & {
    autor: Pick<
      Database["public"]["Tables"]["profiles"]["Row"],
      "id" | "nome" | "avatar_url"
    > | null;
  };

export type UpdateDemandaPatch = Partial<
  Pick<
    Demanda,
    | "titulo"
    | "descricao"
    | "status"
    | "prioridade"
    | "responsavel_id"
    | "deadline"
    | "dev_deadline"
    | "estimativa_horas"
    | "modulo_id"
    | "submodulo_id"
    | "area_id"
    | "produto_id"
  >
>;

export const TIPO_DEMANDA_VALUES = [
  "erro",
  "melhoria",
  "nova_funcionalidade",
  "duvida",
  "tarefa",
] as const;

export type TipoDemanda = (typeof TIPO_DEMANDA_VALUES)[number];

export const STATUS_DEMANDA_VALUES = [
  "triagem",
  "analise",
  "desenvolvimento",
  "teste",
  "para_publicar",
  "entregue",
  "reaberta",
  "encerrada",
  "cancelada",
] as const;

export type StatusDemanda = (typeof STATUS_DEMANDA_VALUES)[number];

export const TIPO_DEMANDA_LABEL: Record<TipoDemanda, string> = {
  erro: "🐛 Erro",
  melhoria: "✨ Melhoria",
  nova_funcionalidade: "🚀 Nova funcionalidade",
  duvida: "❓ Dúvida",
  tarefa: "📋 Tarefa",
};

export const STATUS_DEMANDA_LABEL: Record<StatusDemanda, string> = {
  triagem: "Triagem",
  analise: "Análise",
  desenvolvimento: "Desenvolvimento",
  teste: "Teste",
  para_publicar: "Para Publicar",
  entregue: "Entregue",
  reaberta: "Reaberta",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

export const PRIORIDADE_LABEL: Record<number, string> = {
  1: "1 — Baixa",
  2: "2 — Menor",
  3: "3 — Normal",
  4: "4 — Alta",
  5: "5 — Urgente",
};

export const PRIORIDADE_LABEL_CURTA: Record<number, string> = {
  1: "Baixa",
  2: "Menor",
  3: "Normal",
  4: "Alta",
  5: "Urgente",
};

export const novaDemandaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(5, "Mínimo 5 caracteres")
    .max(200, "Máximo 200 caracteres"),
  descricao: z
    .string()
    .trim()
    .min(10, "Descreva com mais detalhes (mínimo 10 caracteres)"),
  tipo: z.enum(TIPO_DEMANDA_VALUES),
  prioridade: z.coerce.number().int().min(1).max(5),
  produto_id: z.string().uuid("Selecione um produto"),
  modulo_id: z.string().uuid("Selecione um módulo"),
  submodulo_id: z.string().uuid("Selecione um submódulo"),
  area_id: z.string().uuid().optional(),
  solicitante_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
});

export type NovaDemandaInput = z.infer<typeof novaDemandaSchema>;

interface CreateDemandaArgs {
  input: NovaDemandaInput;
  anexos: File[];
  userId: string;
}

interface CreateDemandaResult {
  demanda: Demanda;
  anexosFalhos: number;
}

export function useCreateDemanda() {
  const qc = useQueryClient();
  return useMutation<CreateDemandaResult, unknown, CreateDemandaArgs>({
    mutationFn: async ({ input, anexos, userId }) => {
      const { data: demanda, error } = await supabase
        .from("demandas")
        .insert({
          titulo: input.titulo.trim(),
          descricao: input.descricao.trim(),
          tipo: input.tipo,
          prioridade: input.prioridade,
          produto_id: input.produto_id,
          modulo_id: input.modulo_id,
          submodulo_id: input.submodulo_id,
          ...(input.area_id ? { area_id: input.area_id } : {}),
          solicitante_id: input.solicitante_id ?? userId,
          ...(input.tenant_id ? { tenant_id: input.tenant_id } : {}),
        } as never)
        .select()
        .single();
      if (error) throw error;

      let anexosFalhos = 0;
      if (anexos.length > 0) {
        const results = await Promise.allSettled(
          anexos.map((file) =>
            uploadAnexo({ demandaId: demanda.id, file, userId }),
          ),
        );
        anexosFalhos = results.filter((r) => r.status === "rejected").length;
      }

      return { demanda, anexosFalhos };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      const codigo = result.demanda.codigo ?? "nova";
      if (result.anexosFalhos > 0) {
        toast.warning(
          `Demanda ${codigo} criada, mas ${result.anexosFalhos} anexo(s) falharam`,
        );
      } else {
        toast.success(`Demanda ${codigo} criada com sucesso`);
      }
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "demanda"));
    },
  });
}

export type FiltrosDemanda = {
  status?: StatusDemanda[];
  prioridade?: number[];
  tipo?: TipoDemanda[];
  modulo_id?: string;
  area_id?: string;
  /** null = "sem responsável" */
  responsavel_id?: string | null;
  solicitante_id?: string;
  busca?: string;

  // === NOVOS — compatíveis com filtros do Dashboard ===
  modulo_ids?: string[];
  area_ids?: string[];
  tenant_ids?: string[];
  responsavel_ids?: string[];
  solicitante_ids?: string[];

  // === Período por tipo de data ===
  periodo?: DateRange | null;
  tipoData?: TipoData;
  apenasSemData?: boolean;
};

export interface UseDemandasListaOptions {
  limit?: number;
}

export function useDemandasLista(
  filtros: FiltrosDemanda,
  options: UseDemandasListaOptions = {},
) {
  const { limit } = options;
  return useQuery<DemandaListaRow[]>({
    queryKey: ["demandas", "lista", filtros, limit ?? null],
    queryFn: async () => {
      let q = supabase.from("vw_demandas_lista").select("*");

      if (filtros.status?.length) q = q.in("status", filtros.status);
      if (filtros.prioridade?.length)
        q = q.in("prioridade", filtros.prioridade);
      if (filtros.tipo?.length) q = q.in("tipo", filtros.tipo);
      if (filtros.modulo_id) q = q.eq("modulo_id", filtros.modulo_id);
      if (filtros.area_id) q = q.eq("area_id", filtros.area_id);
      if (filtros.responsavel_id === null) {
        q = q.is("responsavel_id", null);
      } else if (filtros.responsavel_id) {
        q = q.eq("responsavel_id", filtros.responsavel_id);
      }
      if (filtros.solicitante_id)
        q = q.eq("solicitante_id", filtros.solicitante_id);
      if (filtros.busca?.trim()) {
        const t = filtros.busca.trim().replace(/[%,]/g, " ");
        q = q.or(
          `titulo.ilike.%${t}%,codigo.ilike.%${t}%,descricao.ilike.%${t}%`,
        );
      }

      // === MULTI-SELECT (preferem sobre filtros únicos antigos) ===
      if (filtros.modulo_ids?.length) {
        q = q.in("modulo_id", filtros.modulo_ids);
      } else if (filtros.modulo_id) {
        q = q.eq("modulo_id", filtros.modulo_id);
      }

      if (filtros.area_ids?.length) {
        q = q.in("area_id", filtros.area_ids);
      } else if (filtros.area_id) {
        q = q.eq("area_id", filtros.area_id);
      }

      if (filtros.tenant_ids?.length) {
        q = q.in("tenant_id", filtros.tenant_ids);
      }

      if (filtros.responsavel_ids?.length) {
        q = q.in("responsavel_id", filtros.responsavel_ids);
      }

      if (filtros.solicitante_ids?.length) {
        q = q.in("solicitante_id", filtros.solicitante_ids);
      }

      // === PERÍODO POR TIPO DE DATA ===
      const tipoData: TipoData = filtros.tipoData ?? "criacao";
      const apenasSemData = filtros.apenasSemData ?? false;

      if (apenasSemData) {
        if (tipoData === "desenvolvimento") {
          q = q.is("dev_deadline", null);
        } else if (tipoData === "entrega") {
          q = q.is("deadline", null);
        } else {
          // criacao + apenasSemData → não faz sentido, retorna nada
          q = q.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      } else if (filtros.periodo?.from && filtros.periodo?.to) {
        const inicio = toIsoDate(filtros.periodo.from);
        const fim = toIsoDate(filtros.periodo.to);

        if (tipoData === "criacao") {
          q = q
            .gte("created_at", `${inicio}T00:00:00`)
            .lte("created_at", `${fim}T23:59:59`);
        } else if (tipoData === "desenvolvimento") {
          q = q
            .not("dev_deadline", "is", null)
            .gte("dev_deadline", inicio)
            .lte("dev_deadline", fim);
        } else if (tipoData === "entrega") {
          q = q
            .not("deadline", "is", null)
            .gte("deadline", inicio)
            .lte("deadline", fim);
        }
      }

      q = q.order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DemandaListaRow[];
    },
    staleTime: 30_000,
  });
}

export function useDemanda(codigo: string) {
  return useQuery<DemandaCompleta | null>({
    queryKey: ["demanda", codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select(
          `*,
          modulo:modulos(id, nome, cor),
          submodulo:submodulos(id, nome),
          area:areas(id, nome),
          tenant:tenants(id, nome),
          produto:produtos(id, nome),
          solicitante:profiles!demandas_solicitante_id_fkey(id, nome, avatar_url),
          responsavel:profiles!demandas_responsavel_id_fkey(id, nome, avatar_url)`,
        )
        .eq("codigo", codigo)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DemandaCompleta | null) ?? null;
    },
    staleTime: 30_000,
  });
}

export function useDemandaAnexos(demandaId: string | undefined) {
  return useQuery<DemandaAnexo[]>({
    queryKey: ["demanda-anexos", demandaId],
    queryFn: async () => {
      if (!demandaId) return [];
      const { data, error } = await supabase
        .from("demanda_anexos")
        .select("*, autor:profiles(id, nome, avatar_url)")
        .eq("demanda_id", demandaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DemandaAnexo[];
    },
    enabled: !!demandaId,
    staleTime: 30_000,
  });
}

export function useUploadAnexos() {
  const qc = useQueryClient();
  return useMutation<
    { demandaId: string; total: number; failed: number },
    unknown,
    { demandaId: string; files: File[]; userId: string }
  >({
    mutationFn: async ({ demandaId, files, userId }) => {
      const results = await Promise.allSettled(
        files.map((file) => uploadAnexo({ demandaId, file, userId })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0 && failed === files.length) {
        const first = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        throw first?.reason ?? new Error("Nenhum anexo foi enviado");
      }
      return { demandaId, total: files.length, failed };
    },
    onSuccess: ({ demandaId, total, failed }) => {
      qc.invalidateQueries({ queryKey: ["demanda-anexos", demandaId] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      const enviados = total - failed;
      if (failed > 0) {
        toast.warning(
          `${enviados} de ${total} anexos enviados (${failed} falharam)`,
        );
      } else {
        toast.success(total === 1 ? "Anexo enviado" : `${total} anexos enviados`);
      }
    },
    onError: (err) => toast.error(translateSupabaseError(err, "anexo")),
  });
}

export function useDeleteAnexo() {
  const qc = useQueryClient();
  return useMutation<
    { demandaId: string },
    unknown,
    { anexoId: string; storagePath: string; demandaId: string }
  >({
    mutationFn: async ({ anexoId, storagePath, demandaId }) => {
      // Storage primeiro: se falhar, metadata fica intacta.
      const { error: storageErr } = await supabase.storage
        .from(ANEXO_BUCKET)
        .remove([storagePath]);
      if (storageErr) throw storageErr;

      const { error: metaErr } = await supabase
        .from("demanda_anexos")
        .delete()
        .eq("id", anexoId);
      if (metaErr) throw metaErr;

      return { demandaId };
    },
    onSuccess: ({ demandaId }) => {
      qc.invalidateQueries({ queryKey: ["demanda-anexos", demandaId] });
      qc.invalidateQueries({ queryKey: ["demandas"] });
      toast.success("Anexo removido");
    },
    onError: (err) => toast.error(translateSupabaseError(err, "anexo")),
  });
}

export function useReabrirDemanda() {
  const qc = useQueryClient();
  return useMutation<
    Demanda,
    Error,
    { demandaId: string; motivo: string }
  >({
    mutationFn: async ({ demandaId, motivo }) => {
      const { data, error } = await supabase.rpc("reabrir_demanda", {
        p_demanda_id: demandaId,
        p_motivo: motivo,
      });
      if (error) throw error;
      return data as unknown as Demanda;
    },
    onSuccess: (data) => {
      if (data.codigo) {
        qc.invalidateQueries({ queryKey: ["demanda", data.codigo] });
      }
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["comentarios", data.id] });
      qc.invalidateQueries({ queryKey: ["historico", data.id] });
      toast.success("Demanda reaberta");
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      if (msg.includes("Apenas o solicitante")) {
        toast.error("Só o solicitante original pode reabrir");
      } else if (msg.includes("status atual")) {
        toast.error("Apenas demandas entregues podem ser reabertas");
      } else if (msg.includes("Janela de reabertura expirou")) {
        toast.error("Prazo de reabertura expirou (14 dias)");
      } else {
        toast.error(translateSupabaseError(err, "demanda"));
      }
    },
  });
}

export function useUpdateDemanda() {
  const qc = useQueryClient();
  return useMutation<Demanda, unknown, { id: string; patch: UpdateDemandaPatch }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await supabase
        .from("demandas")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Demanda;
    },
    onSuccess: (data) => {
      if (data.codigo) {
        qc.invalidateQueries({ queryKey: ["demanda", data.codigo] });
      }
      qc.invalidateQueries({ queryKey: ["demandas"] });
      qc.invalidateQueries({ queryKey: ["historico", data.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    },
    onError: (err) => {
      toast.error(translateSupabaseError(err, "demanda"));
    },
  });
}

// Status workflow ---------------------------------------------------

export const PROXIMOS_STATUS: Record<StatusDemanda, StatusDemanda[]> = {
  triagem: ["analise", "cancelada"],
  analise: ["desenvolvimento", "triagem", "cancelada"],
  desenvolvimento: ["teste", "analise", "cancelada"],
  teste: ["para_publicar", "entregue", "desenvolvimento", "cancelada"],
  para_publicar: ["entregue", "teste", "cancelada"],
  entregue: [],
  reaberta: ["desenvolvimento", "teste", "cancelada"],
  encerrada: [],
  cancelada: ["triagem"],
};

export const TRANSICAO_LABEL: Record<StatusDemanda, string> = {
  triagem: "Voltar pra triagem",
  analise: "Iniciar análise",
  desenvolvimento: "Enviar pra desenvolvimento",
  teste: "Enviar pra teste",
  para_publicar: "Marcar como Para Publicar",
  entregue: "Marcar como entregue",
  reaberta: "Reabrir",
  encerrada: "Encerrar",
  cancelada: "Cancelar",
};
