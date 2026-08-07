/**
 * Assunto de e-mail com acento — RFC 2047, contornando o denomailer.
 *
 * Arquivo separado por um motivo: assunto.test.ts roda isso no bun, sem rede e
 * sem Deno. Já quebrou em produção duas vezes; agora tem teste.
 */

/**
 * Assunto com acento precisa virar "encoded-word" (RFC 2047). O denomailer faz
 * isso errado: deixa espaço literal dentro do bloco (proibido) e passa dos 75
 * caracteres, então o Gmail desiste e mostra o `=?utf-8?Q?...` cru pro cliente.
 *
 * Aqui a gente codifica antes, em base64, quebrando em blocos que cabem no
 * limite. O resultado é ASCII puro.
 *
 * ⚠️ O ESPAÇO NA FRENTE DO RETORNO NÃO É ENFEITE — não tire.
 *
 * O denomailer 1.6.0 faz, em config/mail/encoding.ts:
 *
 *     export function quotedPrintableEncodeInline(data: string) {
 *       if (hasNonAsciiCharacters(data) || data.startsWith("=?")) {
 *         return `=?utf-8?Q?${quotedPrintableEncode(data)}?=`;
 *       }
 *       return data;
 *     }
 *
 * Ou seja: ele RE-CODIFICA qualquer valor que já comece com "=?" — justamente
 * o nosso. E o quotedPrintableEncode quebra a cada 74 caracteres com "=\r\n",
 * que dentro de um cabeçalho ENCERRA A LINHA. Medido em 06/08/2026: o Subject
 * partia no meio e From/To/Date/Content-Type mais a mensagem inteira caíam
 * dentro do CORPO do e-mail, com tudo quoted-printable duas vezes.
 *
 * Um espaço na frente derruba o `startsWith("=?")`, o valor passa intacto, e o
 * espaço não aparece pra ninguém: depois de "Subject:" ele é folding whitespace
 * e todo leitor descarta.
 */
export function codificarAssunto(s: string): string {
  // Só ASCII imprimível: não precisa codificar (e o denomailer também não mexe)
  if (/^[\x20-\x7E]*$/.test(s)) return s;

  const enc = new TextEncoder();
  const blocos: string[] = [];
  let atual: string[] = [];
  let bytes = 0;

  // 45 bytes por bloco: base64 vira 60 chars, + "=?UTF-8?B?" e "?=" = 72 < 75.
  // Corta em caractere inteiro pra não partir um acento no meio.
  for (const ch of Array.from(s)) {
    const n = enc.encode(ch).length;
    if (bytes + n > 45) {
      blocos.push(atual.join(""));
      atual = [];
      bytes = 0;
    }
    atual.push(ch);
    bytes += n;
  }
  if (atual.length) blocos.push(atual.join(""));

  const codificado = blocos
    .map((b) => {
      let bin = "";
      for (const x of enc.encode(b)) bin += String.fromCharCode(x);
      return `=?UTF-8?B?${btoa(bin)}?=`;
    })
    .join(" "); // blocos vizinhos separados por espaço são concatenados pelo leitor

  return " " + codificado;
}
