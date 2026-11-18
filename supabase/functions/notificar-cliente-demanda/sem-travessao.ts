/**
 * Nenhuma mensagem ao cliente sai com travessão. Regra do Vinicius (17/11/2026):
 * "em hipótese alguma".
 *
 * O prompt da IA já proíbe, mas modelo escorrega; e o agente pode digitar ou colar
 * um. Por isso a limpeza roda no servidor, em dois pontos: na saída da IA
 * (gerar-mensagem-cliente e gerar-resumo-release-ia, com CÓPIAS deste arquivo; o original e o teste ficam na notificar-cliente-demanda) e no envio
 * (notificar-cliente-demanda, assunto e corpo). Mexeu aqui, mexa lá também.
 *
 * O que sai: travessão (—), meia-risca (–) e o hífen usado como travessão, com
 * espaço dos dois lados (" - ") ou abrindo linha como marcador de lista.
 * O que fica: hífen dentro de palavra (e-mail, bem-vindo, DEM-0663) e em data.
 *
 * Arquivo separado para o teste rodar no bun, sem Deno.
 */
export function semTravessao(texto: string): string {
  if (!texto) return texto;

  return (
    texto
      // Marcador no começo da linha: "- item", "— item" → "item"
      .replace(/^([ \t]*)[-–—]+[ \t]+/gm, "$1")
      // Travessão fechando a linha: "Olá Thomas —" → "Olá Thomas"
      .replace(/[ \t]*[—–]+[ \t]*$/gm, "")
      // Travessão/meia-risca no meio da frase, com ou sem espaço → vírgula
      .replace(/[ \t]*[—–]+[ \t]*/g, ", ")
      // Hífen solto entre espaços, usado como travessão → vírgula
      .replace(/[ \t]+-+[ \t]+/g, ", ")
      // Arrumação do que a troca deixou para trás
      .replace(/,[ \t]*,/g, ",")
      .replace(/,[ \t]*([.!?;:])/g, "$1")
      .replace(/^[ \t]*,[ \t]*/gm, "")
  );
}
