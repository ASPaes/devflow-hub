interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string;
}

export function translateSupabaseError(err: unknown): string {
  const e = err as PostgrestLikeError;
  const code = e?.code;

  if (code === "23505") return "Já existe um registro com esse nome";
  if (code === "23503")
    return "Este registro está em uso e não pode ser removido. Considere desativá-lo.";
  if (code === "23502") return "Campo obrigatório não preenchido";
  if (code === "42501" || code === "PGRST301")
    return "Você não tem permissão para esta ação";

  if (e?.message) return e.message;
  return "Erro inesperado. Tente novamente.";
}
