/**
 * Envio SMTP direto no socket, sem biblioteca.
 *
 * Por que saiu o denomailer (19/11/2026, DEM-0666): o envio caiu com 546
 * "CPU Time exceeded" e nada foi gravado. O denomailer 1.6.0, depois de cada
 * envio (e depois de qualquer recusa antes do DATA), roda o #cleanup:
 *
 *     this.#connection.writeCmd("NOOP");
 *     while (true) {
 *       const cmd = await this.#connection.readCmd();
 *       if (cmd && cmd.code === 250) return;
 *     }
 *
 * Se o servidor já fechou a conexão, readCmd devolve null na hora, para sempre:
 * o laço gira em microtarefa, nenhum setTimeout dispara (nem um prazo nosso) e
 * o worker morre por CPU. Não há como consertar por fora (o método é privado).
 *
 * Aqui toda leitura tem prazo e conexão encerrada vira erro. Mesmo molde do
 * testar-conta-email/smtp.ts (que veio do DoctorSaaS).
 *
 * Regra que importa: depois que o servidor aceita o DATA (250 no "."), o
 * e-mail SAIU. Nada que falhe depois disso (QUIT, fechar) vira falha.
 */

import type { CredenciaisEnvio } from "./conta.ts";

const PRAZO_LEITURA_MS = 15_000;
const PRAZO_ESCRITA_MS = 30_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(texto: string): string {
  let bin = "";
  for (const b of enc.encode(texto)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function comPrazo<T>(p: Promise<T>, etapa: string, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const relogio = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`o servidor não respondeu em ${ms / 1000} s (etapa ${etapa})`)), ms);
  });
  p.catch(() => {}); // perdedora que falha depois não pode virar rejeição solta
  return Promise.race([p, relogio]).finally(() => clearTimeout(timer));
}

/** Resposta SMTP fecha quando a última linha tem espaço na 4ª posição (RFC 5321). */
export function respostaCompleta(acc: string): boolean {
  const linhas = acc.split("\r\n").filter((l) => l.length > 0);
  if (linhas.length === 0 || !acc.endsWith("\r\n")) return false;
  return /^\d{3}(?: |$)/.test(linhas[linhas.length - 1]);
}

export function codigoDaResposta(resposta: string): number {
  const linhas = resposta.split("\r\n").filter((l) => l.length > 0);
  return parseInt(linhas[linhas.length - 1]?.slice(0, 3) ?? "0", 10);
}

class Conexao {
  private acc = "";
  constructor(private conn: Deno.Conn) {}

  async subirTls(hostname: string) {
    this.conn = await comPrazo(
      Deno.startTls(this.conn as Deno.TcpConn, { hostname }),
      "STARTTLS",
      PRAZO_LEITURA_MS,
    );
  }

  async escrever(texto: string, etapa: string) {
    const bytes = enc.encode(texto);
    let enviados = 0;
    while (enviados < bytes.length) {
      enviados += await comPrazo(this.conn.write(bytes.subarray(enviados)), etapa, PRAZO_ESCRITA_MS);
    }
  }

  async ler(etapa: string): Promise<string> {
    const buffer = new Uint8Array(4096);
    while (!respostaCompleta(this.acc)) {
      const n = await comPrazo(this.conn.read(buffer), etapa, PRAZO_LEITURA_MS);
      if (n === null) throw new Error(`o servidor encerrou a conexão (etapa ${etapa})`);
      this.acc += dec.decode(buffer.subarray(0, n), { stream: true });
    }
    const r = this.acc;
    this.acc = "";
    return r;
  }

  /** Manda o comando e exige o código; a recusa traz a linha do servidor. */
  async comando(linha: string | null, esperado: number, etapa: string): Promise<string> {
    if (linha !== null) await this.escrever(linha, etapa);
    const r = await this.ler(etapa);
    if (codigoDaResposta(r) !== esperado) {
      throw new Error(`${etapa}: servidor respondeu ${r.trim().slice(0, 300)}`);
    }
    return r;
  }

  fechar() {
    try {
      this.conn.close();
    } catch {
      // já caiu
    }
  }
}

/**
 * Envia `dados` (já pronto para o DATA, ver mensagem.ts → paraData) de
 * `credenciais.remetente` para `destino`.
 */
export async function enviarPorSmtp(
  credenciais: CredenciaisEnvio,
  destino: string,
  dados: string,
): Promise<void> {
  const { host, porta, tls, usuario, senha, remetente } = credenciais;
  const conn = tls
    ? await comPrazo(Deno.connectTls({ hostname: host, port: porta }), "conexão", PRAZO_LEITURA_MS)
    : await comPrazo(Deno.connect({ hostname: host, port: porta }), "conexão", PRAZO_LEITURA_MS);
  const c = new Conexao(conn);

  try {
    await c.comando(null, 220, "saudação");
    let ehlo = await c.comando("EHLO doctordev\r\n", 250, "EHLO");

    // Porta sem TLS direto: sobe STARTTLS quando o servidor oferece (o denomailer fazia igual).
    if (!tls && /^250[ -]STARTTLS/im.test(ehlo)) {
      await c.comando("STARTTLS\r\n", 220, "STARTTLS");
      await c.subirTls(host);
      ehlo = await c.comando("EHLO doctordev\r\n", 250, "EHLO após STARTTLS");
    }

    if (/AUTH[ =]/i.test(ehlo)) {
      await c.comando("AUTH LOGIN\r\n", 334, "AUTH");
      await c.comando(`${b64(usuario)}\r\n`, 334, "usuário");
      await c.comando(`${b64(senha)}\r\n`, 235, "senha");
    }

    await c.comando(`MAIL FROM:<${remetente}>\r\n`, 250, "remetente (MAIL FROM)");
    await c.comando(`RCPT TO:<${destino}>\r\n`, 250, "destinatário (RCPT TO)");
    await c.comando("DATA\r\n", 354, "DATA");
    await c.escrever(dados, "corpo da mensagem");
    await c.comando(null, 250, "fim da mensagem");

    // Saiu. Daqui pra frente nada vira falha.
    try {
      await c.escrever("QUIT\r\n", "QUIT");
    } catch {
      // servidor já fechou; o e-mail foi aceito
    }
  } finally {
    c.fechar();
  }
}
