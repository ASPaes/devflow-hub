// bun test supabase/functions/notificar-cliente-demanda/conta.test.ts

import { describe, expect, it } from "bun:test";

import { type ContaEmail, credenciaisDeEnvio, enderecoDeResposta } from "./conta.ts";

const conta: ContaEmail = {
  email: "suporte@empresa.com.br",
  nome_remetente: null,
  usuario: "suporte@empresa.com.br",
  smtp_host: "smtp.gmail.com",
  smtp_porta: 465,
  smtp_seguranca: "ssl",
  senha: "senha-da-tela",
};

const secrets: Record<string, string> = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "antiga@empresa.com.br",
  SMTP_PASS: "senha-dos-secrets",
};
const env = (valores: Record<string, string>) => (nome: string) => valores[nome] ?? null;

describe("credenciaisDeEnvio", () => {
  it("conta da tela vence os Secrets", () => {
    const c = credenciaisDeEnvio(conta, env(secrets))!;
    expect(c.origem).toBe("tela");
    expect(c.senha).toBe("senha-da-tela");
    expect(c.remetente).toBe("suporte@empresa.com.br");
    expect(c.baseResposta).toBe("suporte@empresa.com.br");
    expect(c.nomeRemetente).toBe("DoctorDev");
    expect(c.tls).toBe(true);
  });

  it("REPLY_TO_BASE dos Secrets não desvia a resposta da conta da tela", () => {
    const c = credenciaisDeEnvio(conta, env({ ...secrets, REPLY_TO_BASE: "outra@empresa.com.br" }))!;
    expect(c.baseResposta).toBe("suporte@empresa.com.br");
  });

  it("STARTTLS e sem criptografia conectam limpo", () => {
    expect(credenciaisDeEnvio({ ...conta, smtp_porta: 587, smtp_seguranca: "starttls" }, env({}))!.tls).toBe(false);
    expect(credenciaisDeEnvio({ ...conta, smtp_porta: 25, smtp_seguranca: "none" }, env({}))!.tls).toBe(false);
  });

  it("sem conta na tela, usa os Secrets como antes", () => {
    const c = credenciaisDeEnvio(null, env(secrets))!;
    expect(c.origem).toBe("secrets");
    expect(c.usuario).toBe("antiga@empresa.com.br");
    expect(c.remetente).toBe("antiga@empresa.com.br");
    expect(c.porta).toBe(587);
    expect(c.tls).toBe(false);
  });

  it("sem conta e sem Secrets, não inventa credencial", () => {
    expect(credenciaisDeEnvio(null, env({}))).toBeNull();
    expect(credenciaisDeEnvio(null, env({ ...secrets, SMTP_PASS: "" }))).toBeNull();
  });
});

describe("enderecoDeResposta", () => {
  it("planta o token na caixa da base", () => {
    expect(enderecoDeResposta("abc123", "suporte@empresa.com.br")).toBe("suporte+rabc123@empresa.com.br");
  });

  it("base inválida ou longa demais não gera Reply-To", () => {
    expect(enderecoDeResposta("abc", "sem-arroba")).toBeNull();
    expect(enderecoDeResposta("0123456789abcdef", `${"a".repeat(50)}@empresa.com.br`)).toBeNull();
  });
});
