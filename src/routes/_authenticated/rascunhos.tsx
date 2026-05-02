import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { CriarRascunhoForm } from "@/components/rascunhos/CriarRascunhoForm";
import { RascunhosGrid } from "@/components/rascunhos/RascunhosGrid";
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
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="meus">Meus</TabsTrigger>
          <TabsTrigger value="compartilhados">Compartilhados</TabsTrigger>
          <TabsTrigger value="lixeira" className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />
            Lixeira
          </TabsTrigger>
        </TabsList>
        <TabsContent value="todos" className="mt-4">
          <RascunhosGrid filtro="todos" />
        </TabsContent>
        <TabsContent value="meus" className="mt-4">
          <RascunhosGrid filtro="meus" />
        </TabsContent>
        <TabsContent value="compartilhados" className="mt-4">
          <RascunhosGrid filtro="compartilhados" />
        </TabsContent>
        <TabsContent value="lixeira" className="mt-4">
          <RascunhosGrid filtro="lixeira" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
