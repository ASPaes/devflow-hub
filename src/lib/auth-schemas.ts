import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const cadastroSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });
export type CadastroInput = z.infer<typeof cadastroSchema>;

export const resetSchema = z.object({
  email: z.string().email("E-mail inválido"),
});
export type ResetInput = z.infer<typeof resetSchema>;
