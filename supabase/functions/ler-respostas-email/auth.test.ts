// bun test supabase/functions/ler-respostas-email/auth.test.ts

import { describe, expect, it } from "bun:test";

import { ehChamadaDeServico } from "./auth.ts";

/** JWT de mentira: só o payload importa, a assinatura quem confere é a plataforma. */
function jwt(payload: Record<string, unknown>): string {
  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return [b64url('{"alg":"HS256","typ":"JWT"}'), b64url(JSON.stringify(payload)), "assinatura"].join(
    ".",
  );
}

const CHAVE_NOVA = "sb_secret_abc123";

describe("ehChamadaDeServico", () => {
  it("aceita JWT com role service_role", () => {
    expect(ehChamadaDeServico(`Bearer ${jwt({ role: "service_role" })}`, null)).toBe(true);
  });

  it("aceita a chave de formato novo por igualdade", () => {
    expect(ehChamadaDeServico(`Bearer ${CHAVE_NOVA}`, CHAVE_NOVA)).toBe(true);
  });

  it("aceita a service_role legada mesmo quando o env está no formato novo", () => {
    // Era exatamente esse o caso que voltava 401
    expect(ehChamadaDeServico(`Bearer ${jwt({ role: "service_role" })}`, CHAVE_NOVA)).toBe(true);
  });

  it("recusa usuário logado", () => {
    expect(ehChamadaDeServico(`Bearer ${jwt({ role: "authenticated", sub: "u1" })}`, null)).toBe(
      false,
    );
  });

  it("recusa a chave anon", () => {
    expect(ehChamadaDeServico(`Bearer ${jwt({ role: "anon" })}`, CHAVE_NOVA)).toBe(false);
  });

  it("recusa vazio, lixo e token sem as tres partes", () => {
    expect(ehChamadaDeServico(null, CHAVE_NOVA)).toBe(false);
    expect(ehChamadaDeServico("", CHAVE_NOVA)).toBe(false);
    expect(ehChamadaDeServico("Bearer ", CHAVE_NOVA)).toBe(false);
    expect(ehChamadaDeServico("Bearer nao-e-jwt", CHAVE_NOVA)).toBe(false);
    expect(ehChamadaDeServico("Bearer a.b", CHAVE_NOVA)).toBe(false);
    expect(ehChamadaDeServico("Bearer a.###.c", CHAVE_NOVA)).toBe(false);
  });

  it("nao se confunde com payload que nao e objeto", () => {
    const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(ehChamadaDeServico(`Bearer x.${b64url('"service_role"')}.y`, null)).toBe(false);
  });

  it("aceita sem a palavra Bearer", () => {
    expect(ehChamadaDeServico(jwt({ role: "service_role" }), null)).toBe(true);
  });
});
