import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SsoCallbackSearch = { token?: string };

export const Route = createFileRoute("/sso-callback")({
  validateSearch: (search: Record<string, unknown>): SsoCallbackSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: SsoCallback,
});

function SsoCallback() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/sso-callback" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      // Caso 1: chegou com ?token= → primeira passada (troca por magic link)
      if (token) {
        try {
          const { data, error: invokeError } = await supabase.functions.invoke("sso-login", {
            body: { token },
          });
          if (invokeError) throw invokeError;
          if (!data?.magic_link) throw new Error("Link de acesso não retornado");
          window.location.replace(data.magic_link);
          return;
        } catch (err) {
          console.error("[sso-callback] sso-login error", err);
          setError("Acesso inválido ou expirado.");
          return;
        }
      }

      // Caso 2: chegou via magic link (hash com tokens) → aguarda SIGNED_IN
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate({ to: "/" });
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          navigate({ to: "/" });
        }
      });
      unsub = () => sub?.subscription.unsubscribe();

      timeoutId = setTimeout(() => {
        setError("Não foi possível completar o login. Tente novamente.");
      }, 10000);
    }

    run();
    return () => {
      unsub?.();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <p className="text-foreground">{error}</p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="mt-4 text-primary underline"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Finalizando autenticação…</p>
      </div>
    </div>
  );
}
