import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: Dashboard,
});

function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(translateAuthError(err));
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-sans text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Logado como <span className="font-mono text-primary">{user?.email}</span>
          </p>
        </div>
        <Button variant="outline" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 h-4 w-4" />
          )}
          Sair
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Código de demanda exemplo: <span className="font-mono text-primary">DEM-0001</span>
      </p>
    </div>
  );
}
