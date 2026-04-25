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
  | "demanda"
  | "comentario"
  | "vinculo"
  | "anexo"
  | "tenant";

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
    if (entity === "vinculo") return "Este vínculo já existe";
    if (entity === "tenant") {
      const m = (rawMessage ?? "").toLowerCase();
      if (m.includes("doctorsaas_tenant_id"))
        return "Este DoctorSaas Tenant ID já está vinculado a outro tenant";
      if (m.includes("nome")) return "Já existe um tenant com esse nome";
      return "Já existe um tenant com esses dados";
    }
    return "Registro duplicado";
  }
  if (code === "23514" && entity === "vinculo") {
    return "Não é possível vincular uma demanda a si mesma";
  }
  if (code === "23503") {
    if (entity === "perfil_acesso")
      return "Este perfil está em uso por um ou mais usuários. Altere o perfil desses usuários antes de excluir.";
    if (entity === "demanda")
      return "Um dos campos referencia um item que não existe. Recarregue e tente novamente.";
    if (entity === "tenant")
      return "Este tenant tem usuários ou demandas vinculados. Mude eles para outro tenant antes de excluir.";
    return "Este registro está em uso e não pode ser removido. Considere desativá-lo.";
  }
  if (code === "23502") return "Campo obrigatório não preenchido";
  if (code === "42501" || code === "PGRST301") {
    if (entity === "demanda")
      return "Você não tem permissão para criar demandas";
    if (entity === "comentario")
      return "Você não tem permissão para este comentário";
    if (entity === "vinculo")
      return "Sem permissão para gerenciar vínculos";
    return "Você não tem permissão para esta ação";
  }
  if (entity === "comentario" && code === "23503") {
    return "Demanda não encontrada";
  }

  if (entity === "anexo") {
    if (code === "23514") return "Arquivo inválido";
    const msg = rawMessage ?? "";
    if (msg.includes("exceeded the maximum allowed size"))
      return "Arquivo maior que 25MB";
    if (msg.includes("mime type") && msg.includes("not supported"))
      return "Tipo de arquivo não permitido";
    if (msg.includes("The resource already exists"))
      return "Já existe um arquivo com esse nome";
  }

  if (e?.message) return e.message;
  return "Erro inesperado. Tente novamente.";
}
