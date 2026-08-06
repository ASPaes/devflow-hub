import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type {
  CanalComunicacao,
  DadosComunicacaoDemanda,
  MensagemGerada,
  MomentoComunicacao,
} from "@/types/comunicacao";

/**
 * O invoke() do supabase-js descarta o corpo quando a function responde não-2xx:
 * sobra só "Edge Function returned a non-2xx status code". As nossas functions
 * devolvem o motivo em `{ error }`, então lemos a Response que vem no `context`.
 */
async function mensagemDoErro(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const corpo = await (ctx as Response).clone().json();
      if (corpo?.error) return String(corpo.error);
    } catch {
      // corpo não era JSON — fica o fallback
    }
  }
  return (error as { message?: string })?.message || fallback;
}

/**
 * Contexto pra comunicar o cliente: demanda, solicitante (com e-mail e telefone),
 * todos os pareceres e o histórico de envios.
 * Exige `editar_qualquer_demanda` — a própria RPC barra quem não tem.
 */
export function useDadosComunicacao(demandaId: string | undefined, enabled = true) {
  return useQuery<DadosComunicacaoDemanda>({
    queryKey: ["comunicacao-demanda", demandaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("obter_dados_comunicacao_demanda", {
        p_demanda_id: demandaId!,
      });
      if (error) throw error;
      return data as unknown as DadosComunicacaoDemanda;
    },
    enabled: !!demandaId && enabled,
    staleTime: 30_000,
  });
}

/** Sugere assunto e corpo com IA. O agente ainda edita antes de enviar. */
export function useGerarMensagemCliente() {
  return useMutation<
    MensagemGerada,
    Error,
    { demandaId: string; canal: CanalComunicacao; momento?: MomentoComunicacao }
  >({
    mutationFn: async ({ demandaId, canal, momento }) => {
      const { data, error } = await supabase.functions.invoke("gerar-mensagem-cliente", {
        body: { demanda_id: demandaId, canal, momento },
      });
      if (error) throw new Error(await mensagemDoErro(error, "Erro ao gerar mensagem"));
      if (data?.error) throw new Error(data.error);
      if (!data?.corpo) throw new Error("A IA devolveu uma mensagem vazia");
      return data as MensagemGerada;
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("Nenhum retorno")) {
        toast.error("Registre o parecer na aba Retornos antes de gerar a mensagem");
      } else if (m.includes("permissão") || m.includes("403")) {
        toast.error("Você não tem permissão para comunicar o cliente");
      } else if (m.includes("ANTHROPIC_API_KEY")) {
        toast.error("Configuração da IA pendente. Avise o admin.");
      } else {
        toast.error(`Erro ao gerar mensagem: ${m}`);
      }
    },
  });
}

export interface EnvioComunicacaoInput {
  demandaId: string;
  canal: CanalComunicacao;
  corpo: string;
  assunto?: string;
  /** Sobrescreve o destinatário do cadastro. No WhatsApp, também fica salvo no perfil. */
  email?: string;
  telefone?: string;
}

export function useEnviarComunicacao() {
  const qc = useQueryClient();
  return useMutation<
    { ok: true; canal: CanalComunicacao; destinatario: string },
    Error,
    EnvioComunicacaoInput
  >({
    mutationFn: async ({ demandaId, canal, corpo, assunto, email, telefone }) => {
      const { data, error } = await supabase.functions.invoke("notificar-cliente-demanda", {
        body: {
          demanda_id: demandaId,
          canal,
          corpo,
          assunto,
          email,
          telefone,
        },
      });
      if (error) throw new Error(await mensagemDoErro(error, "Erro ao enviar"));
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["comunicacao-demanda", vars.demandaId] });
      // O envio cria um comentário automático na demanda
      qc.invalidateQueries({ queryKey: ["comentarios", vars.demandaId] });
      toast.success(
        res.canal === "email" ? `E-mail enviado para ${res.destinatario}` : "WhatsApp enviado",
      );
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("sem e-mail")) {
        toast.error("O solicitante não tem e-mail cadastrado");
      } else if (m.includes("Telefone")) {
        toast.error("Informe um telefone válido com DDD");
      } else if (m.includes("SMTP não configurado")) {
        toast.error("Envio de e-mail ainda não configurado. Avise o admin.");
      } else if (m.includes("DEVFLOW_WA_SECRET")) {
        toast.error("Integração de WhatsApp não configurada. Avise o admin.");
      } else {
        toast.error(m || "Erro ao enviar");
      }
    },
  });
}
