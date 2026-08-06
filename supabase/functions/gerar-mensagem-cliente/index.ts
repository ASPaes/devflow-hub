// gerar-mensagem-cliente — redige, com IA, a mensagem de parecer/conclusão que o
// agente vai enviar ao solicitante por e-mail ou WhatsApp.
//
// O texto NÃO é enviado aqui: esta function só devolve assunto + corpo para o
// agente revisar e editar. O envio é da `notificar-cliente-demanda`.
//
// Mesmo padrão de auth/modelo das outras functions de IA do DoctorDev
// (gerar-prompt-demanda, gerar-resumo-release-ia).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Canal = "email" | "whatsapp";
type Momento = "parecer" | "conclusao";

const DIRETRIZES_COMUNS = `
Você escreve em nome da equipe de desenvolvimento para o CLIENTE que abriu a demanda.

REGRAS INEGOCIÁVEIS:
- Escreva em português do Brasil.
- Use APENAS o que está nos dados. NÃO invente prazo, causa, valor, versão ou próximo passo que não esteja lá.
- Nada de jargão técnico com o cliente: sem "RLS", "trigger", "endpoint", "API", "RPC", "deploy", "commit", "frontend", "backend", "migration".
- NÃO cite código da demanda, IDs internos, nome de tabela ou de arquivo.
- NÃO prometa data se os dados não trouxerem uma.
- Voz ativa e direta: "Ajustamos", "Identificamos", "Concluímos".
- Trate o cliente pelo primeiro nome quando ele estiver nos dados.
- Se os pareceres registrados forem técnicos, TRADUZA para o efeito prático que o cliente percebe.
`.trim();

const TOM_POR_MOMENTO: Record<Momento, string> = {
  parecer: `
MOMENTO: parecer parcial — a demanda AINDA NÃO foi entregue.
- Diga o ponto em que a análise está e o que já foi identificado.
- NÃO diga que está resolvido, concluído ou entregue.
- Se os pareceres indicarem que algo é esperado do cliente, deixe isso claro em uma frase.
`.trim(),
  conclusao: `
MOMENTO: conclusão — a demanda foi ENTREGUE.
- Diga o que foi resolvido/entregue e o que muda na prática para o cliente.
- Feche convidando o cliente a validar e a responder se algo não estiver como esperado.
`.trim(),
};

const FORMATO_POR_CANAL: Record<Canal, string> = {
  email: `
CANAL: e-mail.
- "assunto": até 70 caracteres, específico, sem "Re:" e sem código de demanda.
- "corpo": texto puro, com saudação e despedida. 2 a 4 parágrafos curtos, no máximo 180 palavras.
- SEM markdown: nada de #, *, - ou \`\`\`. Quebre parágrafos com linha em branco.
- Assine como "Equipe de Desenvolvimento".
`.trim(),
  whatsapp: `
CANAL: WhatsApp.
- "assunto": string vazia — WhatsApp não tem assunto.
- "corpo": mensagem curta, no máximo 90 palavras, conversa de trabalho e não carta.
- Comece com uma saudação curta. Sem despedida formal e sem assinatura.
- Negrito é *entre asteriscos simples* (formato do WhatsApp). Nada de markdown.
- No máximo um emoji, e só se couber naturalmente. Nunca mais de um.
`.trim(),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Body inválido" }, 400);

    const demanda_id: string | undefined = body.demanda_id;
    const canal: Canal = body.canal === "whatsapp" ? "whatsapp" : "email";
    if (!demanda_id) return json({ error: "demanda_id obrigatório" }, 400);

    // Mesma permissão que as RPCs de comunicação exigem
    const { data: temPerm, error: errPerm } = await supabase.rpc("tem_permissao", {
      p_permissao: "editar_qualquer_demanda",
    });
    if (errPerm) {
      return json({ error: `Erro ao checar permissão: ${errPerm.message}` }, 500);
    }
    if (!temPerm) {
      return json({ error: "Sem permissão para comunicar o cliente" }, 403);
    }

    const { data: contexto, error: errCtx } = await supabase.rpc(
      "obter_dados_comunicacao_demanda",
      { p_demanda_id: demanda_id },
    );
    if (errCtx) {
      return json({ error: `Erro ao buscar demanda: ${errCtx.message}` }, 500);
    }

    const ctx = contexto as any;
    const retornos: unknown[] = Array.isArray(ctx?.retornos) ? ctx.retornos : [];
    if (retornos.length === 0) {
      return json(
        {
          error:
            "Nenhum retorno com texto nesta demanda. Registre o parecer antes de gerar a mensagem.",
        },
        422,
      );
    }

    // O momento pode vir do frontend; senão deriva do status da demanda.
    const statusDemanda: string = ctx?.demanda?.status ?? "";
    const momento: Momento =
      body.momento === "parecer" || body.momento === "conclusao"
        ? body.momento
        : ["entregue", "encerrada"].includes(statusDemanda)
          ? "conclusao"
          : "parecer";

    const systemPrompt = [
      DIRETRIZES_COMUNS,
      TOM_POR_MOMENTO[momento],
      FORMATO_POR_CANAL[canal],
      `Responda APENAS com o JSON puro {"assunto": "...", "corpo": "..."} — sem markdown, sem \`\`\`json, sem preâmbulo.`,
    ].join("\n\n");

    // Só o que o cliente pode ver. O prompt_ia e os dados internos ficam de fora.
    const dadosParaIA = {
      demanda: {
        titulo: ctx?.demanda?.titulo ?? null,
        descricao: ctx?.demanda?.descricao ?? null,
        tipo: ctx?.demanda?.tipo ?? null,
        status: statusDemanda || null,
      },
      empresa: ctx?.empresa ?? null,
      solicitante_nome: ctx?.solicitante?.nome ?? null,
      pareceres: retornos,
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Dados da demanda:\n${JSON.stringify(dadosParaIA, null, 2)}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[gerar-mensagem-cliente] anthropic", anthropicRes.status, errText);
      return json({ error: `Anthropic ${anthropicRes.status}: ${errText}` }, 500);
    }

    const anthropicData = await anthropicRes.json();
    const textRaw: string =
      anthropicData.content
        ?.filter((b: any) => b.type === "text")
        ?.map((b: any) => b.text)
        ?.join("") ?? "";

    let parsed: { assunto?: string; corpo?: string };
    try {
      parsed = JSON.parse(textRaw.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return json({ error: "IA retornou formato inválido", raw: textRaw }, 500);
    }

    if (!parsed.corpo || !parsed.corpo.trim()) {
      return json({ error: "IA retornou mensagem vazia", raw: textRaw }, 500);
    }

    return json({
      canal,
      momento,
      assunto: canal === "email" ? (parsed.assunto ?? "").trim() : "",
      corpo: parsed.corpo.trim(),
      usage: {
        input_tokens: anthropicData.usage?.input_tokens ?? 0,
        output_tokens: anthropicData.usage?.output_tokens ?? 0,
      },
    });
  } catch (err) {
    console.error("[gerar-mensagem-cliente] CATCH:", err);
    return json({ error: String(err) }, 500);
  }
});
