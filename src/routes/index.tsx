import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="font-sans text-3xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Código de demanda exemplo: <span className="font-mono text-primary">DEM-0001</span>
      </p>
      <nav className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link to="/login" className="text-accent hover:underline">/login</Link>
        <Link to="/cadastro" className="text-accent hover:underline">/cadastro</Link>
        <Link to="/reset-password" className="text-accent hover:underline">/reset-password</Link>
        <Link to="/perfil" className="text-accent hover:underline">/perfil</Link>
      </nav>
    </div>
  );
}
