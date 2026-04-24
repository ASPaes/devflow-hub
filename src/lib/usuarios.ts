import type { UsuarioAdmin } from "@/hooks/useUsuarios";

export type StatusUsuario = "Pendente" | "Ativo" | "Inativo";

export function getStatusUsuario(user: UsuarioAdmin): StatusUsuario {
  if (!user.ativo) return "Inativo";
  if (!user.last_sign_in_at) return "Pendente";
  return "Ativo";
}
