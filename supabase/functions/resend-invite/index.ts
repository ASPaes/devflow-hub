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
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sem autorização" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: permOk, error: permErr } = await userClient.rpc(
      "tem_permissao",
      { p_permissao: "gerenciar_usuarios" },
    );
    if (permErr || !permOk) return json({ error: "Sem permissão" }, 403);

    const body = await req.json().catch(() => null);
    const userId = body?.userId as string | undefined;
    if (!userId) return json({ error: "userId obrigatório" }, 400);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: userData, error: getUserErr } =
      await adminClient.auth.admin.getUserById(userId);
    if (getUserErr || !userData.user) {
      return json({ error: "Usuário não encontrado" }, 404);
    }

    const email = userData.user.email!;
    const nome =
      (userData.user.user_metadata as any)?.nome || email.split("@")[0];

    if (userData.user.email_confirmed_at && userData.user.last_sign_in_at) {
      return json(
        {
          error:
            "Este usuário já ativou a conta. Use 'Redefinir senha' se necessário.",
        },
        400,
      );
    }

    const { error: inviteErr } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { nome },
      });
    if (inviteErr) {
      console.error("inviteUserByEmail error:", inviteErr.message);
      return json({ error: inviteErr.message }, 400);
    }

    return json({ ok: true }, 200);
  } catch (e: any) {
    console.error("resend-invite exception:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
