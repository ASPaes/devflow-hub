import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const searchSchema = z.object({
  token: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/sso")({
  validateSearch: zodValidator(searchSchema),
  component: SSOPage,
});

function SSOPage() {
  const { token } = Route.useSearch();
  const [error, setError] = React.useState<string | null>(null);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      if (!token) {
        setError("Token ausente na URL");
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("sso-login", {
          body: { token },
        });
        if (fnError) throw fnError;
        const magicLink = (data as { magic_link?: string } | null)?.magic_link;
        if (!magicLink) {
          throw new Error("Resposta sem magic_link");
        }
        window.location.replace(magicLink);
      } catch (err) {
        console.error("[sso] erro:", err);
        setError("Acesso inválido ou expirado");
      }
    }

    void run();
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">{error}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Não foi possível concluir o login automático. Tente novamente pelo sistema de origem.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/login">Voltar para login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Autenticando" />
      <p className="text-sm text-muted-foreground">Autenticando…</p>
    </div>
  );
}
