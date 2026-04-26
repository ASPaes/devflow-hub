import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/sso-callback")({
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let subscription: { unsubscribe: () => void } | null = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
      void navigate({ to: "/" });
    };

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          finish();
          return;
        }

        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN") {
            finish();
          }
        });
        subscription = sub.subscription;

        timeoutId = setTimeout(() => {
          if (done) return;
          if (subscription) subscription.unsubscribe();
          setError("Não foi possível completar o login");
        }, 10_000);
      } catch (err) {
        console.error("[sso-callback] erro:", err);
        setError("Não foi possível completar o login");
      }
    }

    void run();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
          <div>
            <h1 className="text-lg font-semibold">{error}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tente novamente pelo sistema de origem.
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
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Finalizando autenticação" />
      <p className="text-sm text-muted-foreground">Finalizando autenticação…</p>
    </div>
  );
}
