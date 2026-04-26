import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArchiveRestore, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useRestaurarDemanda } from "@/hooks/useExcluirDemanda";
import { useProfile } from "@/hooks/useProfile";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/demandas/excluidas")({
  component: DemandasExcluidasPage,
});

function DemandasExcluidasPage() {
  const { temPermissao } = useProfile();
  const podeAcessar = temPermissao("deletar_demanda");
  const restaurar = useRestaurarDemanda();
  useDocumentTitle("Demandas excluídas");

  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ["demandas-excluidas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_demandas_excluidas")
        .select(
          "id, codigo, titulo, deleted_at, deleted_by_nome, delete_motivo, solicitante_nome, responsavel_nome",
        )
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: podeAcessar,
  });

  if (!podeAcessar) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  const handleRestaurar = async (id: string, codigo: string | null) => {
    if (
      !confirm(
        `Restaurar demanda ${codigo ?? ""}? Ela voltará para as listagens normais.`,
      )
    ) {
      return;
    }
    await restaurar.mutateAsync(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/demandas">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Demandas excluídas
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de exclusões. Apenas Administradores e Desenvolvedores
            têm acesso.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : demandas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Nenhuma demanda excluída.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Excluída em</TableHead>
                <TableHead>Excluída por</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demandas.map((d) => (
                <TableRow key={d.id ?? undefined}>
                  <TableCell className="font-mono text-xs">
                    {d.codigo}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {d.titulo}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.solicitante_nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.deleted_at
                      ? new Date(d.deleted_at).toLocaleString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.deleted_by_nome ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                    {d.delete_motivo}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        d.id && handleRestaurar(d.id, d.codigo)
                      }
                      disabled={restaurar.isPending || !d.id}
                    >
                      <ArchiveRestore className="mr-1.5 h-4 w-4" />
                      Restaurar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
