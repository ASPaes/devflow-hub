// O pedaço de RFC 5322 / 2045 / 2047 que a gente precisa para ler uma resposta
// de e-mail: cabeçalhos, o texto que está dentro do multipart, e o corte da
// citação que o cliente deixa pendurada embaixo.
//
// Sem dependência externa e sem `Deno.*`: roda na edge function e no bun do
// teste local (mime.test.ts).
//
// Convenção do arquivo: mensagem crua trafega como *string binária* — um
// caractere por byte, code point 0–255. É lossless, diferente de decodificar
// tudo como UTF-8 na entrada, e deixa a decodificação de charset para o fim,
// quando o Content-Type já disse qual é.

export type Cabecalhos = Map<string, string[]>;

// ──────────────────────────────────────────────────────────────────────
// Bytes ↔ string binária
// ──────────────────────────────────────────────────────────────────────

export function bytesParaBinario(bytes: Uint8Array): string {
  // Em pedaços: `String.fromCharCode(...arrayGigante)` estoura a pilha.
  const PEDACO = 8192;
  let saida = "";
  for (let i = 0; i < bytes.length; i += PEDACO) {
    saida += String.fromCharCode(...bytes.subarray(i, i + PEDACO));
  }
  return saida;
}

export function binarioParaBytes(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  return bytes;
}

function decodificarComCharset(bytes: Uint8Array, charset: string | null): string {
  const rotulo = (charset ?? "utf-8").toLowerCase().trim();
  try {
    return new TextDecoder(rotulo, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Cabeçalhos
// ──────────────────────────────────────────────────────────────────────

/** Separa a mensagem (ou a parte) em bloco de cabeçalhos e corpo. */
export function separarMensagem(bruto: string): { cabecalhos: Cabecalhos; corpo: string } {
  let corte = bruto.indexOf("\r\n\r\n");
  let tamanho = 4;
  if (corte < 0) {
    corte = bruto.indexOf("\n\n");
    tamanho = 2;
  }
  if (corte < 0) return { cabecalhos: parseCabecalhos(bruto), corpo: "" };

  return {
    cabecalhos: parseCabecalhos(bruto.slice(0, corte)),
    corpo: bruto.slice(corte + tamanho),
  };
}

export function parseCabecalhos(bloco: string): Cabecalhos {
  const mapa: Cabecalhos = new Map();
  const linhas = bloco.split(/\r?\n/);
  const dobradas: string[] = [];

  for (const linha of linhas) {
    // Linha que começa com espaço/tab é continuação da anterior (folding)
    if (/^[ \t]/.test(linha) && dobradas.length > 0) {
      dobradas[dobradas.length - 1] += " " + linha.trim();
    } else if (linha.trim() !== "") {
      dobradas.push(linha);
    }
  }

  for (const linha of dobradas) {
    const sep = linha.indexOf(":");
    if (sep <= 0) continue;
    const nome = linha.slice(0, sep).trim().toLowerCase();
    const valor = linha.slice(sep + 1).trim();
    const atual = mapa.get(nome);
    if (atual) atual.push(valor);
    else mapa.set(nome, [valor]);
  }

  return mapa;
}

export function cabecalho(h: Cabecalhos, nome: string): string | null {
  return h.get(nome.toLowerCase())?.[0] ?? null;
}

export function cabecalhos(h: Cabecalhos, nome: string): string[] {
  return h.get(nome.toLowerCase()) ?? [];
}

// ──────────────────────────────────────────────────────────────────────
// RFC 2047 — assunto e nome com acento
// ──────────────────────────────────────────────────────────────────────

export function decodificarPalavrasCodificadas(s: string): string {
  if (!s.includes("=?")) return s;

  // Espaço entre dois encoded-words vizinhos não conta como espaço de verdade.
  const semEspacoEntre = s.replace(/\?=[ \t]+=\?/g, "?==?");

  return semEspacoEntre.replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (inteiro, charset: string, tipo: string, conteudo: string) => {
      try {
        let binario: string;
        if (tipo.toLowerCase() === "b") {
          binario = atob(conteudo.replace(/\s+/g, ""));
        } else {
          // Q: como quoted-printable, mas "_" é espaço
          binario = conteudo
            .replace(/_/g, " ")
            .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
        return decodificarComCharset(binarioParaBytes(binario), charset);
      } catch {
        return inteiro;
      }
    },
  );
}

// ──────────────────────────────────────────────────────────────────────
// Content-Type / Content-Transfer-Encoding
// ──────────────────────────────────────────────────────────────────────

export function parseContentType(valor: string | null): {
  tipo: string;
  parametros: Record<string, string>;
} {
  if (!valor) return { tipo: "text/plain", parametros: {} };

  const partes = dividirRespeitandoAspas(valor, ";");
  const tipo = (partes.shift() ?? "text/plain").trim().toLowerCase();
  const parametros: Record<string, string> = {};

  for (const parte of partes) {
    const sep = parte.indexOf("=");
    if (sep <= 0) continue;
    const chave = parte.slice(0, sep).trim().toLowerCase();
    let bruto = parte.slice(sep + 1).trim();
    if (bruto.startsWith('"') && bruto.endsWith('"') && bruto.length >= 2) {
      bruto = bruto.slice(1, -1).replace(/\\(.)/g, "$1");
    }
    parametros[chave] = bruto;
  }

  return { tipo, parametros };
}

function dividirRespeitandoAspas(s: string, separador: string): string[] {
  const saida: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== "\\") dentroDeAspas = !dentroDeAspas;
    if (c === separador && !dentroDeAspas) {
      saida.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  saida.push(atual);
  return saida;
}

function decodificarQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, "") // soft line break
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Corpo de uma parte folha → texto legível. Entra string binária, sai string. */
export function decodificarCorpo(
  corpoBinario: string,
  transferencia: string | null,
  charset: string | null,
): string {
  const cte = (transferencia ?? "7bit").toLowerCase().trim();
  let binario: string;

  if (cte === "base64") {
    try {
      binario = atob(corpoBinario.replace(/\s+/g, ""));
    } catch {
      binario = corpoBinario;
    }
  } else if (cte === "quoted-printable") {
    binario = decodificarQuotedPrintable(corpoBinario);
  } else {
    binario = corpoBinario;
  }

  return decodificarComCharset(binarioParaBytes(binario), charset).replace(/\r\n/g, "\n");
}

// ──────────────────────────────────────────────────────────────────────
// Achar o texto dentro do multipart
// ──────────────────────────────────────────────────────────────────────

/**
 * Devolve o melhor texto legível da mensagem: text/plain quando existe,
 * text/html convertido quando é só o que tem.
 */
export function extrairTexto(brutoBinario: string): {
  cabecalhos: Cabecalhos;
  texto: string;
  origem: "text/plain" | "text/html" | "vazio";
} {
  const { cabecalhos: h, corpo } = separarMensagem(brutoBinario);
  const achado = percorrer(h, corpo, 0);
  return { cabecalhos: h, texto: achado.texto, origem: achado.origem };
}

function percorrer(
  h: Cabecalhos,
  corpo: string,
  profundidade: number,
): { texto: string; origem: "text/plain" | "text/html" | "vazio" } {
  // Anexo de e-mail pode aninhar multipart sem fim; 12 níveis é folgado.
  if (profundidade > 12) return { texto: "", origem: "vazio" };

  const { tipo, parametros } = parseContentType(cabecalho(h, "content-type"));
  const disposicao = (cabecalho(h, "content-disposition") ?? "").toLowerCase();

  if (tipo.startsWith("multipart/")) {
    const fronteira = parametros["boundary"];
    if (!fronteira) return { texto: "", origem: "vazio" };

    const partes = separarPartes(corpo, fronteira);
    let melhorHtml = "";

    for (const parte of partes) {
      const { cabecalhos: ph, corpo: pc } = separarMensagem(parte);
      const achado = percorrer(ph, pc, profundidade + 1);
      if (achado.origem === "text/plain" && achado.texto.trim() !== "") return achado;
      if (achado.origem === "text/html" && melhorHtml === "") melhorHtml = achado.texto;
    }

    return melhorHtml !== ""
      ? { texto: melhorHtml, origem: "text/html" }
      : { texto: "", origem: "vazio" };
  }

  // Anexo não é resposta
  if (disposicao.startsWith("attachment")) return { texto: "", origem: "vazio" };

  const cte = cabecalho(h, "content-transfer-encoding");
  const charset = parametros["charset"] ?? null;

  if (tipo === "text/plain") {
    return { texto: decodificarCorpo(corpo, cte, charset), origem: "text/plain" };
  }
  if (tipo === "text/html") {
    return { texto: htmlParaTexto(decodificarCorpo(corpo, cte, charset)), origem: "text/html" };
  }

  return { texto: "", origem: "vazio" };
}

function separarPartes(corpo: string, fronteira: string): string[] {
  const marca = "--" + fronteira;
  const bruto = corpo.split(marca);
  // O primeiro pedaço é o preâmbulo e o último começa com "--" (epílogo).
  const partes: string[] = [];

  for (let i = 1; i < bruto.length; i++) {
    const pedaco = bruto[i];
    if (pedaco.startsWith("--")) break; // fronteira final
    partes.push(pedaco.replace(/^\r?\n/, ""));
  }

  return partes;
}

// ──────────────────────────────────────────────────────────────────────
// HTML → texto
// ──────────────────────────────────────────────────────────────────────

const ENTIDADES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  deg: "°",
  ordm: "º",
  ordf: "ª",
  euro: "€",
  reg: "®",
  copy: "©",
  trade: "™",
};

// &aacute; &ccedil; &otilde; … — em vez de tabelar as 60 combinações, monta a
// letra com o diacrítico combinante e normaliza.
const DIACRITICOS: Record<string, string> = {
  acute: "́",
  grave: "̀",
  circ: "̂",
  uml: "̈",
  tilde: "̃",
  ring: "̊",
  cedil: "̧",
};

export function decodificarEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(
      /&([a-zA-Z])(acute|grave|circ|uml|tilde|ring|cedil);/g,
      (inteiro, letra: string, marca: string) =>
        (letra + DIACRITICOS[marca]).normalize("NFC") || inteiro,
    )
    .replace(/&([a-z]+);/gi, (inteiro, nome: string) => ENTIDADES[nome.toLowerCase()] ?? inteiro);
}

export function htmlParaTexto(html: string): string {
  const semTags = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<\/(div|tr|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodificarEntidades(semTags)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ──────────────────────────────────────────────────────────────────────
// Corte da citação
// ──────────────────────────────────────────────────────────────────────

const MARCAS_DE_CITACAO: RegExp[] = [
  // "Em qua., 6 de ago. de 2026 às 14:03, Fulano <x@y> escreveu:"
  /^\s*(em|on)\b.*\b(escreveu|wrote)\s*:\s*$/i,
  /^\s*-{2,}\s*(mensagem original|original message|forwarded message|mensagem encaminhada)/i,
  /^\s*_{5,}\s*$/,
  /^\s*(de|from)\s*:\s*.+<.+@.+>/i,
  /^\s*(enviada?( em)?|sent)\s*:\s*.+/i,
  /^\s*>{1,}/,
];

/**
 * Corta a resposta no ponto em que começa a citação do e-mail anterior.
 * Se sobrar nada, devolve o texto inteiro — perder conteúdo é pior do que
 * guardar a conversa duplicada.
 */
export function removerCitacao(texto: string): string {
  const linhas = texto.split("\n");
  let corte = -1;

  for (let i = 0; i < linhas.length; i++) {
    if (MARCAS_DE_CITACAO.some((r) => r.test(linhas[i]))) {
      corte = i;
      break;
    }
    // Assinatura ("-- " sozinho) também não interessa
    if (/^-{2}\s*$/.test(linhas[i])) {
      corte = i;
      break;
    }
  }

  const recortado = (corte >= 0 ? linhas.slice(0, corte) : linhas)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return recortado !== "" ? recortado : texto.trim();
}

// ──────────────────────────────────────────────────────────────────────
// Endereços e token
// ──────────────────────────────────────────────────────────────────────

export function extrairEndereco(valor: string | null): { nome: string | null; email: string | null } {
  if (!valor) return { nome: null, email: null };

  const decodificado = decodificarPalavrasCodificadas(valor);
  const comAngulo = decodificado.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);

  if (comAngulo) {
    let nome = comAngulo[1].trim();
    if (nome.startsWith('"') && nome.endsWith('"') && nome.length >= 2) nome = nome.slice(1, -1);
    return { nome: nome || null, email: comAngulo[2].trim().toLowerCase() };
  }

  const solto = decodificado.match(/[^\s<>,;]+@[^\s<>,;]+/);
  return { nome: null, email: solto ? solto[0].toLowerCase() : null };
}

/** Acha o `+r<16 hex>` que o envio plantou no Reply-To. */
export function extrairReplyToken(h: Cabecalhos): string | null {
  const candidatos = [
    ...cabecalhos(h, "to"),
    ...cabecalhos(h, "cc"),
    ...cabecalhos(h, "delivered-to"),
    ...cabecalhos(h, "x-original-to"),
    ...cabecalhos(h, "envelope-to"),
  ];

  for (const valor of candidatos) {
    const achado = valor.match(/\+r([0-9a-f]{16})\b/i);
    if (achado) return achado[1].toLowerCase();
  }

  return null;
}

/** Resposta automática (férias, "não responda", bounce) não vira comentário. */
export function ehAutomatica(h: Cabecalhos): boolean {
  const auto = (cabecalho(h, "auto-submitted") ?? "").toLowerCase();
  if (auto !== "" && auto !== "no") return true;

  const precedencia = (cabecalho(h, "precedence") ?? "").toLowerCase();
  if (["bulk", "auto_reply", "junk", "list"].includes(precedencia)) return true;

  if (cabecalho(h, "x-autoreply") || cabecalho(h, "x-autorespond")) return true;
  if ((cabecalho(h, "x-auto-response-suppress") ?? "").toLowerCase().includes("all")) return true;

  // Bounce: envelope vazio
  const retorno = (cabecalho(h, "return-path") ?? "").trim();
  if (retorno === "<>") return true;

  return false;
}
