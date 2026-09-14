/**
 * De onde sai a caixa que o leitor abre.
 *
 * 1º a conta da tela Configurações › E-mail (public.email_conta).
 * 2º os Secrets IMAP_* / SMTP_* de antes, só enquanto ninguém cadastrou a conta.
 *
 * Conta da tela sem servidor de entrada NÃO cai nos Secrets: seria ler a caixa
 * antiga, de outra conta, e registrar como se fosse a atual.
 *
 * Par do notificar-cliente-demanda/conta.ts. Fora de _shared de propósito:
 * mexer em _shared republica todas as functions do repo.
 */

export interface ContaEmail {
  email: string;
  usuario: string;
  imap_host: string | null;
  imap_porta: number | null;
  imap_seguranca: "ssl" | "starttls" | "none" | null;
  senha: string;
}

export interface CredenciaisLeitura {
  origem: "tela" | "secrets";
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  /** mensagem com esse remetente é nossa, não resposta de cliente */
  nossoEndereco: string;
}

export type ResultadoLeitura =
  | { ok: true; credenciais: CredenciaisLeitura }
  /** `configurado` = a conta existe e escolheu não ler (ou não dá para ler): não é pane. */
  | { ok: false; motivo: string; configurado: boolean };

export function credenciaisDeLeitura(
  conta: ContaEmail | null,
  env: (nome: string) => string | null,
): ResultadoLeitura {
  if (conta) {
    if (!conta.imap_host) {
      return {
        ok: false,
        configurado: true,
        motivo:
          "A conta de e-mail não tem servidor de entrada: as respostas dos clientes não estão sendo lidas.",
      };
    }
    // ClienteImap (imap.ts) só abre TLS direto.
    if (conta.imap_seguranca !== "ssl") {
      return {
        ok: false,
        configurado: true,
        motivo:
          "O DoctorDev só lê a caixa de entrada com SSL/TLS. Troque a segurança da entrada para SSL/TLS (porta 993).",
      };
    }
    return {
      ok: true,
      credenciais: {
        origem: "tela",
        host: conta.imap_host,
        porta: conta.imap_porta ?? 993,
        usuario: conta.usuario,
        senha: conta.senha,
        nossoEndereco: conta.email.toLowerCase(),
      },
    };
  }

  const usuario = env("IMAP_USER") ?? env("SMTP_USER");
  const senha = env("IMAP_PASS") ?? env("SMTP_PASS");
  if (!usuario || !senha) {
    return {
      ok: false,
      configurado: false,
      motivo: "IMAP não configurado: cadastre a conta de e-mail em Configurações › E-mail",
    };
  }

  return {
    ok: true,
    credenciais: {
      origem: "secrets",
      host: env("IMAP_HOST") ?? "imap.gmail.com",
      porta: Number(env("IMAP_PORT") ?? "993"),
      usuario,
      senha,
      nossoEndereco: (env("REPLY_TO_BASE") ?? env("SMTP_FROM") ?? usuario).toLowerCase(),
    },
  };
}
