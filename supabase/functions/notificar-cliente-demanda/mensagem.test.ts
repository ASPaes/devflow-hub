// bun test supabase/functions/notificar-cliente-demanda/mensagem.test.ts

import { describe, expect, it } from "bun:test";

import { dataRfc5322, montarMensagem, paraData } from "./mensagem.ts";
import { codigoDaResposta, respostaCompleta } from "./smtp-envio.ts";

const base = {
  remetente: "dev@doctorsaas.com.br",
  nomeRemetente: "DoctorDev",
  destino: "suporte@quantixtecnologia.com.br",
  responderPara: "dev@doctorsaas.com.br",
  assunto: "Mensagens de fim de atendimento agora podem ser editadas (DEM-0666)",
  texto: "Olá,\n\nA melhoria que você pediu foi publicada.\n.linha que começa com ponto",
  html: "<p>Olá</p>",
  messageId: "<demanda.rabc123@doctorsaas.com.br>",
  data: new Date(Date.UTC(2026, 10, 19, 3, 41, 3)),
  fronteira: "=_fronteira",
};

function decodificarParte(msg: string, tipo: string): string {
  const ini = msg.indexOf(`Content-Type: ${tipo}`);
  const corpo = msg.slice(msg.indexOf("\r\n\r\n", ini) + 4, msg.indexOf("\r\n--=_fronteira", ini));
  const bin = atob(corpo.replace(/\r\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

describe("montarMensagem", () => {
  const msg = montarMensagem(base);

  it("tem os cabeçalhos que o leitor de respostas precisa", () => {
    expect(msg).toContain("Message-ID: <demanda.rabc123@doctorsaas.com.br>\r\n");
    expect(msg).toContain("Reply-To: <dev@doctorsaas.com.br>\r\n");
    expect(msg).toContain('From: "DoctorDev" <dev@doctorsaas.com.br>\r\n');
    expect(msg).toContain("To: <suporte@quantixtecnologia.com.br>\r\n");
    expect(msg).toContain("Date: Thu, 19 Nov 2026 03:41:03 +0000\r\n");
  });

  it("assunto ASCII passa direto; com acento vira encoded-word sem espaço na frente", () => {
    expect(msg).toContain(`Subject: ${base.assunto}\r\n`);
    const acento = montarMensagem({ ...base, assunto: "Atualização da sua solicitação" });
    expect(acento).toMatch(/\r\nSubject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  });

  it("é ASCII puro e texto/HTML voltam iguais depois do base64", () => {
    expect(/^[\x00-\x7F]*$/.test(msg)).toBe(true);
    expect(decodificarParte(msg, "text/plain")).toBe(base.texto);
    expect(decodificarParte(msg, "text/html")).toBe(base.html);
  });

  it("nenhuma linha passa de 998 caracteres", () => {
    const grande = montarMensagem({ ...base, texto: "palavra ".repeat(5000) });
    expect(Math.max(...grande.split("\r\n").map((l) => l.length))).toBeLessThanOrEqual(998);
  });

  it("quebra de linha em cabeçalho não injeta cabeçalho novo", () => {
    const m = montarMensagem({ ...base, assunto: "Oi\r\nBcc: x@y.com" });
    expect(m).not.toContain("\r\nBcc:");
  });

  it("nome de remetente com acento vira encoded-word", () => {
    const m = montarMensagem({ ...base, nomeRemetente: "Suporte Técnico" });
    expect(m).toMatch(/From: =\?UTF-8\?B\?[^ ]+\?= <dev@doctorsaas.com.br>/);
  });
});

describe("paraData", () => {
  it("dobra ponto no começo de linha e fecha com CRLF.CRLF", () => {
    expect(paraData("a\r\n.b\r\nc")).toBe("a\r\n..b\r\nc\r\n.\r\n");
  });
});

describe("dataRfc5322", () => {
  it("usa +0000 no lugar de GMT", () => {
    expect(dataRfc5322(new Date(0))).toBe("Thu, 01 Jan 1970 00:00:00 +0000");
  });
});

describe("resposta SMTP", () => {
  it("só fecha quando a última linha tem espaço após o código", () => {
    expect(respostaCompleta("250-mail.hostinger.com\r\n")).toBe(false);
    expect(respostaCompleta("250-mail.hostinger.com\r\n250 AUTH LOGIN\r\n")).toBe(true);
    expect(respostaCompleta("250 OK")).toBe(false); // linha ainda não chegou inteira
    expect(codigoDaResposta("250-a\r\n554 5.7.1 recusado\r\n")).toBe(554);
  });
});
