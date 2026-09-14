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
  /** caixa onde o cliente responde; o token entra como caixa+r<token>@dominio */
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
 * Endereço de resposta com o token embutido: `caixa+r<token>@dominio`.
 * O cliente responde pra lá, o leitor de IMAP acha o token e sabe de qual
 * demanda é a resposta.
 */
export function enderecoDeResposta(token: string, base: string): string | null {
  const at = base.lastIndexOf("@");
  if (at <= 0) return null;

  const local = base.slice(0, at);
  const dominio = base.slice(at + 1);
  // Local part do RFC 5321 para em 64 caracteres. Estourar aqui é erro de
  // configuração (caixa com nome enorme), não do cliente — melhor não mandar
  // Reply-To nenhum do que mandar um endereço que quica.
  if (local.length + 2 + token.length > 64) return null;

  return `${local}+r${token}@${dominio}`;
}
