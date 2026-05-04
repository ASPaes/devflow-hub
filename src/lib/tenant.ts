/**
 * Helpers para representação visual de empresas (tenants).
 */

export function getTenantIniciais(nome: string | null | undefined): string {
  if (!nome) return "?";
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "?";
  if (palavras.length === 1) {
    return palavras[0].slice(0, 2).toUpperCase();
  }
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}

const CORES_TENANT = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
];

export function getTenantBgColor(nome: string | null | undefined): string {
  if (!nome) return "bg-zinc-500";
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash << 5) - hash + nome.charCodeAt(i);
    hash |= 0;
  }
  return CORES_TENANT[Math.abs(hash) % CORES_TENANT.length];
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

/**
 * URL pública da logo (bucket público — sem signed URL).
 */
export function getTenantLogoPublicUrl(
  logoPath: string | null | undefined,
  updatedAt?: string | null,
): string | null {
  if (!logoPath || !SUPABASE_URL) return null;
  const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/tenant-logos/${logoPath}`;
  if (!updatedAt) return baseUrl;
  const versao = new Date(updatedAt).getTime();
  if (Number.isNaN(versao)) return baseUrl;
  return `${baseUrl}?v=${versao}`;
}
