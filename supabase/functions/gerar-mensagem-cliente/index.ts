// gerar-mensagem-cliente — redige, com IA, a mensagem de parecer/conclusão que o
// agente vai enviar ao solicitante por e-mail ou WhatsApp.
//
// O texto NÃO é enviado aqui: esta function só devolve assunto + corpo para o
// agente revisar e editar. O envio é da `notificar-cliente-demanda`.
//
// Mesmo padrão de auth/modelo das outras functions de IA do DoctorDev
// (gerar-prompt-demanda, gerar-resumo-release-ia).
//
// Deploy: 17/11/2026 o deploy desta versão falhou pelo CLI v3 no workflow (ver
// deploy-edge-functions.yml); reenviada junto com a correção do workflow.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";
import { semTravessao } from "./sem-travessao.ts";

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

// ──────────────────────────────────────────────────────────────────────────
// CONCEITO (revisto em 17/11/2026, DEM-0663)
//
// A mensagem é o PARECER da equipe traduzido para o cliente. Nada além disso.
//
// O que deu errado antes: na DEM-0663 o único retorno dizia "esse campo de busca
// JÁ EXISTE na tela; o que seria essa palavra-chave? mande foto/vídeo". Nada foi
// implementado. Como o card tinha ido para "entregue", o tom de conclusão mandava
// "dizer o que foi entregue", e a IA, sem entrega nenhuma no parecer, foi buscar
// na descrição (o PEDIDO do cliente) e escreveu "Finalizamos a melhoria na busca".
//
// Por isso:
// 1. O parecer mais recente define o TIPO da mensagem (entrega, pergunta ao
//    cliente, "isso já existe", em análise, recusa). O status nunca cria conteúdo.
// 2. A descrição vai rotulada como "pedido_original_do_cliente", só de contexto.
// 3. A IA devolve primeiro um campo "leitura" dizendo o que o parecer afirma e
//    pergunta; isso a obriga a ler antes de escrever. O campo não vai para a tela.
// 4. Travessão nunca: proibido no prompt e removido no servidor (sem-travessao.ts).
// ──────────────────────────────────────────────────────────────────────────

const DIRETRIZES_COMUNS = `
Você escreve em nome da equipe de desenvolvimento para o CLIENTE que abriu a demanda.
Sua tarefa é TRADUZIR para o cliente o que a equipe registrou nos "pareceres". Você não
decide o que aconteceu: quem diz são os pareceres, e só eles.

COMO LER OS DADOS:
- "pareceres": o que a equipe escreveu, em ordem. O marcado com "mais_recente": true é o
  que vale agora. Ele define o TIPO da mensagem:
  a) ENTREGA: o parecer afirma que algo foi feito, ajustado, corrigido ou liberado.
     Só aí você diz que foi feito, e só o que o parecer diz que foi feito.
  b) PERGUNTA / PEDIDO AO CLIENTE: o parecer faz perguntas ou pede informação, print,
     foto, vídeo, exemplo. A mensagem é para fazer ESSAS perguntas ao cliente, com
     clareza, uma por uma. Nada foi entregue.
  c) JÁ EXISTE: o parecer explica que o que o cliente pediu já existe no sistema.
     Diga que já existe e onde, como o parecer descreve. NÃO diga que "implementamos",
     "finalizamos", "melhoramos" ou "agora você consegue": não houve mudança.
  d) EM ANÁLISE: o parecer diz que vai analisar ou é genérico. Mensagem curta:
     recebemos e estamos analisando.
  e) RECUSA / FORA DO ESCOPO: diga isso com cordialidade, com o motivo do parecer.
  Um parecer pode misturar tipos (ex.: explica que já existe E faz perguntas). Aí a
  mensagem leva as duas coisas, sem inventar uma terceira.
- "pedido_original_do_cliente": o que o cliente PEDIU quando abriu a demanda. Serve só
  para você entender o assunto. NUNCA tire dele afirmação de que algo foi feito, existe
  ou funciona.
- "status": a etapa do card. Status "entregue" NÃO prova que algo foi implementado; se o
  parecer mais recente é pergunta ou explicação, a mensagem é pergunta ou explicação.

REGRAS INEGOCIÁVEIS:
- Escreva em português do Brasil.
- Use APENAS o que está nos pareceres. NÃO invente prazo, causa, valor, versão, tela,
  funcionalidade ou próximo passo que não esteja lá.
- Na dúvida entre afirmar e omitir, omita: mensagem curta e verdadeira vale mais que
  longa e errada.
- NUNCA use travessão (—), meia-risca (–) nem hífen solto como pausa (" - "). Nem no
  assunto, nem no corpo. Use vírgula, ponto ou dois-pontos. Também não use marcador de
  lista com hífen.
- Nada de jargão técnico com o cliente: sem "RLS", "trigger", "endpoint", "API", "RPC", "deploy", "commit", "frontend", "backend", "migration".
- NÃO cite código da demanda, IDs internos, nome de tabela ou de arquivo.
- NÃO prometa data se os pareceres não trouxerem uma.
- Voz ativa e direta.
- Trate o cliente pelo primeiro nome quando ele estiver nos dados.
- Se o parecer for técnico, TRADUZA para o efeito prático que o cliente percebe.
`.trim();

const TOM_POR_MOMENTO: Record<Momento, string> = {
  parecer: `
MOMENTO: atualização. A demanda ainda não foi fechada.
- Não declare a demanda concluída, encerrada ou entregue. Uma parte pronta não fecha o todo.
- Se o parecer espera algo do cliente, deixe isso claro e peça a resposta.
`.trim(),
  conclusao: `
MOMENTO: o card foi movido para entregue/encerrado.
- Isso NÃO muda o que você pode afirmar. Siga o TIPO do parecer mais recente.
- Se o parecer é ENTREGA: diga o que foi feito (só o que ele diz) e o que muda na prática,
  e convide o cliente a validar e a responder se algo não estiver como esperado.
- Se o parecer é PERGUNTA, JÁ EXISTE ou EM ANÁLISE: escreva a mensagem desse tipo. Não
  use "finalizamos", "entregamos", "concluímos" nem "entregue" no assunto.
`.trim(),
};

const FORMATO_POR_CANAL: Record<Canal, string> = {
  email: `
CANAL: e-mail.
- "assunto": até 70 caracteres, específico, sem "Re:", sem código de demanda e sem
  travessão. Reflete o TIPO do parecer (ex.: "Dúvida sobre a busca de clientes",
  "Busca de clientes: precisamos de mais detalhes").
- "corpo": texto puro, com saudação e despedida. 2 a 4 parágrafos curtos, no máximo 180 palavras.
- SEM markdown: nada de #, *, - ou \`\`\`. Quebre parágrafos com linha em branco.
- Assine como "Equipe de Desenvolvimento".
`.trim(),
  whatsapp: `
CANAL: WhatsApp.
- "assunto": string vazia, porque WhatsApp não tem assunto.
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
      `Responda chamando a ferramenta "mensagem" com os campos leitura, assunto e corpo.
"leitura" vem PRIMEIRO: em 1 a 3 frases, o TIPO do parecer mais recente (entrega, pergunta, já existe, em análise, recusa), o que ele afirma e quais perguntas ele faz. Escreva "assunto" e "corpo" de acordo com essa leitura.`,
    ].join("\n\n");

    // Só o que o cliente pode ver. O prompt_ia e os dados internos ficam de fora.
    // Pareceres primeiro, com o mais recente marcado; o pedido vai rotulado como pedido.
    const pareceres = retornos.map((r, i) => ({
      ...(r as Record<string, unknown>),
      mais_recente: i === retornos.length - 1,
    }));
    const dadosParaIA = {
      pareceres,
      status: statusDemanda || null,
      solicitante_nome: ctx?.solicitante?.nome ?? null,
      empresa: ctx?.empresa ?? null,
      titulo_da_demanda: ctx?.demanda?.titulo ?? null,
      tipo_da_demanda: ctx?.demanda?.tipo ?? null,
      pedido_original_do_cliente: ctx?.demanda?.descricao ?? null,
    };

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Sonnet e não Haiku: o erro da DEM-0663 foi de leitura, não de redação.
        model: "claude-sonnet-5-5",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Dados da demanda:\n${JSON.stringify(dadosParaIA, null, 2)}`,
          },
        ],
        // Formato garantido pela API (tool_choice). Com JSON em texto livre, uma aspa
        // sem escape no corpo ("Avançar") quebrava o JSON.parse e virava erro 500.
        tools: [
          {
            name: "mensagem",
            description: "Entrega a leitura do parecer, o assunto e o corpo da mensagem ao cliente.",
            input_schema: {
              type: "object",
              properties: {
                leitura: {
                  type: "string",
                  description: "Tipo do parecer mais recente, o que ele afirma e o que pergunta.",
                },
                assunto: { type: "string" },
                corpo: { type: "string" },
              },
              required: ["leitura", "assunto", "corpo"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "mensagem" },
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[gerar-mensagem-cliente] anthropic", anthropicRes.status, errText);
      return json({ error: `Anthropic ${anthropicRes.status}: ${errText}` }, 500);
    }

    const anthropicData = await anthropicRes.json();
    const bloco = anthropicData.content?.find((b: any) => b.type === "tool_use");
    const parsed = (bloco?.input ?? {}) as { leitura?: string; assunto?: string; corpo?: string };

    if (!parsed.corpo || !parsed.corpo.trim()) {
      console.error("[gerar-mensagem-cliente] resposta sem corpo", JSON.stringify(anthropicData.content));
      return json({ error: "A IA devolveu a mensagem vazia. Tente de novo." }, 500);
    }

    if (parsed.leitura) console.log("[gerar-mensagem-cliente] leitura:", parsed.leitura);

    return json({
      canal,
      momento,
      assunto: canal === "email" ? semTravessao((parsed.assunto ?? "").trim()) : "",
      corpo: semTravessao(parsed.corpo.trim()),
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
