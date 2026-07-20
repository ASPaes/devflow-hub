// supabase/functions/agente-callback/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { verificarAssinatura } from "../_shared/hmac.ts";
import { isStatusAgente, transicaoValida } from "../_shared/status.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-agente-assinatura",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Lê o corpo CRU (a assinatura é sobre os bytes exatos)
    const raw = await req.text();
    const assinatura = req.headers.get("x-agente-assinatura") ?? "";
    const body = JSON.parse(raw || "{}");

    const execucaoId = body?.execucao_id as string | undefined;
    const novoStatus = body?.status as string | undefined;
    if (!execucaoId || !novoStatus) {
      return json({ error: "execucao_id e status são obrigatórios" }, 400);
    }
    if (!isStatusAgente(novoStatus)) {
      return json({ error: "status inválido" }, 400);
    }

    // Carrega a execução (inclui o secret — só acessível via service role)
    const { data: exec, error } = await admin
      .from("agente_execucoes")
      .select("id, status, callback_secret, demanda_id, disparado_por")
      .eq("id", execucaoId)
      .single();
    if (error || !exec) return json({ error: "Execução não encontrada" }, 404);

    // Verifica a assinatura
    const ok = await verificarAssinatura(
      (exec as any).callback_secret,
      raw,
      assinatura,
    );
    if (!ok) return json({ error: "Assinatura inválida" }, 401);

    // Idempotência: mesmo status repetido = replay/retry do webhook (GitHub entrega
    // at-least-once). É um no-op: não recria Retorno nem mexe em finished_at.
    if ((exec as any).status === novoStatus) {
      return json({ ok: true, idempotente: true }, 200);
    }

    // Valida a transição
    if (!transicaoValida((exec as any).status, novoStatus as any)) {
      return json(
        { error: `Transição inválida ${(exec as any).status} → ${novoStatus}` },
        409,
      );
    }

    const terminal = ["concluida", "falhou", "cancelada"].includes(novoStatus);
    const patch: Record<string, unknown> = {
      status: novoStatus,
      updated_at: new Date().toISOString(),
    };
    if (body.github_run_id != null) patch.github_run_id = body.github_run_id;
    if (body.github_run_url) patch.github_run_url = body.github_run_url;
    if (body.pr_url) patch.pr_url = body.pr_url;
    if (body.deploy_url) patch.deploy_url = body.deploy_url;
    if (body.resumo) patch.resumo = body.resumo;
    if (body.erro_mensagem) patch.erro_mensagem = body.erro_mensagem;
    if (terminal) patch.finished_at = new Date().toISOString();

    // Na conclusão com resumo: cria o Retorno na demanda
    if (novoStatus === "concluida" && body.resumo) {
      const { data: retorno, error: retErr } = await admin
        .from("demanda_retornos")
        .insert({
          demanda_id: (exec as any).demanda_id,
          texto: body.resumo,
          autor_id: (exec as any).disparado_por,
        })
        .select("id")
        .single();
      if (retErr || !retorno) {
        return json(
          { error: `Falha ao criar retorno: ${retErr?.message ?? "desconhecido"}` },
          500,
        );
      }
      patch.retorno_id = retorno.id;
    }

    const { error: upErr } = await admin
      .from("agente_execucoes")
      .update(patch)
      .eq("id", execucaoId);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
