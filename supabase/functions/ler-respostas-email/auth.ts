/**
 * Quem pode mandar ler a caixa de e-mail.
 *
 * Arquivo separado para ter teste (auth.test.ts) — errar aqui é abrir a caixa
 * de e-mail da empresa para qualquer usuário logado do DoctorDev.
 */

function decodificarPayload(token: string): Record<string, unknown> | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  // base64url → base64, com o padding que o atob exige de volta
  const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
  const completo = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  try {
    const binario = atob(completo);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return typeof payload === "object" && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

/**
 * `verify_jwt = true` no config.toml faz a plataforma conferir a ASSINATURA
 * antes de a function rodar. Então aqui não é preciso (nem possível) validar
 * assinatura de novo — o que falta é olhar QUEM é: um JWT de usuário logado
 * também é válido, e usuário logado não tem nada que fazer nesta function.
 *
 * Duas portas, nessa ordem:
 *   • claim `role = service_role` — vale para a chave legada (eyJ...);
 *   • igualdade com SUPABASE_SERVICE_ROLE_KEY — vale para o formato novo
 *     (sb_secret_...), que não é JWT e não tem claim para inspecionar.
 *
 * Comparar só com a variável de ambiente, como estava antes, quebrava em
 * projeto migrado: a service_role legítima batia num valor de formato
 * diferente e voltava 401.
 */
export function ehChamadaDeServico(
  cabecalhoAutorizacao: string | null,
  serviceKey: string | null,
): boolean {
  const token = (cabecalhoAutorizacao ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  if (serviceKey && token === serviceKey) return true;

  return decodificarPayload(token)?.role === "service_role";
}
