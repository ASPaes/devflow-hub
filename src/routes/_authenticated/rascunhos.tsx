import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Trash2 } from "lucide-react";
import { CriarRascunhoForm } from "@/components/rascunhos/CriarRascunhoForm";
import { RascunhosGrid } from "@/components/rascunhos/RascunhosGrid";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/rascunhos")({
  component: RascunhosPage,
});

function RascunhosPage() {
  useDocumentTitle("Rascunhos");
  const [tab, setTab] = React.useState<
    "todos" | "meus" | "compartilhados" | "lixeira"
  >("todos");
  const [busca, setBusca] = React.useState("");
  const [buscaDebounced, setBuscaDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rascunhos</h1>
        <p className="text-sm text-muted-foreground">
          Anotações rápidas, estilo Keep. Texto livre ou checklist.
        </p>
      </div>

      {tab !== "lixeira" && <CriarRascunhoForm />}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="meus">Meus</TabsTrigger>
            <TabsTrigger value="compartilhados">Compartilhados</TabsTrigger>
            <TabsTrigger value="lixeira" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Lixeira
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em título ou texto…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        <TabsContent value="todos" className="mt-4">
          <RascunhosGrid filtro="todos" busca={buscaDebounced} />
        </TabsContent>
        <TabsContent value="meus" className="mt-4">
          <RascunhosGrid filtro="meus" busca={buscaDebounced} />
        </TabsContent>
        <TabsContent value="compartilhados" className="mt-4">
          <RascunhosGrid filtro="compartilhados" busca={buscaDebounced} />
        </TabsContent>
        <TabsContent value="lixeira" className="mt-4">
          <RascunhosGrid filtro="lixeira" busca={buscaDebounced} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
