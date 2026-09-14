// bun test supabase/functions/ler-respostas-email/conta.test.ts

import { describe, expect, it } from "bun:test";

import { type ContaEmail, credenciaisDeLeitura } from "./conta.ts";

const conta: ContaEmail = {
  email: "Suporte@Empresa.com.br",
  usuario: "suporte@empresa.com.br",
  imap_host: "imap.gmail.com",
  imap_porta: 993,
  imap_seguranca: "ssl",
  senha: "senha-da-tela",
};

const secrets: Record<string, string> = {
  SMTP_USER: "antiga@empresa.com.br",
  SMTP_PASS: "senha-dos-secrets",
};
const env = (valores: Record<string, string>) => (nome: string) => valores[nome] ?? null;

describe("credenciaisDeLeitura", () => {
  it("conta da tela vence os Secrets", () => {
    const r = credenciaisDeLeitura(conta, env(secrets));
    if (!r.ok) throw new Error(r.motivo);
    expect(r.credenciais.origem).toBe("tela");
    expect(r.credenciais.senha).toBe("senha-da-tela");
    expect(r.credenciais.nossoEndereco).toBe("suporte@empresa.com.br");
  });

  it("conta sem entrada não cai na caixa antiga dos Secrets", () => {
    const r = credenciaisDeLeitura({ ...conta, imap_host: null, imap_porta: null, imap_seguranca: null }, env(secrets));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.configurado).toBe(true);
  });

  it("entrada sem SSL é recusada com a saída na mensagem", () => {
    const r = credenciaisDeLeitura({ ...conta, imap_porta: 143, imap_seguranca: "starttls" }, env(secrets));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("SSL/TLS");
  });

  it("sem conta na tela, lê pelos Secrets como antes", () => {
    const r = credenciaisDeLeitura(null, env(secrets));
    if (!r.ok) throw new Error(r.motivo);
    expect(r.credenciais.origem).toBe("secrets");
    expect(r.credenciais.host).toBe("imap.gmail.com");
    expect(r.credenciais.porta).toBe(993);
    expect(r.credenciais.usuario).toBe("antiga@empresa.com.br");
  });

  it("sem conta e sem Secrets é pane de configuração", () => {
    const r = credenciaisDeLeitura(null, env({}));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.configurado).toBe(false);
  });
});
