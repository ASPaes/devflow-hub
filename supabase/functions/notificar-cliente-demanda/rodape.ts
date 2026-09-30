/**
 * Código e link da demanda em todo e-mail ao cliente.
 *
 * Fica aqui, e não no texto que o agente edita, para sair sempre: a IA pode
 * esquecer, o agente pode apagar sem querer, e o cliente precisa das duas
 * coisas para achar a demanda depois.
 *
 * Arquivo separado para o rodape.test.ts rodar no bun, sem Deno.
 */

export const APP_URL_PADRAO = "https://doctordev.lovable.app";

export function linkDaDemanda(codigo: string, baseApp: string | null | undefined): string {
  const base = (baseApp ?? "").trim().replace(/\/+$/, "") || APP_URL_PADRAO;
  return `${base}/demandas/${encodeURIComponent(codigo)}`;
}

/** Acrescenta "(DEM-0504)" ao assunto quando o agente não escreveu o código. */
export function assuntoComCodigo(assunto: string, codigo: string | null): string {
  if (!codigo) return assunto;
  if (assunto.toUpperCase().includes(codigo.toUpperCase())) return assunto;
  return `${assunto} (${codigo})`;
}

export function rodapeTexto(codigo: string, link: string): string {
  return `\n\n--\nDemanda: ${codigo}\nAcompanhe: ${link}`;
}

/** WhatsApp: sem o "--" do e-mail, e o código em negrito (*...*). */
export function rodapeWhatsApp(codigo: string, link: string): string {
  return `\n\nDemanda *${codigo}*\nAcompanhe: ${link}`;
}

export function rodapeHtml(codigo: string, link: string): string {
  // Tabela e estilo inline: é o que Gmail e Outlook respeitam.
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #E2E8F0;padding-top:16px;width:100%;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">` +
    `<tr><td style="font-size:13px;color:#64748B;padding-bottom:10px;">Demanda <strong style="color:#1E293B;">${codigo}</strong></td></tr>` +
    `<tr><td><a href="${link}" style="display:inline-block;background:#22C55E;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;">Acompanhar a demanda</a></td></tr>` +
    `<tr><td style="font-size:12px;color:#94A3B8;padding-top:10px;">${link}</td></tr>` +
    `</table>`
  );
}
