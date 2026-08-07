// Teste do parser de MIME. Roda local, sem rede e sem Deno:
//   bun test supabase/functions/ler-respostas-email/mime.test.ts
//
// As fixtures são o formato que o Gmail e o Outlook realmente mandam — é isso
// que o leitor vai encontrar na caixa.

import { describe, expect, it } from "bun:test";

import {
  bytesParaBinario,
  cabecalho,
  decodificarPalavrasCodificadas,
  ehAutomatica,
  extrairEndereco,
  extrairReplyToken,
  extrairTexto,
  htmlParaTexto,
  parseCabecalhos,
  removerCitacao,
} from "./mime.ts";

const CRLF = "\r\n";
const juntar = (...linhas: string[]) => linhas.join(CRLF);

describe("cabeçalhos", () => {
  it("junta linha dobrada", () => {
    const h = parseCabecalhos(
      juntar("Subject: Atualização da sua", "  solicitação (DEM-0258)", "From: a@b.com"),
    );
    expect(cabecalho(h, "subject")).toBe("Atualização da sua solicitação (DEM-0258)");
    expect(cabecalho(h, "FROM")).toBe("a@b.com");
  });

  it("guarda repetidos", () => {
    const h = parseCabecalhos(juntar("Received: um", "Received: dois"));
    expect(h.get("received")).toEqual(["um", "dois"]);
  });
});

describe("RFC 2047", () => {
  it("decodifica base64 com acento", () => {
    expect(decodificarPalavrasCodificadas("=?UTF-8?B?QXR1YWxpemHDp8Ojbw==?=")).toBe("Atualização");
  });

  it("decodifica Q e trata _ como espaço", () => {
    expect(decodificarPalavrasCodificadas("=?utf-8?Q?Jo=C3=A3o_Silva?=")).toBe("João Silva");
  });

  it("cola blocos vizinhos sem inventar espaço", () => {
    const s = "=?UTF-8?B?QXR1YWxpemE=?= =?UTF-8?B?w6fDo28=?=";
    expect(decodificarPalavrasCodificadas(s)).toBe("Atualização");
  });

  it("não mexe em ASCII puro", () => {
    expect(decodificarPalavrasCodificadas("Re: DEM-0258")).toBe("Re: DEM-0258");
  });
});

describe("extrairTexto", () => {
  it("pega o text/plain do multipart/alternative do Gmail", () => {
    const bruto = juntar(
      "From: Cliente <cliente@empresa.com.br>",
      'Content-Type: multipart/alternative; boundary="000000000000abc"',
      "",
      "--000000000000abc",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Perfeito, pode seguir. Obrigado pela aten=C3=A7=C3=A3o!",
      "",
      "--000000000000abc",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<div>Perfeito, pode seguir.</div>",
      "",
      "--000000000000abc--",
      "",
    );

    const { texto, origem } = extrairTexto(bruto);
    expect(origem).toBe("text/plain");
    expect(texto.trim()).toBe("Perfeito, pode seguir. Obrigado pela atenção!");
  });

  it("cai para o html quando não tem text/plain", () => {
    const bruto = juntar(
      'Content-Type: multipart/alternative; boundary="X"',
      "",
      "--X",
      "Content-Type: text/html; charset=UTF-8",
      "",
      "<p>Bom dia</p><p>Est&aacute; aprovado</p>",
      "--X--",
      "",
    );

    const { texto, origem } = extrairTexto(bruto);
    expect(origem).toBe("text/html");
    expect(texto).toContain("Bom dia");
    expect(texto).toContain("aprovado");
  });

  it("decodifica base64 em iso-8859-1", () => {
    // "Alteração conclu" em latin-1
    const latin1 = "Alteração OK";
    const bytes = Uint8Array.from([...latin1].map((c) => c.charCodeAt(0)));
    const b64 = btoa(bytesParaBinario(bytes));

    const bruto = juntar(
      "Content-Type: text/plain; charset=iso-8859-1",
      "Content-Transfer-Encoding: base64",
      "",
      b64,
      "",
    );

    expect(extrairTexto(bruto).texto.trim()).toBe("Alteração OK");
  });

  it("ignora anexo e acha o texto no multipart/mixed", () => {
    const bruto = juntar(
      'Content-Type: multipart/mixed; boundary="M"',
      "",
      "--M",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "Segue o print.",
      "--M",
      "Content-Type: image/png",
      'Content-Disposition: attachment; filename="print.png"',
      "Content-Transfer-Encoding: base64",
      "",
      "iVBORw0KGgo=",
      "--M--",
      "",
    );

    expect(extrairTexto(bruto).texto.trim()).toBe("Segue o print.");
  });

  it("mensagem simples sem multipart", () => {
    const bruto = juntar("Content-Type: text/plain; charset=UTF-8", "", "ok, obrigado", "");
    expect(extrairTexto(bruto).texto.trim()).toBe("ok, obrigado");
  });
});

describe("removerCitacao", () => {
  it("corta o bloco do Gmail", () => {
    const texto = [
      "Pode publicar, está aprovado.",
      "",
      "Em qua., 6 de ago. de 2026 às 14:03, DoctorDev <suporte@asp.com.br> escreveu:",
      "",
      "> Sua solicitação DEM-0258 foi concluída.",
      "> Qualquer coisa é só responder.",
    ].join("\n");

    expect(removerCitacao(texto)).toBe("Pode publicar, está aprovado.");
  });

  it("corta o bloco do Outlook", () => {
    const texto = [
      "Ok",
      "",
      "________________________________",
      "De: DoctorDev <suporte@asp.com.br>",
      "Enviada em: quarta-feira, 6 de agosto de 2026 14:03",
    ].join("\n");

    expect(removerCitacao(texto)).toBe("Ok");
  });

  it("corta assinatura", () => {
    const texto = ["Fechado!", "", "--", "João Silva", "Gerente"].join("\n");
    expect(removerCitacao(texto)).toBe("Fechado!");
  });

  it("devolve o original quando a resposta é só citação", () => {
    const texto = "> tudo certo por aqui";
    expect(removerCitacao(texto)).toBe("> tudo certo por aqui");
  });

  it("não mexe em resposta sem citação", () => {
    expect(removerCitacao("Só isso mesmo, obrigado.")).toBe("Só isso mesmo, obrigado.");
  });
});

describe("token do Reply-To", () => {
  it("acha no To", () => {
    const h = parseCabecalhos("To: DoctorDev <suporte+r0a1b2c3d4e5f6789@asp.com.br>");
    expect(extrairReplyToken(h)).toBe("0a1b2c3d4e5f6789");
  });

  it("acha no Delivered-To quando o To veio limpo", () => {
    const h = parseCabecalhos(
      juntar("To: suporte@asp.com.br", "Delivered-To: suporte+rAABBCCDDEEFF0011@asp.com.br"),
    );
    expect(extrairReplyToken(h)).toBe("aabbccddeeff0011");
  });

  it("devolve null sem token", () => {
    expect(extrairReplyToken(parseCabecalhos("To: suporte@asp.com.br"))).toBeNull();
  });

  it("não confunde outro sufixo", () => {
    expect(extrairReplyToken(parseCabecalhos("To: suporte+relatorio@asp.com.br"))).toBeNull();
  });
});

describe("remetente", () => {
  it("separa nome e e-mail", () => {
    expect(extrairEndereco('"Silva, João" <Joao.Silva@Empresa.com.BR>')).toEqual({
      nome: "Silva, João",
      email: "joao.silva@empresa.com.br",
    });
  });

  it("aceita endereço solto", () => {
    expect(extrairEndereco("cliente@empresa.com")).toEqual({
      nome: null,
      email: "cliente@empresa.com",
    });
  });

  it("decodifica nome com acento", () => {
    expect(extrairEndereco("=?UTF-8?B?Sm/Do28=?= <j@e.com>").nome).toBe("João");
  });
});

describe("automática", () => {
  it("pega auto-submitted", () => {
    expect(ehAutomatica(parseCabecalhos("Auto-Submitted: auto-replied"))).toBe(true);
  });

  it("pega bounce", () => {
    expect(ehAutomatica(parseCabecalhos("Return-Path: <>"))).toBe(true);
  });

  it("deixa passar resposta de gente", () => {
    const h = parseCabecalhos(juntar("From: a@b.com", "Auto-Submitted: no"));
    expect(ehAutomatica(h)).toBe(false);
  });
});

describe("htmlParaTexto", () => {
  it("quebra linha e resolve entidade", () => {
    expect(htmlParaTexto("<p>Ol&aacute;</p><p>tudo&nbsp;bem?<br>at&eacute; logo</p>")).toBe(
      "Olá\n\ntudo bem?\naté logo",
    );
  });
});
