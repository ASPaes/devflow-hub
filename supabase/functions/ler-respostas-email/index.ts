// ler-respostas-email — traz para dentro da demanda a resposta que o cliente
// mandou por e-mail.
//
// Como a resposta encontra a demanda: o envio (notificar-cliente-demanda)
// coloca `Reply-To: caixa+r<token>@dominio` e guarda o token na linha do envio.
// O cliente responde, o token volta no `To:`, e aqui ele vira demanda_id.
// Não depende do código da demanda (que é adivinhável) nem de Message-ID (que o
// Gmail reescreve na saída).
//
// Regras de convivência com uma caixa de gente:
//   • abre em EXAMINE (leitura) — nada é marcado como lido;
//   • avança por marca d'água de UID (email_ingestao_estado), não por \Seen;
//   • baixa o corpo SÓ das mensagens que têm token — do resto lê 15 cabeçalhos
//     e descarta.
//
// Chamada pelo pg_cron com a service_role key. `?dry_run=1` faz a varredura
// inteira sem gravar nada e sem mexer na marca d'água.
// `?reprocessar=<demanda_comunicacoes.id>` busca de novo UMA resposta já
// gravada (pelo Message-ID) e guarda os anexos dela — foi assim que o print da
// DEM-0379 voltou. Também não mexe na marca d'água.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

import { ehChamadaDeServico } from "./auth.ts";
import { ClienteImap } from "./imap.ts";
import {
  type AnexoEmail,
  cabecalho,
  decodificarPalavrasCodificadas,
  ehAutomatica,
  extrairAnexos,
  extrairEndereco,
  extrairReplyToken,
  extrairTexto,
  parseCabecalhos,
  removerCitacao,
} from "./mime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Teto por execução. Backlog maior fica para a próxima rodada do cron. */
const MAX_POR_RODADA = 200;

/** Corpos baixados por rodada — é a parte cara. */
const MAX_CORPOS = 25;

/** O bucket dos anexos da demanda e o que ele aceita (storage.buckets). */
const ANEXO_BUCKET = "demanda-anexos";
const ANEXO_TIPOS = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
]);
const ANEXO_MAX_BYTES = 25 * 1024 * 1024;
/** Imagem inline menor que isso é pixel de rastreio ou espaçador, não print. */
const ANEXO_INLINE_MIN_BYTES = 2048;
const ANEXO_MAX_POR_MENSAGEM = 10;

const CAMPOS_DE_TRIAGEM = [
  "TO",
  "CC",
  "DELIVERED-TO",
  "X-ORIGINAL-TO",
  "ENVELOPE-TO",
  "FROM",
  "SUBJECT",
  "DATE",
  "MESSAGE-ID",
  "IN-REPLY-TO",
  "AUTO-SUBMITTED",
  "PRECEDENCE",
  "RETURN-PATH",
  "X-AUTOREPLY",
  "X-AUTORESPOND",
  "X-AUTO-RESPONSE-SUPPRESS",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(nome: string): string | null {
  return (Deno.env.get(nome) ?? "").trim() || null;
}

async function sha256Hex(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Separa o que dá para guardar do que o bucket recusaria. */
function selecionarAnexos(todos: AnexoEmail[]): { aceitos: AnexoEmail[]; ignorados: string[] } {
  const aceitos: AnexoEmail[] = [];
  const ignorados: string[] = [];

  for (const a of todos) {
    const mime = a.mime === "image/jpg" ? "image/jpeg" : a.mime;
    if (!ANEXO_TIPOS.has(mime)) {
      ignorados.push(`${a.nome} (${a.mime})`);
      continue;
    }
    if (a.inline && a.bytes.length < ANEXO_INLINE_MIN_BYTES) continue;
    if (a.bytes.length > ANEXO_MAX_BYTES) {
      ignorados.push(`${a.nome} (maior que 25 MB)`);
      continue;
    }
    if (aceitos.length >= ANEXO_MAX_POR_MENSAGEM) {
      ignorados.push(`${a.nome} (passou de ${ANEXO_MAX_POR_MENSAGEM} por mensagem)`);
      continue;
    }
    aceitos.push({ ...a, mime });
  }

  return { aceitos, ignorados };
}

/**
 * Sobe os anexos para o bucket da demanda e amarra na comunicação. O caminho é
 * determinístico (hash do Message-ID + posição) e o upload é upsert: rodar de
 * novo para a mesma mensagem regrava o mesmo objeto em vez de criar órfão.
 */
async function guardarAnexos(
  admin: SupabaseClient,
  alvo: { demandaId: string; comunicacaoId: string },
  chave: string,
  anexos: AnexoEmail[],
): Promise<{ guardados: number; erro: string | null }> {
  const prefixo = (await sha256Hex(chave)).slice(0, 16);
  const registros: Record<string, unknown>[] = [];

  for (const [i, a] of anexos.entries()) {
    const seguro = a.nome.replace(/[^\w.\-]/g, "_").slice(0, 100) || `anexo-${i + 1}`;
    const caminho = `demandas/${alvo.demandaId}/email-${prefixo}-${i + 1}-${seguro}`;

    const { error } = await admin.storage
      .from(ANEXO_BUCKET)
      .upload(caminho, a.bytes, { contentType: a.mime, upsert: true });
    if (error) return { guardados: 0, erro: `upload ${a.nome}: ${error.message}` };

    registros.push({
      storage_path: caminho,
      nome_arquivo: a.nome,
      mime_type: a.mime,
      tamanho_bytes: a.bytes.length,
      inline: a.inline,
    });
  }

  const { error } = await admin.rpc("anexar_arquivos_resposta_cliente", {
    p_comunicacao_id: alvo.comunicacaoId,
    p_anexos: registros,
  });
  if (error) return { guardados: 0, erro: `anexar: ${error.message}` };

  return { guardados: registros.length, erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Só o cron entra. Usuário autenticado comum não tem nada que fazer aqui.
  if (!ehChamadaDeServico(req.headers.get("Authorization"), serviceKey)) {
    return json({ error: "Não autorizado" }, 401);
  }

  const parametros = new URL(req.url).searchParams;
  const simulacao = parametros.get("dry_run") === "1";
  const reprocessar = parametros.get("reprocessar");

  const host = env("IMAP_HOST") ?? "imap.gmail.com";
  const porta = Number(env("IMAP_PORT") ?? "993");
  const usuario = env("IMAP_USER") ?? env("SMTP_USER");
  const senha = env("IMAP_PASS") ?? env("SMTP_PASS");
  const caixaNome = env("IMAP_MAILBOX") ?? "INBOX";
  const nossoEndereco = (env("REPLY_TO_BASE") ?? env("SMTP_FROM") ?? usuario ?? "").toLowerCase();

  if (!usuario || !senha) {
    return json({ error: "IMAP não configurado (IMAP_USER/IMAP_PASS ou SMTP_USER/SMTP_PASS)" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cliente = new ClienteImap({ host, porta, usuario, senha, tempoLimiteMs: 90_000 });
  const resumo = {
    simulacao,
    varridas: 0,
    com_token: 0,
    gravadas: 0,
    duplicadas: 0,
    suspeitas: 0,
    automaticas: 0,
    sem_demanda: 0,
    anexos: 0,
    anexos_ignorados: [] as string[],
    ultimo_uid: 0,
    marco_inicial: false,
    erros: [] as string[],
  };

  try {
    if (reprocessar) {
      const { data: com, error: errCom } = await admin
        .from("demanda_comunicacoes")
        .select("id, demanda_id, direcao, message_id")
        .eq("id", reprocessar)
        .maybeSingle();

      if (errCom) return json({ error: errCom.message }, 500);
      if (!com || com.direcao !== "entrada" || !com.message_id) {
        return json({ error: "Comunicação não é resposta de cliente com Message-ID" }, 400);
      }

      await cliente.conectar();
      await cliente.login();
      await cliente.abrir(caixaNome);

      const uid = await cliente.buscarUidPorMessageId(com.message_id);
      if (!uid) return json({ error: "A mensagem não está mais na caixa", message_id: com.message_id }, 404);

      const bruto = await cliente.buscarMensagem(uid);
      if (!bruto) return json({ error: `uid ${uid}: corpo não veio` }, 502);

      const { aceitos, ignorados } = selecionarAnexos(extrairAnexos(bruto));
      if (simulacao || aceitos.length === 0) {
        return json({ ok: true, simulacao, uid, anexos: aceitos.map((a) => a.nome), ignorados });
      }

      const r = await guardarAnexos(
        admin,
        { demandaId: com.demanda_id, comunicacaoId: com.id },
        com.message_id,
        aceitos,
      );
      return json({ ok: r.erro === null, uid, anexos: r.guardados, ignorados, erro: r.erro }, r.erro ? 500 : 200);
    }

    const { data: estado, error: errEstado } = await admin
      .from("email_ingestao_estado")
      .select("uidvalidity, ultimo_uid")
      .eq("id", 1)
      .single();

    if (errEstado) return json({ error: `Estado do leitor: ${errEstado.message}` }, 500);

    await cliente.conectar();
    await cliente.login();
    const caixa = await cliente.abrir(caixaNome);

    // Caixa recriada = os UIDs antigos não valem mais nada.
    const validadeMudou = estado.uidvalidity !== null &&
      Number(estado.uidvalidity) !== caixa.uidvalidity;
    const ultimoUid = validadeMudou ? 0 : Number(estado.ultimo_uid ?? 0);

    // Primeira execução (ou caixa recriada): planta a marca d'água no presente
    // e não processa nada. Varrer o histórico inteiro de uma caixa de e-mail
    // seria caro e traria conversa que nunca teve token.
    if (ultimoUid === 0) {
      resumo.marco_inicial = true;
      resumo.ultimo_uid = Math.max(caixa.uidnext - 1, 0);

      if (!simulacao) {
        await admin
          .from("email_ingestao_estado")
          .update({
            uidvalidity: caixa.uidvalidity,
            ultimo_uid: resumo.ultimo_uid,
            ultima_execucao: new Date().toISOString(),
            ultimo_erro: null,
          })
          .eq("id", 1);
      }

      return json({ ok: true, ...resumo });
    }

    const triagem = await cliente.buscarCabecalhos(ultimoUid + 1, CAMPOS_DE_TRIAGEM);

    // `n:*` devolve a última mensagem mesmo quando o UID dela é menor que n.
    const uids = [...triagem.keys()]
      .filter((uid) => uid > ultimoUid)
      .sort((a, b) => a - b)
      .slice(0, MAX_POR_RODADA);

    resumo.varridas = uids.length;

    let corposBaixados = 0;
    let maiorUidTratado = ultimoUid;

    for (const uid of uids) {
      // Parou de processar por teto de corpos: a marca d'água não pode passar
      // daqui, senão a mensagem some sem nunca ter sido lida.
      if (corposBaixados >= MAX_CORPOS) break;

      const h = parseCabecalhos(triagem.get(uid) ?? "");
      const token = extrairReplyToken(h);

      if (!token) {
        maiorUidTratado = uid;
        continue;
      }

      resumo.com_token++;

      if (ehAutomatica(h)) {
        resumo.automaticas++;
        maiorUidTratado = uid;
        continue;
      }

      const remetente = extrairEndereco(cabecalho(h, "from"));
      if (!remetente.email || remetente.email === nossoEndereco) {
        maiorUidTratado = uid;
        continue;
      }

      const { data: alvo, error: errToken } = await admin.rpc("resolver_reply_token", {
        p_token: token,
      });

      if (errToken) {
        // Erro aqui é do banco, não da mensagem. Para a rodada sem avançar a
        // marca d'água — continuar avançaria por cima desta mensagem e ela
        // nunca mais seria lida.
        resumo.erros.push(`uid ${uid}: resolver token — ${errToken.message}`);
        break;
      }

      if (!alvo?.demanda_id) {
        resumo.sem_demanda++;
        maiorUidTratado = uid;
        continue;
      }

      corposBaixados++;
      const bruto = await cliente.buscarMensagem(uid);
      if (!bruto) {
        resumo.erros.push(`uid ${uid}: corpo não veio`);
        break;
      }

      const { cabecalhos: hCompleto, texto } = extrairTexto(bruto);
      const { aceitos, ignorados } = selecionarAnexos(extrairAnexos(bruto));
      resumo.anexos_ignorados.push(...ignorados.map((n) => `uid ${uid}: ${n}`));

      let resposta = removerCitacao(texto);

      if (resposta.trim() === "") {
        if (aceitos.length === 0) {
          resumo.erros.push(`uid ${uid}: resposta sem texto aproveitável`);
          maiorUidTratado = uid;
          continue;
        }
        // Cliente mandou só o print: a resposta existe, é a imagem.
        resposta = "(Resposta sem texto, só com anexo.)";
      }

      const assunto = decodificarPalavrasCodificadas(cabecalho(hCompleto, "subject") ?? "");
      const dataBruta = cabecalho(hCompleto, "date");
      const quando = dataBruta ? new Date(dataBruta) : new Date();
      const messageId = cabecalho(hCompleto, "message-id");

      if (simulacao) {
        resumo.gravadas++;
        resumo.anexos += aceitos.length;
        maiorUidTratado = uid;
        continue;
      }

      const { data: gravado, error: errGravar } = await admin.rpc(
        "registrar_resposta_cliente_demanda",
        {
          p_demanda_id: alvo.demanda_id,
          p_corpo_texto: resposta,
          p_remetente_email: remetente.email,
          p_remetente_nome: remetente.nome,
          p_assunto: assunto || null,
          p_message_id: messageId,
          p_in_reply_to: cabecalho(hCompleto, "in-reply-to"),
          p_email_destinatario: alvo.email_destinatario ?? null,
          p_enviado_em: isNaN(quando.getTime()) ? new Date().toISOString() : quando.toISOString(),
        },
      );

      if (errGravar) {
        // Não avança a marca d'água: a próxima rodada tenta de novo.
        resumo.erros.push(`uid ${uid}: gravar — ${errGravar.message}`);
        break;
      }

      if (gravado?.duplicada) resumo.duplicadas++;
      else resumo.gravadas++;
      if (gravado?.confiavel === false) resumo.suspeitas++;

      // O texto já está gravado; anexo que falhar vai para o ultimo_erro e
      // pode ser refeito com ?reprocessar=<id>. Travar a fila por causa dele
      // seria pior.
      if (aceitos.length > 0 && gravado?.id) {
        const r = await guardarAnexos(
          admin,
          { demandaId: alvo.demanda_id, comunicacaoId: gravado.id },
          messageId ?? `${caixa.uidvalidity}:${uid}`,
          aceitos,
        );
        resumo.anexos += r.guardados;
        if (r.erro) resumo.erros.push(`uid ${uid}: anexos — ${r.erro} (comunicação ${gravado.id})`);
      }

      maiorUidTratado = uid;
    }

    resumo.ultimo_uid = maiorUidTratado;

    if (!simulacao) {
      await admin
        .from("email_ingestao_estado")
        .update({
          uidvalidity: caixa.uidvalidity,
          ultimo_uid: maiorUidTratado,
          ultima_execucao: new Date().toISOString(),
          ultimo_erro: resumo.erros.length ? resumo.erros.join(" | ").slice(0, 2000) : null,
        })
        .eq("id", 1);
    }

    return json({ ok: true, ...resumo });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error("[ler-respostas-email] CATCH:", mensagem);

    if (!simulacao && !reprocessar) {
      await admin
        .from("email_ingestao_estado")
        .update({ ultima_execucao: new Date().toISOString(), ultimo_erro: mensagem.slice(0, 2000) })
        .eq("id", 1);
    }

    return json({ error: mensagem, ...resumo }, 500);
  } finally {
    await cliente.sair();
  }
});
