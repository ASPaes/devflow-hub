import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/areas")({
  component: AreasBloqueada,
});

function AreasBloqueada() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        Recurso indisponível
      </h1>
      <p className="text-sm text-muted-foreground">
        O gerenciamento de Áreas está desativado neste momento.
      </p>
      <Button asChild>
        <Link to="/demandas">Voltar para demandas</Link>
      </Button>
    </div>
  );
}
