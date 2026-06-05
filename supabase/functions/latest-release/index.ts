import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: latest, error: latestErr } = await supabase
      .from("vw_releases_publicadas")
      .select("published_at, data_publicacao")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      console.error("[latest-release] query latest error:", latestErr);
    }

    const { count, error: countErr } = await supabase
      .from("vw_releases_publicadas")
      .select("*", { count: "exact", head: true });

    if (countErr) {
      console.error("[latest-release] query count error:", countErr);
    }

    const ultimaData = latest?.published_at ?? latest?.data_publicacao ?? null;

    return json({
      ultima_data_publicacao: ultimaData,
      total: count ?? 0,
    });
  } catch (err) {
    console.error("[latest-release] fatal error:", err);
    return json({ ultima_data_publicacao: null, total: 0 });
  }
});
