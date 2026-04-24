import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { createFileRoute } from "@tanstack/react-router";
import { Layers, Plus } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModalForm } from "@/components/common/ModalForm";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  moduloSchema,
  useCreateModulo,
  useDeleteModulo,
  useModulos,
  useUpdateModulo,
  type ModuloComProduto,
  type ModuloInput,
} from "@/hooks/useModulos";
import { useProdutos } from "@/hooks/useProdutos";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/modulos")({
  component: ModulosPage,
});

const ALL = "__todos__";
const DEFAULT_COLOR = "#8B5CF6";

const emptyValues: ModuloInput = {
  produto_id: "",
  nome: "",
  ativo: true,
};

function ModulosPage() {
  const { data: modulos, isLoading } = useModulos();
  const { data: produtos } = useProdutos();
  const createMut = useCreateModulo();
  const updateMut = useUpdateModulo();
  const deleteMut = useDeleteModulo();

  const [filtroProduto, setFiltroProduto] = React.useState<string>(ALL);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ModuloComProduto | null>(null);
  const [deleting, setDeleting] = React.useState<ModuloComProduto | null>(null);

  const produtosAtivos = React.useMemo(
    () => (produtos ?? []).filter((p) => p.ativo),
    [produtos],
  );

  const filtered = React.useMemo(() => {
    if (!modulos) return undefined;
    if (filtroProduto === ALL) return modulos;
    return modulos.filter((m) => m.produto_id === filtroProduto);
  }, [modulos, filtroProduto]);

  const editValues = React.useMemo<ModuloInput>(() => {
    if (!editing) return emptyValues;
    return {
      produto_id: editing.produto_id,
      nome: editing.nome,
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<ModuloComProduto>[] = [
    {
      key: "produto",
      header: "Produto",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: row.produto?.cor ?? DEFAULT_COLOR }}
            aria-hidden
          />
          <span className="font-mono text-xs text-muted-foreground">
            {row.produto?.nome ?? "—"}
          </span>
        </div>
      ),
    },
    {
      key: "nome",
      header: "Módulo",
      render: (row) => (
        <span className="font-medium text-foreground">{row.nome}</span>
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
        title="Módulos"
        description="Módulos e telas de cada sistema"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo módulo
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={filtroProduto} onValueChange={setFiltroProduto}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Todos os produtos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os produtos</SelectItem>
            {(produtos ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered}
        isLoading={isLoading}
        columns={columns}
        onEdit={(row) => setEditing(row)}
        onDelete={(row) => setDeleting(row)}
        searchableFields={["nome"]}
        searchPlaceholder="Buscar módulos..."
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Layers}
            title="Nenhum módulo cadastrado"
            description="Cadastre o primeiro módulo para organizar as demandas."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeiro módulo
              </Button>
            }
          />
        }
      />

      <ModalForm<ModuloInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo módulo"
        description="Cadastre um módulo de um produto."
        schema={moduloSchema}
        defaultValues={emptyValues}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values);
        }}
      >
        {(form) => <ModuloFields form={form} produtos={produtosAtivos} />}
      </ModalForm>

      <ModalForm<ModuloInput>
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar módulo"
        schema={moduloSchema}
        defaultValues={editValues}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateMut.mutateAsync({ id: editing.id, input: values });
        }}
      >
        {(form) => <ModuloFields form={form} produtos={produtosAtivos} />}
      </ModalForm>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir módulo"
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

interface ModuloFieldsProps {
  form: UseFormReturn<ModuloInput>;
  produtos: Array<{ id: string; nome: string; cor: string | null }>;
}

function ModuloFields({ form, produtos }: ModuloFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="produto_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Produto</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {produtos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: p.cor ?? DEFAULT_COLOR }}
                        aria-hidden
                      />
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Cadastros" {...field} />
            </FormControl>
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
                Módulos inativos não aparecem em novas demandas.
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
