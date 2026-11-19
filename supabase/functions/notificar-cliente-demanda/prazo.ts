/**
 * Prazo para a conversa com o servidor SMTP.
 *
 * Arquivo separado para o prazo.test.ts rodar no bun, sem rede e sem Deno.
 *
 * Por que existe (19/11/2026, DEM-0666): o envio falhou com "Edge Function
 * returned a non-2xx" e NADA foi gravado em demanda_comunicacoes. Tudo o que a
 * function trata volta com `{ error }` e é gravado, então ela foi cortada no
 * meio, provavelmente com o denomailer esperando o SMTP para sempre. Com prazo,
 * a demora vira uma falha comum: gravada, com motivo, e mostrada na tela.
 */

export const PRAZO_SMTP_MS = 25_000;

export class PrazoEsgotado extends Error {
  constructor(public readonly ms: number) {
    super(`tempo esgotado (${Math.round(ms / 1000)} s)`);
    this.name = "PrazoEsgotado";
  }
}

/** Resolve com a promessa ou rejeita com PrazoEsgotado, o que vier primeiro. */
export function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new PrazoEsgotado(ms)), ms);
  });
  // A promessa perdedora pode rejeitar depois; sem este catch vira rejeição
  // não tratada, que derruba o worker do edge runtime.
  promessa.catch(() => {});
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

/** Texto gravado e mostrado quando o SMTP não respondeu a tempo. */
export function erroDePrazo(ms: number, host: string): string {
  return `o servidor de e-mail (${host}) não respondeu em ${Math.round(ms / 1000)} s. ` +
    "O e-mail pode ter saído mesmo assim: confira a pasta de enviados antes de reenviar.";
}
