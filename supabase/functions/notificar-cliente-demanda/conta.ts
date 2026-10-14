/**
 * De onde sai a conta que envia o e-mail.
 *
 * 1º a conta da tela Configurações › E-mail (public.email_conta, lida pela
 *    obter_conta_email_servico). É ela que vale desde 13/09/2026, quando o
 *    Google revogou a senha de app e trocar os Secrets exigia o painel.
 * 2º os Secrets SMTP_* de antes, só enquanto ninguém cadastrou a conta.
 *
 * Arquivo à parte para ter teste. Não fica em _shared de propósito: mexer em
 * _shared faz o workflow republicar TODAS as functions do repo.
 * O leitor de respostas tem o par dele em ler-respostas-email/conta.ts.
 */

export interface ContaEmail {
  email: string;
  nome_remetente: string | null;
  usuario: string;
  smtp_host: string;
  smtp_porta: number;
  smtp_seguranca: "ssl" | "starttls" | "none";
  senha: string;
}

export interface CredenciaisEnvio {
  origem: "tela" | "secrets";
  host: string;
  porta: number;
  /** true = TLS direto (465). false = conexão limpa + STARTTLS, que o denomailer sobe sozinho. */
  tls: boolean;
  usuario: string;
  senha: string;
  remetente: string;
  nomeRemetente: string;
  /** caixa onde o cliente responde (Reply-To); o token vai no Message-ID */
  baseResposta: string;
}

export const ERRO_SEM_CONTA =
  "SMTP não configurado: cadastre a conta de e-mail em Configurações › E-mail";

export function credenciaisDeEnvio(
  conta: ContaEmail | null,
  env: (nome: string) => string | null,
): CredenciaisEnvio | null {
  if (conta) {
    return {
      origem: "tela",
      host: conta.smtp_host,
      porta: conta.smtp_porta,
      tls: conta.smtp_seguranca === "ssl",
      usuario: conta.usuario,
      senha: conta.senha,
      remetente: conta.email,
      nomeRemetente: conta.nome_remetente || "DoctorDev",
      baseResposta: conta.email,
    };
  }

  const host = env("SMTP_HOST");
  const usuario = env("SMTP_USER");
  const senha = env("SMTP_PASS");
  const remetente = env("SMTP_FROM") ?? usuario;
  if (!host || !usuario || !senha || !remetente) return null;

  const porta = Number(env("SMTP_PORT") ?? "587");
  return {
    origem: "secrets",
    host,
    porta,
    tls: porta === 465,
    usuario,
    senha,
    remetente,
    nomeRemetente: env("SMTP_FROM_NAME") ?? "DoctorDev",
    baseResposta: env("REPLY_TO_BASE") ?? remetente,
  };
}

/**
 * Message-ID com o token embutido: `<demanda.r<token>@dominio>`.
 *
 * O cliente responde para a própria caixa (Reply-To puro) e o programa de
 * e-mail dele devolve este Message-ID no In-Reply-To/References da resposta;
 * é por ali que o leitor acha a demanda.
 *
 * Até 14/10/2026 o token ia no endereço (`caixa+r<token>@dominio`). O Gmail
 * entrega o "+", a Hostinger não: desde a troca da conta, em 15/09/2026, toda
 * resposta voltava como "endereço não encontrado" (146 envios, 0 respostas).
 * O Message-ID não depende do provedor aceitar subendereço.
 */
export function messageIdDaMensagem(token: string, base: string): string | null {
  const at = base.lastIndexOf("@");
  if (at <= 0 || at === base.length - 1) return null;
  return `<demanda.r${token}@${base.slice(at + 1)}>`;
}
