// Feed das releases publicadas do DoctorSaaS, lido pela aba "Evolução DS"
// dentro do proprio DoctorSaaS. Leitura pura, sem login (igual a latest-release):
// o conteudo e o mesmo feed de Releases que os clientes ja acompanham.
//
// ?tenant=<doctorsaas_tenant_id> (opcional) marca `pedido_pela_sua_empresa`
// nas releases cuja demanda foi aberta por aquela empresa. Nao devolvemos o
// nome nem o id de quem pediu: so o booleano relativo a quem perguntou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Produto "DoctorSaaS" na tabela produtos do DoctorDev.
const PRODUTO_DOCTORSAAS = "d087f605-e5a0-41c6-b95a-05f279353a0e";

// tipos_demanda.codigo -> tipo mostrado ao cliente. Duvida e tarefa ficam de fora.
const TIPOS: Record<string, "nova_funcionalidade" | "melhoria" | "correcao"> = {
  nova_funcionalidade: "nova_funcionalidade",
  melhoria: "melhoria",
  erro: "correcao",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

// PostgREST corta em 1000 linhas por pagina.
async function todas<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const tenantParam = url.searchParams.get("tenant");
    const tenantDs = tenantParam && UUID_RE.test(tenantParam) ? tenantParam : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    type Rel = {
      id: string; titulo: string | null; resumo: string | null; tipo_codigo: string | null;
      demanda_id: string | null; published_at: string | null; data_publicacao: string | null;
    };
    const releases = await todas<Rel>((a, b) =>
      supabase
        .from("vw_releases_publicadas")
        .select("id, titulo, resumo, tipo_codigo, demanda_id, published_at, data_publicacao")
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(a, b)
    );

    const demandaIds = [...new Set(releases.map((r) => r.demanda_id).filter(Boolean))] as string[];
    type Dem = { id: string; produto_id: string | null; modulo_id: string | null; tenant_id: string | null };
    const demandas: Dem[] = [];
    for (let i = 0; i < demandaIds.length; i += 200) {
      const { data, error } = await supabase
        .from("demandas")
        .select("id, produto_id, modulo_id, tenant_id")
        .in("id", demandaIds.slice(i, i + 200));
      if (error) throw error;
      demandas.push(...((data ?? []) as Dem[]));
    }
    const demPorId = new Map(demandas.map((d) => [d.id, d]));

    const [{ data: modulos }, { data: tenants }] = await Promise.all([
      supabase.from("modulos").select("id, nome"),
      tenantDs
        ? supabase.from("tenants").select("id").eq("doctorsaas_tenant_id", tenantDs)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    const moduloNome = new Map((modulos ?? []).map((m: { id: string; nome: string }) => [m.id, m.nome]));
    const tenantsDoCliente = new Set((tenants ?? []).map((t: { id: string }) => t.id));

    // Conteúdo da novidade (vídeo, passo a passo com print, para que serve), gravado
    // pelo /novidade do DoctorSaaS. Poucas releases têm, então vem numa query só.
    type Extra = {
      id: string; video_url: string | null; passo_a_passo: unknown;
      para_que_serve: string[] | null; destaque: boolean;
    };
    const { data: extras, error: extrasErr } = await supabase
      .from("releases")
      .select("id, video_url, passo_a_passo, para_que_serve, destaque")
      .or("video_url.not.is.null,passo_a_passo.not.is.null,para_que_serve.not.is.null,destaque.eq.true");
    if (extrasErr) throw extrasErr;
    const extraPorId = new Map(((extras ?? []) as Extra[]).map((e) => [e.id, e]));

    const itens = releases.flatMap((r) => {
      const tipo = TIPOS[r.tipo_codigo ?? ""];
      const dem = r.demanda_id ? demPorId.get(r.demanda_id) : undefined;
      if (!tipo || !dem || dem.produto_id !== PRODUTO_DOCTORSAAS) return [];
      const publicado = r.published_at ?? r.data_publicacao;
      if (!publicado || !r.titulo) return [];
      return [{
        id: r.id,
        titulo: r.titulo,
        resumo: r.resumo ?? "",
        tipo,
        modulo: dem.modulo_id ? moduloNome.get(dem.modulo_id) ?? null : null,
        publicado_em: publicado,
        pedido_pela_sua_empresa: !!dem.tenant_id && tenantsDoCliente.has(dem.tenant_id),
        video_url: extraPorId.get(r.id)?.video_url ?? null,
        passo_a_passo: Array.isArray(extraPorId.get(r.id)?.passo_a_passo) ? extraPorId.get(r.id)!.passo_a_passo : null,
        para_que_serve: extraPorId.get(r.id)?.para_que_serve ?? null,
        destaque: extraPorId.get(r.id)?.destaque ?? false,
      }];
    });

    return json({ itens });
  } catch (err) {
    console.error("[releases-feed] erro:", err);
    return json({ error: "Falha ao carregar o feed" }, 500);
  }
});
