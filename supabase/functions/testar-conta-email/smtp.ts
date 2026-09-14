/**
 * Teste de conta de e-mail falando SMTP e IMAP direto no socket.
 *
 * Copiado do DoctorSaaS (supabase/functions/test-email-account/smtp.ts, 10/09/2026),
 * só com a parte de teste: aqui ninguém envia por este arquivo. O envio de
 * verdade continua no denomailer da notificar-cliente-demanda.
 *
 * Não usa biblioteca de propósito: o que a tela precisa saber é exatamente o que
 * uma biblioteca esconde — se o TLS combinou com a porta, se o servidor aceitou o
 * AUTH e com qual código recusou.
 */

export type EmailSecurity = "ssl" | "starttls" | "none";

/** cada etapa tem o seu próprio relógio; estourou, o erro diz qual parou */
const TIMEOUT_MS = 10_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** base64 de texto UTF-8 (btoa sozinho quebra fora do latin1) */
function b64(texto: string): string {
  const bytes = enc.encode(texto);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function comPrazo<T>(p: Promise<T>, etapa: string, ms = TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const relogio = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`TIMEOUT na etapa ${etapa}`)), ms);
  });
  return Promise.race([p, relogio]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/** conexão de texto com leitura por acumulação, usada pelos dois protocolos */
class ConexaoTexto {
  private conn: Deno.Conn;
  private acc = "";

  constructor(conn: Deno.Conn) {
    this.conn = conn;
  }

  async upgradeTls(hostname: string) {
    this.conn = await Deno.startTls(this.conn as Deno.TcpConn, { hostname });
  }

  async escrever(texto: string, etapa = "escrita") {
    const bytes = enc.encode(texto);
    let enviados = 0;
    while (enviados < bytes.length) {
      enviados += await comPrazo(this.conn.write(bytes.subarray(enviados)), etapa, 30_000);
    }
  }

  /** lê até `completo(acumulado)` dizer que a resposta fechou */
  async ler(completo: (acumulado: string) => boolean, etapa: string, ms = TIMEOUT_MS): Promise<string> {
    const buffer = new Uint8Array(4096);
    while (!completo(this.acc)) {
      const n = await comPrazo(this.conn.read(buffer), etapa, ms);
      if (n === null) throw new Error(`Conexão encerrada pelo servidor na etapa ${etapa}`);
      this.acc += dec.decode(buffer.subarray(0, n));
    }
    const resposta = this.acc;
    this.acc = "";
    return resposta;
  }

  fechar() {
    try {
      this.conn.close();
    } catch {
      // socket já caiu; fechar de novo não interessa a ninguém
    }
  }
}

async function conectar(hostname: string, port: number, seguranca: EmailSecurity, etapa: string) {
  const conn = seguranca === "ssl"
    ? await comPrazo(Deno.connectTls({ hostname, port }), etapa)
    : await comPrazo(Deno.connect({ hostname, port }), etapa);
  return new ConexaoTexto(conn);
}

// ─────────────────────────── SMTP ───────────────────────────

/** resposta de SMTP fecha quando a última linha tem espaço na 4ª posição (RFC 5321) */
const smtpCompleto = (acc: string) => {
  const linhas = acc.split("\r\n").filter((l) => l.length > 0);
  if (linhas.length === 0) return false;
  return /^\d{3} /.test(linhas[linhas.length - 1]);
};

const codigoSmtp = (resposta: string) => {
  const linhas = resposta.split("\r\n").filter((l) => l.length > 0);
  return parseInt(linhas[linhas.length - 1]?.slice(0, 3) ?? "0", 10);
};

function exigir(resposta: string, esperado: number, etapa: string) {
  if (codigoSmtp(resposta) !== esperado) {
    throw new Error(`${etapa}: servidor respondeu ${resposta.trim()}`);
  }
}

export interface Credenciais {
  host: string;
  port: number;
  security: EmailSecurity;
  username: string;
  password: string;
}

/** Conecta, cumprimenta, sobe o TLS quando a porta pede, autentica e sai. */
export async function verificarSmtp(params: Credenciais): Promise<void> {
  const { host, port, security, username, password } = params;
  const c = await conectar(host, port, security, "conexão");

  try {
    exigir(await c.ler(smtpCompleto, "saudação"), 220, "saudação");

    await c.escrever(`EHLO doctordev\r\n`);
    let ehlo = await c.ler(smtpCompleto, "EHLO");
    exigir(ehlo, 250, "EHLO");

    if (security === "starttls") {
      await c.escrever("STARTTLS\r\n");
      exigir(await c.ler(smtpCompleto, "STARTTLS"), 220, "STARTTLS");
      await comPrazo(c.upgradeTls(host), "STARTTLS");
      // depois do upgrade o EHLO recomeça, e é essa lista que vale
      await c.escrever(`EHLO doctordev\r\n`);
      ehlo = await c.ler(smtpCompleto, "EHLO após STARTTLS");
      exigir(ehlo, 250, "EHLO após STARTTLS");
    }

    if (!/AUTH[ =]/i.test(ehlo)) {
      throw new Error("O servidor não anunciou autenticação (AUTH) nesta porta.");
    }

    await c.escrever("AUTH LOGIN\r\n");
    exigir(await c.ler(smtpCompleto, "AUTH"), 334, "AUTH");

    await c.escrever(`${b64(username)}\r\n`);
    exigir(await c.ler(smtpCompleto, "usuário"), 334, "usuário");

    await c.escrever(`${b64(password)}\r\n`);
    exigir(await c.ler(smtpCompleto, "senha"), 235, "senha");

    await c.escrever("QUIT\r\n");
  } finally {
    c.fechar();
  }
}

// ─────────────────────────── IMAP ───────────────────────────

/** aspas e barra invertida precisam de escape dentro de string literal do IMAP */
const escaparImap = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export async function verificarImap(params: Credenciais): Promise<void> {
  const { host, port, security, username, password } = params;
  let c: ConexaoTexto | null = null;

  try {
    c = await conectar(host, port, security, "conexão de entrada");

    const saudacao = await c.ler((acc) => acc.includes("\r\n"), "saudação de entrada");
    if (!/^\* (OK|PREAUTH)/.test(saudacao)) {
      throw new Error(`saudação de entrada: ${saudacao.trim()}`);
    }

    // LOGIN já prova o acesso. Nenhum SELECT: caixa de gente, robô não mexe.
    await c.escrever(`a1 LOGIN "${escaparImap(username)}" "${escaparImap(password)}"\r\n`);
    const login = await c.ler((acc) => /^a1 (OK|NO|BAD)/m.test(acc), "login de entrada");
    if (!/^a1 OK/m.test(login)) {
      // a linha do servidor não repete a senha, mas o comando sim: nunca devolver o comando
      throw new Error(`login de entrada: ${login.trim()}`);
    }

    await c.escrever("a2 LOGOUT\r\n");
  } finally {
    c?.fechar();
  }
}

// ─────────────────────── tradução do erro ───────────────────────

/**
 * A resposta crua do provedor não ajuda quem está cadastrando. Cada caso vira
 * uma frase com a saída; o texto técnico vai junto, entre colchetes, para
 * `email_conta.ultimo_teste_erro`.
 */
export function mensagemAmigavel(erroBruto: string): string {
  const e = erroBruto.toLowerCase();

  // Os dois primeiros vêm antes do 535 genérico: chegam com o mesmo código e
  // têm saída diferente.
  if (/5\.7\.139|basic authentication is disabled|smtpclientauthentication is disabled/.test(e)) {
    return "A Microsoft bloqueou o acesso por senha nesta conta. Em conta de empresa, o administrador precisa liberar o SMTP autenticado; conta pessoal do Outlook ou do Hotmail não funciona mais por senha.";
  }
  if (/5\.7\.9|application-specific password required/.test(e)) {
    return "Esta conta tem verificação em duas etapas e exige senha de aplicativo. Gere uma e use no lugar da senha normal.";
  }
  if (/535|5\.7\.8|5\.7\.3|authentication failed|authenticationfailed|invalid credentials|username and password not accepted|login failed|a1 no/.test(e)) {
    return "Usuário ou senha recusados pelo provedor. Se a conta tem verificação em duas etapas, gere uma senha de aplicativo e use ela aqui.";
  }
  if (/timeout|timed out/.test(e)) {
    return "O servidor não respondeu na porta informada. Confira a porta e se o provedor libera acesso por programa externo.";
  }
  if (/wrong version number|record layer|corrupt message|invaliddata|bad record mac|unexpected message|tls|handshake/.test(e)) {
    return "A porta e o tipo de segurança não combinam. Porta 465 costuma ser SSL/TLS e 587, STARTTLS.";
  }
  if (/dns error|failed to lookup|name not resolved|nxdomain/.test(e)) {
    return "O endereço do servidor não existe. Confira se o nome do servidor está completo e sem erro de digitação.";
  }
  if (/connection refused|connectionrefused/.test(e)) {
    return "A porta está fechada nesse servidor. Confira o número da porta com o provedor.";
  }
  if (/530|authentication required|não anunciou autenticação/.test(e)) {
    return "O provedor exigiu autenticação e recusou o método. Em conta corporativa, o administrador precisa liberar o SMTP autenticado.";
  }
  if (/certificate|self.signed|unknownissuer/.test(e)) {
    return "O certificado do servidor não foi aceito. Confira o nome do servidor, que precisa ser o mesmo do certificado.";
  }
  return `Falha na conexão: ${erroBruto.slice(0, 200)}`;
}
