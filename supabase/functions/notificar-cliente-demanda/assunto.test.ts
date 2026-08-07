// bun test supabase/functions/notificar-cliente-demanda/assunto.test.ts
//
// O teste que faltava em 05/08. Ele guarda três coisas ao mesmo tempo:
// o assunto volta legível, cada encoded-word cabe no limite do RFC 2047, e o
// resultado NÃO dispara a re-codificação do denomailer — que foi o que mandou
// e-mail quebrado pra cliente.

import { describe, expect, it } from "bun:test";

import { codificarAssunto } from "./assunto.ts";
import { decodificarPalavrasCodificadas } from "../ler-respostas-email/mime.ts";

/**
 * A condição do denomailer 1.6.0 (config/mail/encoding.ts), reescrita sem
 * regex de faixa de controle:
 *
 *   if (hasNonAsciiCharacters(data) || data.startsWith("=?")) { re-codifica }
 */
function denomailerReCodificaria(valor: string): boolean {
  const temNaoAscii = [...valor].some((c) => c.charCodeAt(0) > 127);
  return temNaoAscii || valor.startsWith("=?");
}

const ACENTUADOS = [
  "Atualização da sua solicitação (DEM-0258)",
  "Ajuste no gráfico de Evolução de Vendas concluído",
  "Conclusão: implantação do módulo de cobrança automática já está disponível",
  "Ação",
  "çãõáéíóúàâêôü",
];

describe("codificarAssunto", () => {
  it("deixa ASCII puro intacto", () => {
    expect(codificarAssunto("Update on DEM-0258")).toBe("Update on DEM-0258");
  });

  it("não dispara a re-codificação do denomailer", () => {
    for (const assunto of ACENTUADOS) {
      expect(denomailerReCodificaria(codificarAssunto(assunto))).toBe(false);
    }
  });

  it("volta a ser o assunto original ao ser decodificado", () => {
    for (const assunto of ACENTUADOS) {
      expect(decodificarPalavrasCodificadas(codificarAssunto(assunto)).trim()).toBe(assunto);
    }
  });

  it("respeita os 75 caracteres por encoded-word do RFC 2047", () => {
    for (const assunto of ACENTUADOS) {
      for (const palavra of codificarAssunto(assunto).trim().split(" ")) {
        expect(palavra.length).toBeLessThanOrEqual(75);
        expect(palavra.startsWith("=?UTF-8?B?")).toBe(true);
        expect(palavra.endsWith("?=")).toBe(true);
      }
    }
  });

  it("não parte caractere multibyte no meio do bloco", () => {
    // 60 acentos seguidos: qualquer corte por byte cru quebraria um deles
    const assunto = "ç".repeat(60);
    expect(decodificarPalavrasCodificadas(codificarAssunto(assunto)).trim()).toBe(assunto);
  });

  it("a linha do cabeçalho cabe no limite de 998 do RFC 5322 e não tem quebra", () => {
    const linha = "Subject: " + codificarAssunto("Conclusão da implantação ".repeat(8));
    expect(linha.length).toBeLessThan(998);
    expect(linha.includes("\r")).toBe(false);
    expect(linha.includes("\n")).toBe(false);
  });
});
