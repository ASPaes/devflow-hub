// Teste da extração de anexos da resposta. Roda local, sem rede e sem Deno:
//   bun test supabase/functions/ler-respostas-email/
//
// O primeiro caso é o formato exato que o Gmail mandou na DEM-0379: a imagem
// colada no corpo vai como image/png inline dentro de multipart/related, e o
// text/plain fica só com "[image: image.png]".

import { describe, expect, it } from "bun:test";

import { bytesParaBinario, extrairAnexos, extrairTexto } from "./mime.ts";

const CRLF = "\r\n";
const juntar = (...linhas: string[]) => linhas.join(CRLF);

/** Bytes de teste e o base64 quebrado em 76 colunas, como vem no e-mail. */
function arquivo(tamanho: number, semente = 7) {
  const bytes = Uint8Array.from({ length: tamanho }, (_, i) => (i * semente + 13) % 256);
  const b64 = btoa(bytesParaBinario(bytes));
  const linhas = b64.match(/.{1,76}/g) ?? [];
  return { bytes, b64: linhas.join(CRLF) };
}

describe("extrairAnexos", () => {
  it("pega a imagem colada no corpo pelo Gmail (multipart/related)", () => {
    const img = arquivo(5000);
    const bruto = juntar(
      "From: Cliente <cliente@empresa.com.br>",
      'Content-Type: multipart/related; boundary="R"',
      "",
      "--R",
      'Content-Type: multipart/alternative; boundary="A"',
      "",
      "--A",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      "Fiz esse processo agora, porém não foi migrado:",
      "",
      "[image: image.png]",
      "",
      "--A",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      '<div>Fiz esse processo agora<img src="cid:ii_abc" alt="image.png"></div>',
      "--A--",
      "",
      "--R",
      'Content-Type: image/png; name="image.png"',
      'Content-Disposition: inline; filename="image.png"',
      "Content-Transfer-Encoding: base64",
      "Content-ID: <ii_abc>",
      "",
      img.b64,
      "--R--",
      "",
    );

    const anexos = extrairAnexos(bruto);
    expect(anexos).toHaveLength(1);
    expect(anexos[0].nome).toBe("image.png");
    expect(anexos[0].mime).toBe("image/png");
    expect(anexos[0].inline).toBe(true);
    expect(anexos[0].bytes).toEqual(img.bytes);

    // E o texto continua saindo do text/plain, sem o binário da imagem.
    expect(extrairTexto(bruto).texto).toContain("Fiz esse processo agora");
  });

  it("anexo de arquivo com nome RFC 2231 (Outlook)", () => {
    const pdf = arquivo(3000, 3);
    const bruto = juntar(
      'Content-Type: multipart/mixed; boundary="M"',
      "",
      "--M",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "Segue o relatório.",
      "--M",
      "Content-Type: application/pdf",
      "Content-Disposition: attachment; filename*=UTF-8''relat%C3%B3rio%20final.pdf",
      "Content-Transfer-Encoding: base64",
      "",
      pdf.b64,
      "--M--",
      "",
    );

    const [anexo] = extrairAnexos(bruto);
    expect(anexo.nome).toBe("relatório final.pdf");
    expect(anexo.mime).toBe("application/pdf");
    expect(anexo.inline).toBe(false);
    expect(anexo.bytes).toEqual(pdf.bytes);
  });

  it("junta nome RFC 2231 em continuação", () => {
    const bruto = juntar(
      'Content-Type: multipart/mixed; boundary="M"',
      "",
      "--M",
      "Content-Type: image/jpeg",
      "Content-Disposition: attachment; filename*0*=UTF-8''tela%20de; filename*1*=%20erro.jpg",
      "Content-Transfer-Encoding: base64",
      "",
      arquivo(3000).b64,
      "--M--",
      "",
    );

    expect(extrairAnexos(bruto)[0].nome).toBe("tela de erro.jpg");
  });

  it("decodifica nome RFC 2047 no Content-Type (Gmail com acento)", () => {
    const bruto = juntar(
      'Content-Type: multipart/mixed; boundary="M"',
      "",
      "--M",
      'Content-Type: image/png; name="=?UTF-8?B?Y2FwdHVyYS1lcnJvLnBuZw==?="',
      "Content-Transfer-Encoding: base64",
      "",
      arquivo(3000).b64,
      "--M--",
      "",
    );

    expect(extrairAnexos(bruto)[0].nome).toBe("captura-erro.png");
  });

  it("sem nome nenhum ganha nome pelo tipo", () => {
    const bruto = juntar(
      'Content-Type: multipart/related; boundary="R"',
      "",
      "--R",
      "Content-Type: text/plain",
      "",
      "Veja.",
      "--R",
      "Content-Type: image/png",
      "Content-Transfer-Encoding: base64",
      "",
      arquivo(3000).b64,
      "--R--",
      "",
    );

    const [anexo] = extrairAnexos(bruto);
    expect(anexo.nome).toBe("anexo-1.png");
    expect(anexo.inline).toBe(true);
  });

  it("não traz o corpo de texto nem o html como anexo", () => {
    const bruto = juntar(
      'Content-Type: multipart/alternative; boundary="A"',
      "",
      "--A",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "Só texto.",
      "--A",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<p>Só texto.</p>",
      "--A--",
      "",
    );

    expect(extrairAnexos(bruto)).toHaveLength(0);
  });

  it("não desce em e-mail encaminhado dentro da resposta", () => {
    const bruto = juntar(
      'Content-Type: multipart/mixed; boundary="M"',
      "",
      "--M",
      "Content-Type: text/plain",
      "",
      "Encaminho o que recebi.",
      "--M",
      "Content-Type: message/rfc822",
      "",
      'Content-Type: multipart/mixed; boundary="N"',
      "",
      "--N",
      "Content-Type: image/png",
      "Content-Disposition: attachment; filename=\"de-outro.png\"",
      "Content-Transfer-Encoding: base64",
      "",
      arquivo(3000).b64,
      "--N--",
      "--M--",
      "",
    );

    expect(extrairAnexos(bruto)).toHaveLength(0);
  });
});
