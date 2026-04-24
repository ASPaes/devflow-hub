import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Package, Plus } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModalForm } from "@/components/common/ModalForm";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  produtoSchema,
  useCreateProduto,
  useDeleteProduto,
  useProdutos,
  useUpdateProduto,
  type Produto,
  type ProdutoInput,
} from "@/hooks/useProdutos";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: ProdutosPage,
});

const DEFAULT_COLOR = "#8B5CF6";

const emptyValues: ProdutoInput = {
  nome: "",
  descricao: "",
  cor: DEFAULT_COLOR,
  ativo: true,
};

function ProdutosPage() {
  const { data: produtos, isLoading } = useProdutos();
  const createMut = useCreateProduto();
  const updateMut = useUpdateProduto();
  const deleteMut = useDeleteProduto();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Produto | null>(null);
  const [deleting, setDeleting] = React.useState<Produto | null>(null);

  const editValues = React.useMemo<ProdutoInput>(() => {
    if (!editing) return emptyValues;
    return {
      nome: editing.nome,
      descricao: editing.descricao ?? "",
      cor: editing.cor ?? DEFAULT_COLOR,
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<Produto>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: row.cor ?? DEFAULT_COLOR }}
            aria-hidden
          />
          <span className="font-medium text-foreground">{row.nome}</span>
        </div>
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
          <Badge className="border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
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
        description="Sistemas e produtos cobertos pelas demandas"
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
        onDelete={(row) => setDeleting(row)}
        searchableFields={["nome", "descricao"]}
        searchPlaceholder="Buscar produtos..."
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre o primeiro produto para começar a organizar as demandas."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro produto
              </Button>
            }
          />
        }
      />

      {/* Create */}
      <ModalForm<ProdutoInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo produto"
        description="Cadastre um sistema ou produto da ASP."
        schema={produtoSchema}
        defaultValues={emptyValues}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values);
        }}
      >
        {(form) => <ProdutoFields form={form} />}
      </ModalForm>

      {/* Edit */}
      <ModalForm<ProdutoInput>
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar produto"
        schema={produtoSchema}
        defaultValues={editValues}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateMut.mutateAsync({ id: editing.id, input: values });
        }}
      >
        {(form) => <ProdutoFields form={form} />}
      </ModalForm>

      {/* Delete */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir produto"
        description={
          deleting ? (
            <>
              Tem certeza que deseja excluir{" "}
              <strong className="text-foreground">{deleting.nome}</strong>? Esta
              ação não pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteMut.mutateAsync(deleting.id);
        }}
      />
    </div>
  );
}

import type { UseFormReturn } from "react-hook-form";

function ProdutoFields({ form }: { form: UseFormReturn<ProdutoInput> }) {
  return (
    <>
      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Ex: ERP Hiper" {...field} />
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

      <FormField
        control={form.control}
        name="cor"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cor</FormLabel>
            <div className="flex items-center gap-3">
              <FormControl>
                <input
                  type="color"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
                  aria-label="Selecionar cor"
                />
              </FormControl>
              <span
                className="inline-block h-6 w-6 rounded-full border border-border"
                style={{ backgroundColor: field.value }}
                aria-hidden
              />
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                {field.value?.toUpperCase()}
              </code>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="ativo"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Ativo</FormLabel>
              <FormDescription>
                Produtos inativos não aparecem em novas demandas.
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
