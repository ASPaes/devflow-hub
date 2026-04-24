interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string;
}

export type EntityName =
  | "modulo"
  | "submodulo"
  | "area"
  | "usuario"
  | "perfil_acesso"
  | "demanda";

export function translateSupabaseError(
  err: unknown,
  entity?: EntityName,
): string {
  const e = err as PostgrestLikeError;
  const code = e?.code;
  const rawMessage = e?.message;

  // Mensagens de RAISE EXCEPTION do Postgres (P0001) vêm em PT — mostrar direto
  if (code === "P0001" && rawMessage) return rawMessage;
  if (rawMessage && rawMessage.includes("último dev_gestor")) return rawMessage;
  if (rawMessage && rawMessage.includes("último administrador"))
    return rawMessage;
  if (rawMessage && rawMessage.includes("perfil de sistema")) return rawMessage;

  if (code === "23505") {
    if (entity === "modulo") return "Já existe um módulo com esse nome";
    if (entity === "submodulo")
      return "Já existe um submódulo com esse nome neste módulo";
    if (entity === "area") return "Já existe uma área com esse nome";
    if (entity === "usuario") return "Já existe um usuário com esses dados";
    if (entity === "perfil_acesso")
      return "Já existe um perfil com esse nome";
    return "Registro duplicado";
  }
  if (code === "23503") {
    if (entity === "perfil_acesso")
      return "Este perfil está em uso por um ou mais usuários. Altere o perfil desses usuários antes de excluir.";
    if (entity === "demanda")
      return "Um dos campos referencia um item que não existe. Recarregue e tente novamente.";
    return "Este registro está em uso e não pode ser removido. Considere desativá-lo.";
  }
  if (code === "23502") return "Campo obrigatório não preenchido";
  if (code === "42501" || code === "PGRST301") {
    if (entity === "demanda")
      return "Você não tem permissão para criar demandas";
    return "Você não tem permissão para esta ação";
  }

  if (e?.message) return e.message;
  return "Erro inesperado. Tente novamente.";
}
