// sso-login v1 — SSO integration DoctorSaaS → DoctorDev
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.85.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifySignature(payloadB64: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ssoSecret = Deno.env.get('SSO_SHARED_SECRET')!;

    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: 'Token ausente' }), { status: 400, headers: corsHeaders });

    const parts = token.split('.');
    if (parts.length !== 2) return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: corsHeaders });

    const [payloadB64, signature] = parts;

    const valid = await verifySignature(payloadB64, signature, ssoSecret);
    if (!valid) return new Response(JSON.stringify({ error: 'Assinatura inválida' }), { status: 401, headers: corsHeaders });

    const payload = JSON.parse(atob(payloadB64));

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verificar se usuário já existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === payload.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Atualizar metadata com tenant info
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existing.user_metadata,
          tenant_id: payload.tenant_id,
          tenant_nome: payload.tenant_nome,
          company: payload.tenant_nome,
        },
      });
    } else {
      // Criar usuário novo
      const password = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: payload.email,
        password,
        email_confirm: true,
        user_metadata: {
          name: payload.name,
          tenant_id: payload.tenant_id,
          tenant_nome: payload.tenant_nome,
          company: payload.tenant_nome,
          origem: 'doctorsaas_sso',
        },
      });

      if (createError || !newUser.user) {
        console.error('[sso-login] Erro ao criar usuário:', createError);
        return new Response(JSON.stringify({ error: 'Erro ao criar usuário' }), { status: 500, headers: corsHeaders });
      }

      userId = newUser.user.id;
    }

    // Gerar magic link para login automático
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: payload.email,
    });

    if (sessionError || !session) {
      console.error('[sso-login] Erro ao gerar magic link:', sessionError);
      return new Response(JSON.stringify({ error: 'Erro ao gerar sessão' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      ok: true,
      magic_link: session.properties?.action_link,
      email: payload.email,
      name: payload.name,
      tenant_nome: payload.tenant_nome,
      is_new: !existing,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[sso-login]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
