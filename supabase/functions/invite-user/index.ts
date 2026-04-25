// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sem autorização" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente com JWT do usuário pra validar permissão
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: permOk, error: permErr } = await userClient.rpc(
      "tem_permissao",
      { p_permissao: "gerenciar_usuarios" },
    );
    if (permErr || !permOk) {
      return json({ error: "Sem permissão" }, 403);
    }

    const body = await req.json().catch(() => null);
    const email = body?.email as string | undefined;
    const nome = body?.nome as string | undefined;
    const perfil_acesso_id = body?.perfil_acesso_id as string | undefined;
    const tenant_id = body?.tenant_id as string | undefined;

    if (!email || !nome || !perfil_acesso_id || !tenant_id) {
      return json(
        { error: "email, nome, perfil_acesso_id e tenant_id são obrigatórios" },
        400,
      );
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: inviteData, error: inviteErr } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { nome, tenant_id },
      });
    if (inviteErr) return json({ error: inviteErr.message }, 400);

    const userId = inviteData.user?.id;
    if (!userId) {
      return json({ error: "Convite criado mas sem userId" }, 500);
    }

    // O trigger handle_new_user já criou o profile com tenant_id do metadata.
    // Atualiza pra o perfil escolhido.
    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ perfil_acesso_id, nome, tenant_id })
      .eq("id", userId);
    if (updateErr) return json({ error: updateErr.message }, 400);

    return json({ ok: true, userId }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
