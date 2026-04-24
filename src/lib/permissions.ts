import type { AppPermissao } from "@/hooks/useProfile";
import type { UsuarioAdmin } from "@/hooks/useUsuarios";

const ADMIN_PERMS: AppPermissao[] = [
  "gerenciar_usuarios",
  "gerenciar_perfis_acesso",
];

export function isAdminPerfil(permissoes: AppPermissao[]): boolean {
  return ADMIN_PERMS.every((p) => permissoes.includes(p));
}

export function isLastAdmin(
  usuarios: UsuarioAdmin[],
  candidato: UsuarioAdmin,
): boolean {
  if (!candidato.ativo || !isAdminPerfil(candidato.permissoes)) return false;
  const outros = usuarios.filter(
    (u) => u.id !== candidato.id && u.ativo && isAdminPerfil(u.permissoes),
  );
  return outros.length === 0;
}
