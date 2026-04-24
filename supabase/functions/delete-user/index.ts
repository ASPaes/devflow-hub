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

const ADMIN_PERMS = ["gerenciar_usuarios", "gerenciar_perfis_acesso"];

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

    const {
      data: { user: callerUser },
    } = await userClient.auth.getUser();

    const body = await req.json().catch(() => null);
    const userId = body?.userId as string | undefined;
    if (!userId) return json({ error: "userId obrigatório" }, 400);

    if (callerUser?.id === userId) {
      return json(
        { error: "Você não pode excluir sua própria conta" },
        400,
      );
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("ativo, perfil_acesso:perfis_acesso(permissoes)")
      .eq("id", userId)
      .single();

    const targetPerms: string[] =
      (targetProfile?.perfil_acesso as any)?.permissoes ?? [];
    const targetIsAdmin =
      targetProfile?.ativo &&
      ADMIN_PERMS.every((p) => targetPerms.includes(p));

    if (targetIsAdmin) {
      // Conta outros admins ativos manualmente (mais seguro que contains em FK)
      const { data: allProfiles } = await adminClient
        .from("profiles")
        .select("id, ativo, perfil_acesso:perfis_acesso(permissoes)")
        .eq("ativo", true);

      const outrosAdmins = (allProfiles ?? []).filter((p: any) => {
        if (p.id === userId) return false;
        const perms: string[] = p.perfil_acesso?.permissoes ?? [];
        return ADMIN_PERMS.every((perm) => perms.includes(perm));
      });

      if (outrosAdmins.length === 0) {
        return json(
          { error: "Não é possível excluir o último administrador" },
          400,
        );
      }
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      console.error("deleteUser error:", error.message);
      return json({ error: error.message }, 400);
    }

    return json({ ok: true }, 200);
  } catch (e: any) {
    console.error("delete-user exception:", e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
