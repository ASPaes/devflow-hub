// notificar-cliente-demanda — envia ao solicitante a mensagem de parecer/conclusão
// da demanda, por e-mail (SMTP próprio) ou WhatsApp (via DoctorSaaS, com HMAC).
//
// O texto vem pronto do frontend: a IA sugere (gerar-mensagem-cliente), o agente
// revisa e edita, e o que chega aqui é o que vai ser enviado. Esta function não
// reescreve nada.
//
// Todo envio — sucesso ou falha — é gravado por registrar_comunicacao_demanda,
// que também cria o comentário automático na demanda quando dá certo.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { codificarAssunto } from "./assunto.ts";
import {
  type ContaEmail,
  type CredenciaisEnvio,
  credenciaisDeEnvio,
  enderecoDeResposta,
  ERRO_SEM_CONTA,
} from "./conta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DOCTORSAAS_FUNCTIONS_URL_PADRAO = "https://vbngjzovjhkmietztffo.supabase.co/functions/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Telefone BR em dígitos com DDI. Retorna "" se não der pra aproveitar. */
function normalizarTelefone(bruto: string): string {
  const digitos = String(bruto ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
  if (!digitos) return "";
  // 10 (fixo) ou 11 (celular) dígitos = número nacional, falta o DDI
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.length === 12 || digitos.length === 13) return digitos;
  return "";
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textoParaHtml(texto: string): string {
  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;">${escaparHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1E293B;">${paragrafos}</div>`;
}

function utf8ParaBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function assinar(payloadB64: string, segredo: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** 64 bits de aleatório em hex. Vai dentro do endereço de resposta, então só
 * pode usar caractere que sobrevive a qualquer servidor de e-mail. */
function gerarReplyToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Conta da tela Configurações › E-mail; sem ela, os Secrets SMTP_* de antes
 * (ver conta.ts). Erro ao ler a conta não cai nos Secrets: a senha deles pode
 * ser de outra caixa, e o envio sairia por uma conta que ninguém escolheu.
 */
async function carregarCredenciaisEnvio(
  supabaseUrl: string,
  serviceKey: string,
): Promise<CredenciaisEnvio | { erro: string }> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.rpc("obter_conta_email_servico");
  if (error) return { erro: `Não foi possível ler a conta de e-mail: ${error.message}` };

  const env = (nome: string) => (Deno.env.get(nome) ?? "").trim() || null;
  return credenciaisDeEnvio((data as ContaEmail | null) ?? null, env) ?? { erro: ERRO_SEM_CONTA };
}

async function enviarEmail(
  credenciais: CredenciaisEnvio,
  destino: string,
  assunto: string,
  corpo: string,
  responderPara: string | null,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { host, porta, tls, usuario, senha, remetente, nomeRemetente } = credenciais;

  // tls = TLS implícito (465). Sem ele, conexão limpa + STARTTLS (o denomailer faz o upgrade).
  const client = new SMTPClient({
    connection: {
      hostname: host,
      port: porta,
      tls,
      auth: { username: usuario, password: senha },
    },
  });

  try {
    await client.send({
      from: `${nomeRemetente} <${remetente}>`,
      to: destino,
      // Endereço puro, sem nome de exibição: nome com acento aqui cairia no
      // mesmo problema de encoded-word que o assunto já teve.
      ...(responderPara ? { replyTo: responderPara } : {}),
      subject: codificarAssunto(assunto),
      content: corpo,
      html: textoParaHtml(corpo),
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e?.message ? String(e.message) : String(e) };
  } finally {
    try {
      await client.close();
    } catch {
      // conexão já caiu — não interessa
    }
  }
}

async function enviarWhatsApp(
  telefone: string,
  mensagem: string,
  referencia: string | null,
): Promise<{ ok: true; messageId: string | null } | { ok: false; erro: string }> {
  const segredo = Deno.env.get("DEVFLOW_WA_SECRET");
  if (!segredo) return { ok: false, erro: "DEVFLOW_WA_SECRET não configurado" };

  const base = Deno.env.get("DOCTORSAAS_FUNCTIONS_URL") ?? DOCTORSAAS_FUNCTIONS_URL_PADRAO;
  const agora = Math.floor(Date.now() / 1000);
  const payloadB64 = utf8ParaBase64(
    JSON.stringify({
      telefone,
      mensagem,
      origem: "doctordev",
      referencia,
      iat: agora,
      exp: agora + 120,
    }),
  );
  const token = `${payloadB64}.${await assinar(payloadB64, segredo)}`;

  try {
    const res = await fetch(`${base}/ds-enviar-whatsapp-externo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok !== true) {
      return {
        ok: false,
        erro: `DoctorSaaS ${res.status}: ${data?.error ?? "resposta inesperada"}`,
      };
    }
    return { ok: true, messageId: data.messageId ?? null };
  } catch (e: any) {
    return { ok: false, erro: `Falha ao falar com o DoctorSaaS: ${e?.message ?? e}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    // Cliente com o JWT do agente: as RPCs precisam de auth.uid() e checam permissão.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Body inválido" }, 400);

    const demanda_id: string | undefined = body.demanda_id;
    const canal: string = body.canal;
    const corpo: string = String(body.corpo ?? "").trim();
    const assuntoInformado: string = String(body.assunto ?? "").trim();

    if (!demanda_id) return json({ error: "demanda_id obrigatório" }, 400);
    if (canal !== "email" && canal !== "whatsapp") return json({ error: "canal inválido" }, 400);
    if (!corpo) return json({ error: "Mensagem vazia" }, 400);

    const { data: temPerm, error: errPerm } = await supabase.rpc("tem_permissao", {
      p_permissao: "editar_qualquer_demanda",
    });
    if (errPerm) return json({ error: `Erro ao checar permissão: ${errPerm.message}` }, 500);
    if (!temPerm) return json({ error: "Sem permissão para comunicar o cliente" }, 403);

    const { data: contexto, error: errCtx } = await supabase.rpc(
      "obter_dados_comunicacao_demanda",
      { p_demanda_id: demanda_id },
    );
    if (errCtx) return json({ error: `Erro ao buscar demanda: ${errCtx.message}` }, 500);

    const ctx = contexto as any;
    const solicitanteId: string | null = ctx?.solicitante?.id ?? null;
    const nomeDestinatario: string | null = ctx?.solicitante?.nome ?? null;
    const codigoDemanda: string | null = ctx?.demanda?.codigo ?? null;

    // ─── E-MAIL ────────────────────────────────────────────────────────────
    if (canal === "email") {
      const destino = String(body.email ?? ctx?.solicitante?.email ?? "").trim();
      if (!destino) return json({ error: "Solicitante sem e-mail cadastrado" }, 422);

      const assunto =
        assuntoInformado ||
        `Atualização da sua solicitação${codigoDemanda ? ` (${codigoDemanda})` : ""}`;

      // O token viaja no Reply-To e volta na resposta do cliente. Gerado antes
      // do envio porque precisa estar dentro da mensagem; gravado depois, junto
      // com o registro do envio.
      const credenciais = await carregarCredenciaisEnvio(supabaseUrl, serviceKey);
      const replyToken = gerarReplyToken();
      const responderPara = "erro" in credenciais
        ? null
        : enderecoDeResposta(replyToken, credenciais.baseResposta);
      if (!("erro" in credenciais) && !responderPara) {
        console.warn(
          `[notificar-cliente-demanda] sem Reply-To: base ${credenciais.baseResposta} (${credenciais.origem}) inválida — a resposta do cliente não será correlacionada`,
        );
      }

      const envio = "erro" in credenciais
        ? { ok: false as const, erro: credenciais.erro }
        : await enviarEmail(credenciais, destino, assunto, corpo, responderPara);

      const { error: errReg } = await supabase.rpc("registrar_comunicacao_demanda", {
        p_demanda_id: demanda_id,
        p_canal: "email",
        p_corpo_texto: corpo,
        p_email_destinatario: destino,
        p_nome_destinatario: nomeDestinatario,
        p_assunto: assunto,
        p_status: envio.ok ? "enviado" : "falha",
        p_erro_detalhe: envio.ok ? null : envio.erro,
        p_reply_token: responderPara ? replyToken : null,
      });
      if (errReg) console.error("[notificar-cliente-demanda] registro falhou:", errReg);

      if (!envio.ok) return json({ error: `Falha no envio do e-mail: ${envio.erro}` }, 502);
      return json({ ok: true, canal: "email", destinatario: destino, assunto });
    }

    // ─── WHATSAPP ──────────────────────────────────────────────────────────
    const telefoneBruto = String(body.telefone ?? ctx?.solicitante?.telefone ?? "");
    const telefone = normalizarTelefone(telefoneBruto);
    if (!telefone) {
      return json(
        { error: "Telefone do solicitante ausente ou inválido", code: "telefone_invalido" },
        422,
      );
    }

    const envio = await enviarWhatsApp(telefone, corpo, codigoDemanda);

    const { error: errReg } = await supabase.rpc("registrar_comunicacao_demanda", {
      p_demanda_id: demanda_id,
      p_canal: "whatsapp",
      p_corpo_texto: corpo,
      p_telefone_destinatario: telefone,
      p_nome_destinatario: nomeDestinatario,
      p_status: envio.ok ? "enviado" : "falha",
      p_erro_detalhe: envio.ok ? null : envio.erro,
      p_provider_message_id: envio.ok ? envio.messageId : null,
    });
    if (errReg) console.error("[notificar-cliente-demanda] registro falhou:", errReg);

    if (!envio.ok) return json({ error: `Falha no envio do WhatsApp: ${envio.erro}` }, 502);

    // Deu certo e o agente digitou um número diferente do que estava salvo:
    // guarda pro próximo envio. Precisa de service_role — o agente não tem RLS
    // de update no profile de outra pessoa.
    const telefoneSalvo = normalizarTelefone(String(ctx?.solicitante?.telefone ?? ""));
    if (solicitanteId && telefone !== telefoneSalvo) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: errTel } = await admin
        .from("profiles")
        .update({ telefone })
        .eq("id", solicitanteId);
      if (errTel) console.error("[notificar-cliente-demanda] não salvou telefone:", errTel);
    }

    return json({
      ok: true,
      canal: "whatsapp",
      destinatario: telefone,
      messageId: envio.messageId,
    });
  } catch (err) {
    console.error("[notificar-cliente-demanda] CATCH:", err);
    return json({ error: String(err) }, 500);
  }
});
