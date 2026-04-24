import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplashScreen } from "@/components/SplashScreen";

export const Route = createFileRoute("/auth/confirm")({
  component: ConfirmPage,
});

type TokenType = "invite" | "recovery" | "email_change" | "signup" | null;
type Phase = "loading" | "form" | "success" | "error";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Senhas não conferem",
    path: ["confirm"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function ConfirmPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [tokenType, setTokenType] = React.useState<TokenType>(null);
  const [errorMsg, setErrorMsg] = React.useState<string>("");
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : "";
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(window.location.search);

        const type = (hashParams.get("type") ||
          searchParams.get("type")) as TokenType;

        const errorDescription =
          hashParams.get("error_description") ||
          searchParams.get("error_description");
        if (errorDescription) {
          setErrorMsg(errorDescription);
          setPhase("error");
          return;
        }

        // PKCE-style: ?code=... — exchange first
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMsg(error.message);
            setPhase("error");
            return;
          }
        }

        // Legacy token_hash style: ?token_hash=...&type=...
        const tokenHash = searchParams.get("token_hash");
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "invite" | "recovery" | "email_change" | "signup",
          });
          if (error) {
            setErrorMsg(error.message);
            setPhase("error");
            return;
          }
        }

        // After exchange/verify — or with implicit hash flow handled by supabase-js
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          setErrorMsg(
            "Link inválido ou expirado. Solicite um novo convite ou redefinição de senha.",
          );
          setPhase("error");
          return;
        }

        setTokenType(type);

        if (type === "invite" || type === "recovery") {
          setPhase("form");
        } else if (type === "email_change" || type === "signup") {
          setPhase("success");
        } else {
          // No type — assume already logged in, send to dashboard
          navigate({ to: "/" });
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
  }, [navigate]);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Validando seu acesso...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">
              Não foi possível validar
            </CardTitle>
            <CardDescription>{errorMsg}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>E-mail confirmado</CardTitle>
            <CardDescription>
              Seu e-mail foi atualizado com sucesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/" })} className="w-full">
              Ir para o dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PasswordForm
      tokenType={tokenType}
      onSuccess={() => navigate({ to: "/" })}
    />
  );
}

function PasswordForm({
  tokenType,
  onSuccess,
}: {
  tokenType: TokenType;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const isInvite = tokenType === "invite";
  const title = isInvite ? "Bem-vindo ao devflow-hub" : "Redefinir senha";
  const description = isInvite
    ? "Defina uma senha para entrar"
    : "Escolha uma nova senha";

  const onSubmit = async (values: PasswordValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;
      toast.success(isInvite ? "Conta ativada" : "Senha atualizada");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar senha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...form.register("confirm")}
              />
              {form.formState.errors.confirm && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirm.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isInvite ? "Ativar conta" : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// SplashScreen unused but kept in case loading visuals tweak later
void SplashScreen;
