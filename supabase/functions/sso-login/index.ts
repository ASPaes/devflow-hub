import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySignature(payloadB64: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ssoSecret = Deno.env.get("SSO_SHARED_SECRET");
    const redirectTo = Deno.env.get("SSO_REDIRECT_TO") || "https://doctordev.lovable.app/sso-callback";

    if (!ssoSecret) {
      console.error("[sso-login] SSO_SHARED_SECRET ausente");
      return json({ error: "SSO secret não configurado" }, 500);
    }

    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body inválido" }, 400);
    }

    const token = body.token;
    if (!token || typeof token !== "string") return json({ error: "Token ausente" }, 400);

    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return json({ error: "Token malformado" }, 400);

    const valid = await verifySignature(payloadB64, signature, ssoSecret);
    if (!valid) return json({ error: "Assinatura inválida" }, 401);

    let payload: any;
    try {
      payload = JSON.parse(atob(payloadB64));
    } catch {
      return json({ error: "Payload inválido" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return json({ error: "Token expirado" }, 401);
    }

    const email: string | undefined = payload.email;
    const name: string = payload.name || email || "";
    const dsTenantId: string | undefined = payload.tenant_id;
    const tenantNome: string = payload.tenant_nome || "";

    if (!email || !dsTenantId) return json({ error: "Payload incompleto" }, 400);

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Resolver tenant local pelo mapeamento doctorsaas_tenant_id
    let { data: tenantRow } = await supabase
      .from("tenants")
      .select("id, nome")
      .eq("doctorsaas_tenant_id", dsTenantId)
      .maybeSingle();

    if (!tenantRow) {
      const { data: created, error: createErr } = await supabase
        .from("tenants")
        .insert({
          nome: tenantNome || `Tenant ${dsTenantId.substring(0, 8)}`,
          doctorsaas_tenant_id: dsTenantId,
          ativo: true,
        })
        .select("id, nome")
        .single();
      if (createErr || !created) {
        console.error("[sso-login] tenant insert", createErr);
        return json({ error: "Falha ao criar tenant", detail: createErr?.message }, 500);
      }
      tenantRow = created;
    }

    // 2) Resolver perfil padrão de novos usuários
    const { data: perfil } = await supabase
      .from("perfis_acesso")
      .select("id, nome")
      .eq("perfil_padrao_novos_usuarios", true)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!perfil) {
      console.error("[sso-login] nenhum perfil padrão configurado");
      return json({ error: "Nenhum perfil padrão configurado" }, 500);
    }

    // 3) Resolver / criar user em auth.users
    const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      console.error("[sso-login] listUsers", listErr);
      return json({ error: "Falha ao listar usuários", detail: listErr.message }, 500);
    }

    let user = usersList.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;

    if (!user) {
      const { data: created, error: createUserErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          name,
          origem: "doctorsaas_sso",
          tenant_id: dsTenantId,
          tenant_nome: tenantNome,
        },
      });
      if (createUserErr || !created.user) {
        console.error("[sso-login] createUser", createUserErr);
        return json({ error: "Falha ao criar usuário", detail: createUserErr?.message }, 500);
      }
      user = created.user;

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: user.id,
        nome: name,
        tenant_id: tenantRow!.id,
        perfil_acesso_id: perfil.id,
        ativo: true,
      });
      if (profileErr) {
        console.error("[sso-login] profile insert", profileErr);
      }
    } else {
      // Usuário já existe: atualiza metadata para refletir tenant atual no DoctorSaaS
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          name,
          origem: "doctorsaas_sso",
          tenant_id: dsTenantId,
          tenant_nome: tenantNome,
        },
      });

      // Garante profile alinhado ao tenant local atual
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          id: user.id,
          nome: name,
          tenant_id: tenantRow!.id,
          perfil_acesso_id: perfil.id,
          ativo: true,
        });
      } else if (existingProfile.tenant_id !== tenantRow!.id) {
        await supabase
          .from("profiles")
          .update({ tenant_id: tenantRow!.id, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }

    // 4) Magic link com redirect para /sso-callback
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error("[sso-login] generateLink", linkErr);
      return json({ error: "Falha ao gerar magic link", detail: linkErr?.message }, 500);
    }

    return json({ magic_link: linkData.properties.action_link });
  } catch (err) {
    console.error("[sso-login] fatal", err);
    return json({ error: String(err) }, 500);
  }
});
