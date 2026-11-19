/**
 * Monta a mensagem de e-mail (RFC 5322 + MIME) que vai no DATA do SMTP.
 *
 * Arquivo separado para o mensagem.test.ts rodar no bun, sem rede e sem Deno.
 *
 * Até 19/11/2026 quem montava era o denomailer. Ele saiu por causa da DEM-0666
 * (ver smtp-envio.ts). Aqui o texto e o HTML vão em base64: o resultado é
 * ASCII puro, com linhas curtas, e nenhuma linha começa com ponto.
 */

import { codificarAssunto } from "./assunto.ts";

export interface DadosMensagem {
  remetente: string;
  nomeRemetente: string;
  destino: string;
  responderPara: string;
  assunto: string;
  texto: string;
  html: string;
  messageId: string;
  data: Date;
  /** separador do multipart; fixo nos testes, aleatório no envio */
  fronteira: string;
}

const enc = new TextEncoder();

function base64Utf8(s: string): string {
  let bin = "";
  for (const b of enc.encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** base64 quebrado em linhas de 76 (RFC 2045) */
function base64EmLinhas(s: string): string {
  return (base64Utf8(s).match(/.{1,76}/g) ?? [""]).join("\r\n");
}

/** Cabeçalho com acento vira encoded-word; ASCII passa direto. */
function cabecalhoTexto(s: string): string {
  return codificarAssunto(s).trim();
}

/** Nome de exibição: ASCII vai entre aspas (vírgula e ponto quebrariam o From), acento vira encoded-word. */
function nomeExibicao(nome: string): string {
  const limpo = nome.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(limpo)) return `"${limpo.replace(/(["\\])/g, "\\$1")}"`;
  return cabecalhoTexto(limpo);
}

/** Data no formato do RFC 5322: "Wed, 19 Nov 2026 03:41:03 +0000". */
export function dataRfc5322(d: Date): string {
  return d.toUTCString().replace(/GMT$/, "+0000");
}

/** Linha de cabeçalho não pode carregar quebra (injeção de cabeçalho). */
function semQuebra(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

export function montarMensagem(m: DadosMensagem): string {
  const cabecalhos = [
    `From: ${nomeExibicao(m.nomeRemetente)} <${semQuebra(m.remetente)}>`,
    `To: <${semQuebra(m.destino)}>`,
    `Reply-To: <${semQuebra(m.responderPara)}>`,
    `Subject: ${cabecalhoTexto(semQuebra(m.assunto))}`,
    `Date: ${dataRfc5322(m.data)}`,
    `Message-ID: ${semQuebra(m.messageId)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${m.fronteira}"`,
  ];

  const parte = (tipo: string, conteudo: string) => [
    `--${m.fronteira}`,
    `Content-Type: ${tipo}; charset="utf-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64EmLinhas(conteudo),
  ];

  return [
    ...cabecalhos,
    "",
    ...parte("text/plain", m.texto),
    ...parte("text/html", m.html),
    `--${m.fronteira}--`,
    "",
  ].join("\r\n");
}

/**
 * Prepara para o DATA: normaliza quebra para CRLF, dobra o ponto no começo de
 * linha (RFC 5321 §4.5.2) e fecha com "<CRLF>.<CRLF>".
 */
export function paraData(mensagem: string): string {
  const crlf = mensagem.replace(/\r?\n/g, "\r\n");
  const comPonto = crlf.replace(/^\./gm, "..");
  return (comPonto.endsWith("\r\n") ? comPonto : comPonto + "\r\n") + ".\r\n";
}
