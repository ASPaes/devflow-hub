import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { EmailSecurity } from "@/components/configuracoes/email/emailProviders";

/**
 * Conta de e-mail do DoctorDev (Configurações › E-mail).
 *
 * Tudo por RPC: a tabela email_conta não tem grant para authenticated, e as
 * RPCs conferem se é admin. As RPCs ainda não estão no types.ts gerado, por
 * isso o `as any` na chamada.
 */

export interface ContaEmail {
  provedor: string;
  email: string;
  nome_remetente: string | null;
  usuario: string;
  smtp_host: string;
  smtp_porta: number;
  smtp_seguranca: EmailSecurity;
  imap_host: string | null;
  imap_porta: number | null;
  imap_seguranca: EmailSecurity | null;
  ultimo_teste_em: string | null;
  ultimo_teste_ok: boolean | null;
  ultimo_teste_erro: string | null;
  atualizado_em: string;
}

export interface SituacaoLeitor {
  ultima_execucao: string | null;
  ultimo_erro: string | null;
}

export interface ConfiguracaoEmail {
  conta: ContaEmail | null;
  leitor: SituacaoLeitor | null;
}

export interface ContaEmailInput {
  provedor: string;
  email: string;
  nome_remetente: string;
  usuario: string;
  smtp_host: string;
  smtp_porta: number;
  smtp_seguranca: EmailSecurity;
  imap_host: string;
  imap_porta: number | null;
  /** vazio = mantém a senha que já está guardada */
  senha: string;
}

export interface ResultadoTeste {
  ok: boolean;
  mensagem: string;
  smtp: { ok: boolean; erro?: string };
  imap: { ok: boolean; erro?: string } | null;
}

const CHAVE = ["conta-email"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (nome: string, args?: Record<string, unknown>) => (supabase as any).rpc(nome, args);

export function useContaEmail(habilitado: boolean) {
  return useQuery<ConfiguracaoEmail>({
    queryKey: CHAVE,
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await rpc("obter_conta_email");
      if (error) throw error;
      return (data ?? { conta: null, leitor: null }) as ConfiguracaoEmail;
    },
    // o leitor roda a cada 5 min: a situação dele na tela acompanha
    refetchInterval: 60_000,
  });
}

export function useSalvarContaEmail() {
  const qc = useQueryClient();
  return useMutation<void, Error, ContaEmailInput>({
    mutationFn: async (c) => {
      const { error } = await rpc("salvar_conta_email", {
        p_provedor: c.provedor,
        p_email: c.email,
        p_smtp_host: c.smtp_host,
        p_smtp_porta: c.smtp_porta,
        p_smtp_seguranca: c.smtp_seguranca,
        p_senha: c.senha || null,
        p_usuario: c.usuario || null,
        p_nome_remetente: c.nome_remetente || null,
        p_imap_host: c.imap_host || null,
        p_imap_porta: c.imap_host ? c.imap_porta : null,
        // o leitor de respostas só conecta com SSL/TLS
        p_imap_seguranca: c.imap_host ? "ssl" : null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}

export function useTestarContaEmail() {
  const qc = useQueryClient();
  return useMutation<ResultadoTeste, Error, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("testar-conta-email", { body: {} });
      if (error) {
        // erro HTTP da function: a frase útil está no corpo, não na mensagem genérica
        let frase: string | null = null;
        const ctx = (error as { context?: unknown }).context;
        if (ctx && typeof (ctx as Response).json === "function") {
          try {
            frase = (await (ctx as Response).clone().json())?.error ?? null;
          } catch {
            // corpo não era JSON: fica a mensagem genérica
          }
        }
        throw new Error(frase ?? error.message ?? "Não foi possível testar a conta.");
      }
      return data as ResultadoTeste;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}
