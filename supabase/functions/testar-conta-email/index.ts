// testar-conta-email — "Salvar e testar" da tela Configurações › E-mail.
//
// Abre conexão de verdade com o servidor de envio (SMTP) e, se houver, com o de
// leitura (IMAP), usando a conta gravada em public.email_conta. Grava o
// resultado na própria conta e devolve a frase traduzida para a tela.
//
// A senha não trafega do navegador: sai do Vault aqui dentro, pela
// obter_conta_email_servico (só service_role). Nenhuma senha volta na resposta.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

import { mensagemAmigavel, verificarImap, verificarSmtp, type EmailSecurity } from "./smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** O leitor de respostas (ler-respostas-email) só abre conexão TLS direta. */
const ERRO_LEITURA_SEM_SSL =
  "O DoctorDev só lê a caixa de entrada com SSL/TLS. Troque a segurança da entrada para SSL/TLS (porta 993).";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Mesmo portão da tela e da salvar_conta_email: admin = as duas permissões.
  const usuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const [p1, p2] = await Promise.all([
    usuario.rpc("tem_permissao", { p_permissao: "gerenciar_usuarios" }),
    usuario.rpc("tem_permissao", { p_permissao: "gerenciar_perfis_acesso" }),
  ]);
  if (p1.error || p2.error) {
    return json({ error: `Erro ao checar permissão: ${(p1.error ?? p2.error)!.message}` }, 500);
  }
  if (p1.data !== true || p2.data !== true) {
    return json({ error: "Apenas administradores podem testar a conta de e-mail." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: conta, error: errConta } = await admin.rpc("obter_conta_email_servico");
  if (errConta) return json({ error: `Erro ao ler a conta: ${errConta.message}` }, 500);
  if (!conta) return json({ error: "Nenhuma conta de e-mail cadastrada." }, 404);

  const resultado: {
    smtp: { ok: boolean; erro?: string };
    imap: { ok: boolean; erro?: string } | null;
  } = { smtp: { ok: false }, imap: null };
  let erroTecnico: string | null = null;

  try {
    await verificarSmtp({
      host: conta.smtp_host,
      port: conta.smtp_porta,
      security: conta.smtp_seguranca as EmailSecurity,
      username: conta.usuario,
      password: conta.senha,
    });
    resultado.smtp.ok = true;
  } catch (e) {
    const bruto = e instanceof Error ? e.message : String(e);
    erroTecnico = `SMTP: ${bruto}`;
    resultado.smtp.erro = mensagemAmigavel(bruto);
  }

  // Entrada é opcional: conta só de envio não tem servidor de leitura.
  if (conta.imap_host) {
    resultado.imap = { ok: false };
    if (conta.imap_seguranca !== "ssl") {
      resultado.imap.erro = ERRO_LEITURA_SEM_SSL;
      erroTecnico = [erroTecnico, `IMAP: segurança ${conta.imap_seguranca}`].filter(Boolean).join(" | ");
    } else {
      try {
        await verificarImap({
          host: conta.imap_host,
          port: conta.imap_porta ?? 993,
          security: "ssl",
          username: conta.usuario,
          password: conta.senha,
        });
        resultado.imap.ok = true;
      } catch (e) {
        const bruto = e instanceof Error ? e.message : String(e);
        erroTecnico = [erroTecnico, `IMAP: ${bruto}`].filter(Boolean).join(" | ");
        resultado.imap.erro = mensagemAmigavel(bruto);
      }
    }
  }

  const ok = resultado.smtp.ok && (resultado.imap === null || resultado.imap.ok);
  const mensagem = ok
    ? resultado.imap === null
      ? "Envio testado com sucesso. Esta conta não lê respostas dos clientes."
      : "Envio e leitura testados com sucesso."
    : (resultado.smtp.erro ?? resultado.imap?.erro ?? "Falha no teste.");

  const { error: errGravar } = await admin
    .from("email_conta")
    .update({
      ultimo_teste_em: new Date().toISOString(),
      ultimo_teste_ok: ok,
      // o técnico fica para investigação; a tela mostra a frase
      ultimo_teste_erro: ok ? null : `${mensagem} [${erroTecnico ?? "sem detalhe"}]`,
    })
    .eq("id", 1);
  if (errGravar) console.error("[testar-conta-email] não gravou o resultado:", errGravar.message);

  return json({ ok, mensagem, ...resultado });
});
