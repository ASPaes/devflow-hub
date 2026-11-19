// bun test supabase/functions/notificar-cliente-demanda/prazo.test.ts

import { describe, expect, it } from "bun:test";

import { comPrazo, erroDePrazo, PrazoEsgotado } from "./prazo.ts";

describe("comPrazo", () => {
  it("devolve o resultado quando chega antes do prazo", async () => {
    await expect(comPrazo(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("repassa o erro da promessa quando ela falha antes do prazo", async () => {
    await expect(comPrazo(Promise.reject(new Error("535 auth")), 50)).rejects.toThrow("535 auth");
  });

  it("rejeita com PrazoEsgotado quando a promessa nunca termina", async () => {
    const nunca = new Promise<void>(() => {});
    await expect(comPrazo(nunca, 20)).rejects.toBeInstanceOf(PrazoEsgotado);
  });

  it("não deixa rejeição solta quando a promessa perde e falha depois", async () => {
    let soltas = 0;
    const contar = () => soltas++;
    process.on("unhandledRejection", contar);
    const tardia = new Promise<void>((_, rej) => setTimeout(() => rej(new Error("tarde")), 30));
    await expect(comPrazo(tardia, 5)).rejects.toBeInstanceOf(PrazoEsgotado);
    await new Promise((r) => setTimeout(r, 60));
    process.off("unhandledRejection", contar);
    expect(soltas).toBe(0);
  });
});

describe("erroDePrazo", () => {
  it("diz o servidor, o tempo e que o e-mail pode ter saído", () => {
    const m = erroDePrazo(25_000, "smtp.hostinger.com");
    expect(m).toContain("smtp.hostinger.com");
    expect(m).toContain("25 s");
    expect(m).toContain("enviados");
    expect(m).not.toContain("—");
  });
});
