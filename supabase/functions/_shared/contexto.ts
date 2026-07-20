export interface ComentarioContexto {
  autor: string;
  texto: string;
}

export interface DadosDemandaContexto {
  codigo: string;
  titulo: string;
  descricao: string;
  comentarios: ComentarioContexto[];
}

/**
 * Monta o texto de contexto do problema para o agente.
 * Usado como fallback quando a demanda ainda não tem `prompt_ia` salvo.
 * As imagens (prints) NÃO entram aqui — vão como URLs assinadas no payload.
 */
export function montarPromptAgente(d: DadosDemandaContexto): string {
  const linhas: string[] = [
    `# Demanda ${d.codigo}: ${d.titulo}`,
    "",
    "## Descrição do problema relatado",
    d.descricao.trim() || "(sem descrição)",
  ];

  if (d.comentarios.length > 0) {
    linhas.push("", "## Comentários");
    for (const c of d.comentarios) {
      linhas.push(`- **${c.autor}**: ${c.texto}`);
    }
  }

  linhas.push(
    "",
    "## Sua tarefa",
    "1. Analise o problema (inclusive os prints anexados, cujos caminhos estão no prompt do workflow).",
    "2. Identifique a causa raiz no código.",
    "3. Corrija de forma mínima e segura, sem tocar em migrations, infra ou segredos.",
    "4. Ao final, produza um texto curto para o cliente explicando a ORIGEM do problema e COMO foi corrigido.",
  );

  return linhas.join("\n");
}
