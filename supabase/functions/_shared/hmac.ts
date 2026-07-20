// supabase/functions/_shared/hmac.ts
// HMAC-SHA256 em hex, usando Web Crypto (funciona em Deno e Node 20+).

function bytesParaHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function chave(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function assinarPayload(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await chave(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesParaHex(sig);
}

/** Comparação em tempo constante para evitar timing attacks. */
export async function verificarAssinatura(
  secret: string,
  payload: string,
  assinatura: string,
): Promise<boolean> {
  const esperada = await assinarPayload(secret, payload);
  if (esperada.length !== assinatura.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) {
    diff |= esperada.charCodeAt(i) ^ assinatura.charCodeAt(i);
  }
  return diff === 0;
}
