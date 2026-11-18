// gerar-resumo-release-ia: título + resumo da release (nota ao cliente final).
//
// Até 17/11/2026 esta function existia só em produção (sem cópia no repo). Foi
// baixada como estava (`supabase functions download`) e versionada aqui, com
// duas mudanças:
// 1. A IA responde por ferramenta com formato fixo (tool_choice), não por JSON em
//    texto livre. Antes, um título com aspas ("Avançar") sem escape quebrava o
//    JSON.parse e a tela só mostrava "Edge Function returned a non-2xx" (DEM-0678).
// 2. Travessão nunca sai ao cliente (sem-travessao.ts, cópia do original).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { semTravessao } from "./sem-travessao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { demanda_id } = await req.json();
    if (!demanda_id) {
      return new Response(JSON.stringify({ error: "demanda_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: temPerm, error: errPerm } = await supabase.rpc("tem_permissao", {
      p_permissao: "gerenciar_releases",
    });
    if (errPerm || !temPerm) {
      return new Response(JSON.stringify({ error: "Sem permissão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: contexto, error: errCtx } = await supabase.rpc("obter_contexto_release", {
      p_demanda_id: demanda_id,
    });
    if (errCtx) {
      return new Response(JSON.stringify({ error: `Erro: ${errCtx.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Você gera release notes para clientes finais de um produto SaaS (não desenvolvedores).

A partir de dados brutos de uma demanda interna, você produz um JSON com 2 campos:
- "titulo": frase curta (máx 60 chars), em português, descrevendo o que mudou pro cliente
- "resumo": 1-3 frases (máx 300 chars), em português, explicando o que mudou e o BENEFÍCIO pro cliente

DIRETRIZES:
- Linguagem clara, sem jargão técnico (sem "RLS", "trigger", "endpoint", "API", "RPC", "frontend", "backend")
- Foque no QUE MUDOU pro usuário, não em COMO foi feito
- Voz ativa: "Adicionamos", "Corrigimos", "Melhoramos"
- NÃO mencione códigos de demanda, IDs internos, nomes de tabela
- NÃO use markdown
- NÃO comece com "Esta release...", vá direto
- NUNCA use travessão (—), meia-risca (–) nem hífen solto como pausa (" - "). Use vírgula ou ponto.
- Use APENAS o que está nos dados. Se os retornos não dizem que algo foi feito, não diga.

EXEMPLOS:

Tipo "erro":
{"titulo":"Tempo manual no histórico do timer","resumo":"Lançamentos manuais de tempo agora são contabilizados corretamente quando uma demanda é encerrada."}

Tipo "nova_funcionalidade":
{"titulo":"Login com Google disponível","resumo":"Você agora pode entrar com sua conta Google. Não precisa criar nova senha."}

Tipo "melhoria":
{"titulo":"Filtro de empresa no Kanban","resumo":"Adicionamos filtro por empresa no quadro Kanban. Facilita focar em demandas de um cliente específico."}

Responda chamando a ferramenta "release" com os campos titulo e resumo.`;

    const userMessage = `Dados da demanda:\n${JSON.stringify(contexto, null, 2)}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        // Formato garantido pela API: o JSON chega montado, aspas no texto não quebram nada.
        tools: [
          {
            name: "release",
            description: "Entrega o título e o resumo da release.",
            input_schema: {
              type: "object",
              properties: {
                titulo: { type: "string", description: "Máx 60 caracteres." },
                resumo: { type: "string", description: "1 a 3 frases, máx 300 caracteres." },
              },
              required: ["titulo", "resumo"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "release" },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: `Anthropic ${anthropicRes.status}: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anthropicData = await anthropicRes.json();
    const bloco = anthropicData.content?.find((b: any) => b.type === "tool_use");
    const parsed = (bloco?.input ?? {}) as { titulo?: string; resumo?: string };

    if (!parsed.titulo?.trim() || !parsed.resumo?.trim()) {
      console.error("[gerar-resumo-release-ia] resposta incompleta", JSON.stringify(anthropicData.content));
      return new Response(JSON.stringify({ error: "A IA devolveu título ou resumo vazio. Tente de novo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      titulo: semTravessao(parsed.titulo.trim()),
      resumo: semTravessao(parsed.resumo.trim()),
      usage: {
        input_tokens: anthropicData.usage?.input_tokens ?? 0,
        output_tokens: anthropicData.usage?.output_tokens ?? 0,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});