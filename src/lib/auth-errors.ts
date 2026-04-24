import type { AuthError } from "@supabase/supabase-js";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos",
  email_not_confirmed: "Confirme seu e-mail antes de entrar",
  user_already_exists: "Já existe uma conta com este e-mail",
  email_exists: "Já existe uma conta com este e-mail",
  weak_password: "Senha muito fraca (mínimo 8 caracteres)",
  over_email_send_rate_limit: "Muitas tentativas. Aguarde alguns minutos.",
  over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos.",
  signup_disabled: "Cadastro desabilitado no momento",
};

export function translateAuthError(error: AuthError | Error | unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code && MESSAGES[code]) return MESSAGES[code];
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: string }).message ?? "").toLowerCase();
    if (msg.includes("invalid login")) return MESSAGES.invalid_credentials;
    if (msg.includes("already registered") || msg.includes("already exists"))
      return MESSAGES.user_already_exists;
    if (msg.includes("email not confirmed")) return MESSAGES.email_not_confirmed;
    if (msg.includes("rate limit")) return MESSAGES.over_email_send_rate_limit;
  }
  return "Algo deu errado. Tente novamente.";
}
