// supabase/functions/disparar-agente/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { montarPromptAgente } from "../_shared/contexto.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Gera um segredo aleatório para assinar os callbacks desta execução.
function novoSecret(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sem autorização" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GITHUB_TOKEN = Deno.env.get("GITHUB_AGENTE_TOKEN")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Permissão
    const { data: permOk, error: permErr } = await userClient.rpc(
      "tem_permissao",
      { p_permissao: "acionar_agente_correcao" },
    );
    if (permErr || !permOk) return json({ error: "Sem permissão" }, 403);

    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // 2. Input
    const body = await req.json().catch(() => null);
    const demandaId = body?.demanda_id as string | undefined;
    if (!demandaId) return json({ error: "demanda_id é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 3. Demanda + produto (config de repo)
    const { data: demanda, error: demErr } = await admin
      .from("demandas")
      .select(
        `id, codigo, titulo, descricao, prompt_ia,
         produto:produtos(
           github_owner, github_repo, branch_base, workflow_file, auto_deploy
         )`,
      )
      .eq("id", demandaId)
      .single();
    if (demErr || !demanda) return json({ error: "Demanda não encontrada" }, 404);

    const prod: any = (demanda as any).produto;
    if (!prod?.github_owner || !prod?.github_repo || !prod?.workflow_file) {
      return json(
        { error: "O produto desta demanda não tem repositório configurado" },
        400,
      );
    }

    // 4. Comentários (contexto) — tabela demanda_comentarios, coluna conteudo
    const { data: comentarios } = await admin
      .from("demanda_comentarios")
      .select("conteudo, autor:profiles(nome)")
      .eq("demanda_id", demandaId)
      .order("created_at", { ascending: true });

    // 5. Imagens anexadas → URLs assinadas (input multimodal)
    const { data: anexos } = await admin
      .from("demanda_anexos")
      .select("storage_path, mime_type")
      .eq("demanda_id", demandaId);

    const imagens: string[] = [];
    for (const a of (anexos ?? []) as any[]) {
      if (!a.mime_type?.startsWith("image/")) continue;
      const { data: signed } = await admin.storage
        .from("demanda-anexos")
        .createSignedUrl(a.storage_path, 60 * 30); // 30 min
      if (signed?.signedUrl) imagens.push(signed.signedUrl);
    }

    // 6. Prompt: usa prompt_ia salvo, senão monta o contexto
    const promptBase =
      (demanda as any).prompt_ia?.trim() ||
      montarPromptAgente({
        codigo: (demanda as any).codigo ?? demandaId,
        titulo: (demanda as any).titulo ?? "",
        descricao: (demanda as any).descricao ?? "",
        comentarios: ((comentarios ?? []) as any[]).map((c) => ({
          autor: c.autor?.nome ?? "alguém",
          texto: c.conteudo ?? "",
        })),
      });

    // 7. Cria a execução
    const callbackSecret = novoSecret();
    const { data: exec, error: execErr } = await admin
      .from("agente_execucoes")
      .insert({
        demanda_id: demandaId,
        status: "enfileirada",
        callback_secret: callbackSecret,
        disparado_por: userId,
      })
      .select("id")
      .single();
    if (execErr || !exec) {
      return json({ error: execErr?.message ?? "Falha ao criar execução" }, 500);
    }

    // 8. Dispara o workflow no repo do DoctorSaaS
    const callbackUrl = `${SUPABASE_URL}/functions/v1/agente-callback`;
    const payload = JSON.stringify({
      demanda_codigo: (demanda as any).codigo ?? demandaId,
      prompt: promptBase,
      imagens,
    });

    const ghResp = await fetch(
      `https://api.github.com/repos/${prod.github_owner}/${prod.github_repo}/actions/workflows/${prod.workflow_file}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "devflow-hub-agente",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: prod.branch_base ?? "main",
          inputs: {
            execucao_id: exec.id,
            callback_url: callbackUrl,
            callback_secret: callbackSecret,
            auto_deploy: String(!!prod.auto_deploy),
            payload,
          },
        }),
      },
    );

    if (!ghResp.ok) {
      const txt = await ghResp.text();
      await admin
        .from("agente_execucoes")
        .update({
          status: "falhou",
          erro_mensagem: `Falha ao disparar workflow (${ghResp.status}): ${txt}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", exec.id);
      return json({ error: "Falha ao disparar o workflow", detalhe: txt }, 502);
    }

    return json({ execucao_id: exec.id }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
