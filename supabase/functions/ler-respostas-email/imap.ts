// Cliente IMAP mínimo, só com o que o leitor de respostas precisa: entrar,
// abrir a caixa em modo leitura, listar o que chegou depois do último UID e
// baixar as mensagens escolhidas.
//
// Por que escrito à mão: as bibliotecas de IMAP de Deno estão abandonadas e as
// de npm arrastam node:net/node:stream para dentro da edge function. O recorte
// aqui é pequeno o bastante para caber num arquivo e não ter surpresa.
//
// Duas decisões que não são detalhe:
//   • EXAMINE, nunca SELECT — a caixa é de gente. Modo leitura garante que
//     nenhuma mensagem é marcada como lida por causa do robô.
//   • Tudo trafega como string binária (1 char = 1 byte). Decodificar como
//     UTF-8 na entrada corromperia corpo em latin-1; o charset certo só é
//     conhecido depois de ler o Content-Type (ver mime.ts).

import { bytesParaBinario } from "./mime.ts";

export interface OpcoesImap {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  /** Orçamento total da sessão. Estourou, derruba — a function tem limite de tempo. */
  tempoLimiteMs?: number;
}

export interface CaixaAberta {
  uidvalidity: number;
  uidnext: number;
  total: number;
}

export class ClienteImap {
  #conn: Deno.TlsConn | null = null;
  #restante = new Uint8Array(0);
  #contador = 0;
  #prazo = 0;
  #opcoes: OpcoesImap;

  constructor(opcoes: OpcoesImap) {
    this.#opcoes = opcoes;
  }

  // ── conexão ────────────────────────────────────────────────────────

  async conectar(): Promise<void> {
    this.#prazo = Date.now() + (this.#opcoes.tempoLimiteMs ?? 60_000);
    this.#conn = await Deno.connectTls({
      hostname: this.#opcoes.host,
      port: this.#opcoes.porta,
    });

    // Saudação do servidor antes de qualquer comando
    const saudacao = await this.#lerLinha();
    if (!/^\* (OK|PREAUTH)/i.test(saudacao)) {
      throw new Error(`IMAP recusou a conexão: ${saudacao}`);
    }
  }

  async login(): Promise<void> {
    await this.#comando(
      `LOGIN ${aspas(this.#opcoes.usuario)} ${aspas(this.#opcoes.senha)}`,
      // A senha não pode vazar no log de erro.
      "LOGIN <omitido>",
    );
  }

  /** Abre a caixa em modo leitura. Nada é marcado como lido. */
  async abrir(caixa: string): Promise<CaixaAberta> {
    const linhas = await this.#comando(`EXAMINE ${aspas(caixa)}`);
    const juntas = linhas.join("\n");

    const uidvalidity = Number(juntas.match(/\[UIDVALIDITY (\d+)\]/i)?.[1] ?? 0);
    const uidnext = Number(juntas.match(/\[UIDNEXT (\d+)\]/i)?.[1] ?? 0);
    const total = Number(juntas.match(/^\* (\d+) EXISTS/im)?.[1] ?? 0);

    if (!uidvalidity || !uidnext) {
      throw new Error(`EXAMINE ${caixa} não devolveu UIDVALIDITY/UIDNEXT`);
    }

    return { uidvalidity, uidnext, total };
  }

  async sair(): Promise<void> {
    try {
      if (this.#conn) await this.#comando("LOGOUT");
    } catch {
      // servidor já pode ter fechado — não interessa
    } finally {
      try {
        this.#conn?.close();
      } catch {
        // idem
      }
      this.#conn = null;
    }
  }

  // ── leitura de mensagens ───────────────────────────────────────────

  /**
   * Só os cabeçalhos pedidos, do UID informado em diante. É a varredura barata:
   * o corpo inteiro só é baixado depois, e só de quem tem token.
   *
   * Atenção ao `n:*` do IMAP: ele SEMPRE devolve a última mensagem da caixa,
   * mesmo quando o UID dela é menor que `n`. Quem chama tem que filtrar.
   */
  async buscarCabecalhos(deUid: number, campos: string[]): Promise<Map<number, string>> {
    return await this.#uidFetch(
      `${deUid}:*`,
      `UID BODY.PEEK[HEADER.FIELDS (${campos.join(" ")})]`,
    );
  }

  /** Mensagem inteira (cabeçalhos + corpo), como string binária. */
  async buscarMensagem(uid: number): Promise<string | null> {
    const resposta = await this.#uidFetch(String(uid), "UID BODY.PEEK[]");
    return resposta.get(uid) ?? null;
  }

  // ── protocolo ──────────────────────────────────────────────────────

  async #uidFetch(faixa: string, itens: string): Promise<Map<number, string>> {
    const resultado = new Map<number, string>();
    const etiqueta = `a${++this.#contador}`;
    await this.#enviar(`${etiqueta} UID FETCH ${faixa} (${itens})`);

    while (true) {
      const linha = await this.#lerLinha();

      if (linha.startsWith(`${etiqueta} `)) {
        const status = linha.slice(etiqueta.length + 1).trim();
        if (!/^OK\b/i.test(status)) throw new Error(`UID FETCH ${faixa}: ${status}`);
        break;
      }

      if (!/^\* \d+ FETCH /i.test(linha)) continue;

      let descricao = linha;
      let dados = "";

      // "... BODY[...] {1234}" → os 1234 bytes seguintes são o conteúdo cru,
      // e o resto da resposta (onde às vezes vem o UID) só depois deles.
      const literal = linha.match(/\{(\d+)\}$/);
      if (literal) {
        dados = bytesParaBinario(await this.#lerBytes(Number(literal[1])));
        descricao += " " + (await this.#lerLinha());
      }

      const uid = descricao.match(/\bUID (\d+)/i);
      if (uid) resultado.set(Number(uid[1]), dados);
    }

    return resultado;
  }

  async #comando(texto: string, textoParaErro?: string): Promise<string[]> {
    const etiqueta = `a${++this.#contador}`;
    await this.#enviar(`${etiqueta} ${texto}`);

    const coletadas: string[] = [];
    while (true) {
      const linha = await this.#lerLinha();
      if (linha.startsWith(`${etiqueta} `)) {
        const status = linha.slice(etiqueta.length + 1).trim();
        if (!/^OK\b/i.test(status)) {
          throw new Error(`${textoParaErro ?? texto}: ${status}`);
        }
        return coletadas;
      }
      coletadas.push(linha);
    }
  }

  async #enviar(linha: string): Promise<void> {
    if (!this.#conn) throw new Error("IMAP não conectado");
    await this.#conn.write(new TextEncoder().encode(linha + "\r\n"));
  }

  async #lerLinha(): Promise<string> {
    while (true) {
      const fim = acharCrLf(this.#restante);
      if (fim >= 0) {
        const linha = bytesParaBinario(this.#restante.subarray(0, fim));
        this.#restante = this.#restante.slice(fim + 2);
        return linha;
      }
      await this.#encher();
    }
  }

  async #lerBytes(quantidade: number): Promise<Uint8Array> {
    while (this.#restante.length < quantidade) await this.#encher();
    const saida = this.#restante.slice(0, quantidade);
    this.#restante = this.#restante.slice(quantidade);
    return saida;
  }

  async #encher(): Promise<void> {
    if (!this.#conn) throw new Error("IMAP não conectado");

    const sobra = this.#prazo - Date.now();
    if (sobra <= 0) throw new Error("tempo limite do IMAP estourado");

    const pedaco = new Uint8Array(65_536);
    let alarme: number | undefined;

    const lidos = await Promise.race([
      this.#conn.read(pedaco),
      new Promise<never>((_, rejeitar) => {
        alarme = setTimeout(() => rejeitar(new Error("IMAP não respondeu a tempo")), sobra);
      }),
    ]).finally(() => {
      if (alarme !== undefined) clearTimeout(alarme);
    });

    if (lidos === null) throw new Error("IMAP fechou a conexão");

    const novo = new Uint8Array(this.#restante.length + lidos);
    novo.set(this.#restante);
    novo.set(pedaco.subarray(0, lidos), this.#restante.length);
    this.#restante = novo;
  }
}

function acharCrLf(bytes: Uint8Array): number {
  for (let i = 0; i + 1 < bytes.length; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10) return i;
  }
  return -1;
}

function aspas(valor: string): string {
  return `"${valor.replace(/[\\"]/g, (c) => "\\" + c)}"`;
}
