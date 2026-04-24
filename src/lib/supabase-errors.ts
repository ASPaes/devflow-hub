interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string;
}

export type EntityName = "modulo" | "submodulo" | "area" | "usuario";

export function translateSupabaseError(
  err: unknown,
  entity?: EntityName,
): string {
  const e = err as PostgrestLikeError;
  const code = e?.code;

  if (code === "23505") {
    if (entity === "modulo") return "Já existe um módulo com esse nome";
    if (entity === "submodulo")
      return "Já existe um submódulo com esse nome neste módulo";
    if (entity === "area") return "Já existe uma área com esse nome";
    if (entity === "usuario") return "Já existe um usuário com esses dados";
    return "Registro duplicado";
  }
  if (code === "23503")
    return "Este registro está em uso e não pode ser removido. Considere desativá-lo.";
  if (code === "23502") return "Campo obrigatório não preenchido";
  if (code === "42501" || code === "PGRST301")
    return "Você não tem permissão para esta ação";

  if (e?.message) return e.message;
  return "Erro inesperado. Tente novamente.";
}
