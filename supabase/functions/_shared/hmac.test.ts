// supabase/functions/_shared/hmac.test.ts
import { describe, it, expect } from "vitest";
import { assinarPayload, verificarAssinatura } from "./hmac";

describe("hmac", () => {
  const secret = "s3gr3d0-de-teste";
  const payload = '{"execucao_id":"abc","status":"corrigindo"}';

  it("assina de forma determinística (hex de 64 chars)", async () => {
    const a = await assinarPayload(secret, payload);
    const b = await assinarPayload(secret, payload);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifica assinatura válida", async () => {
    const sig = await assinarPayload(secret, payload);
    expect(await verificarAssinatura(secret, payload, sig)).toBe(true);
  });

  it("rejeita assinatura com secret errado", async () => {
    const sig = await assinarPayload("outro", payload);
    expect(await verificarAssinatura(secret, payload, sig)).toBe(false);
  });

  it("rejeita payload adulterado", async () => {
    const sig = await assinarPayload(secret, payload);
    expect(await verificarAssinatura(secret, payload + "x", sig)).toBe(false);
  });
});
