import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package2, Plus, Power } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ModalForm } from "@/components/common/ModalForm";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useProfile } from "@/hooks/useProfile";
import {
  useProdutosTodos,
  useCriarProduto,
  useAtualizarProduto,
  useToggleProduto,
  type Produto,
} from "@/hooks/useProdutos";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: ProdutosPage,
});

const produtoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(300, "Descrição muito longa")
    .optional()
    .or(z.literal("")),
});

type ProdutoInput = z.infer<typeof produtoSchema>;

const emptyValues: ProdutoInput = { nome: "", descricao: "" };

function ProdutosPage() {
  const { temPermissao } = useProfile();
  const podeGerenciar = temPermissao("deletar_demanda");
  const { data: produtos, isLoading } = useProdutosTodos();
  const criar = useCriarProduto();
  const atualizar = useAtualizarProduto();
  const toggle = useToggleProduto();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Produto | null>(null);

  const editValues = React.useMemo<ProdutoInput>(() => {
    if (!editing) return emptyValues;
    return {
      nome: editing.nome,
      descricao: editing.descricao ?? "",
    };
  }, [editing]);

  if (!podeGerenciar) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  const columns: DataTableColumn<Produto>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (row) => (
        <span className="font-medium text-foreground">{row.nome}</span>
      ),
    },
    {
      key: "descricao",
      header: "Descrição",
      className: "max-w-md",
      render: (row) => (
        <span className="block truncate text-sm text-muted-foreground">
          {row.descricao ?? "—"}
        </span>
      ),
    },
    {
      key: "ativo",
      header: "Status",
      render: (row) =>
        row.ativo ? (
          <Badge className="border-transparent bg-status-entregue/15 text-status-entregue hover:bg-status-entregue/20">
            Ativo
          </Badge>
        ) : (
          <Badge variant="secondary">Inativo</Badge>
        ),
    },
    {
      key: "created_at",
      header: "Criado",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeSP(row.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Cadastre os produtos-alvo das demandas (ex: DoctorSaaS, DoctorDev)."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Button>
        }
      />

      <DataTable
        data={produtos}
        isLoading={isLoading}
        columns={columns}
        onEdit={(row) => setEditing(row)}
        rowActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggle.mutate({ id: row.id, ativo: !row.ativo })}
            disabled={toggle.isPending}
            title={row.ativo ? "Desativar" : "Reativar"}
          >
            <Power className="h-4 w-4" />
            <span className="ml-2">{row.ativo ? "Desativar" : "Reativar"}</span>
          </Button>
        )}
        searchableFields={["nome", "descricao"]}
        searchPlaceholder="Buscar produtos..."
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Package2}
            title="Nenhum produto cadastrado"
            description="Cadastre o primeiro produto-alvo de demandas."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro produto
              </Button>
            }
          />
        }
      />

      <ModalForm<ProdutoInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo produto"
        description="Cadastre um novo produto-alvo de demandas."
        schema={produtoSchema}
        defaultValues={emptyValues}
        onSubmit={async (values) => {
          await criar.mutateAsync({ nome: values.nome, descricao: values.descricao });
        }}
      >
        {(form) => <ProdutoFields form={form} />}
      </ModalForm>

      <ModalForm<ProdutoInput>
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar produto"
        description="Atualize nome ou descrição do produto."
        schema={produtoSchema}
        defaultValues={editValues}
        onSubmit={async (values) => {
          if (!editing) return;
          await atualizar.mutateAsync({
            id: editing.id,
            nome: values.nome,
            descricao: values.descricao,
          });
        }}
      >
        {(form) => <ProdutoFields form={form} />}
      </ModalForm>
    </div>
  );
}

function ProdutoFields({
  form,
}: {
  form: import("react-hook-form").UseFormReturn<ProdutoInput>;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Ex: DoctorSaaS" autoFocus {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="descricao"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                placeholder="Breve descrição do produto (opcional)"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
