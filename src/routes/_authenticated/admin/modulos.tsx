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
  moduloSchema,
  useCreateModulo,
  useDeleteModulo,
  useModulos,
  useUpdateModulo,
  type Modulo,
  type ModuloInput,
} from "@/hooks/useModulos";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/modulos")({
  component: ModulosPage,
});

const DEFAULT_COLOR = "#8B5CF6";

const emptyValues: ModuloInput = {
  nome: "",
  descricao: "",
  cor: DEFAULT_COLOR,
  ativo: true,
};

function ModulosPage() {
  const { data: modulos, isLoading } = useModulos();
  const createMut = useCreateModulo();
  const updateMut = useUpdateModulo();
  const deleteMut = useDeleteModulo();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Modulo | null>(null);
  const [deleting, setDeleting] = React.useState<Modulo | null>(null);

  const editValues = React.useMemo<ModuloInput>(() => {
    if (!editing) return emptyValues;
    return {
      nome: editing.nome,
      descricao: editing.descricao ?? "",
      cor: editing.cor ?? DEFAULT_COLOR,
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<Modulo>[] = [
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
        description="Módulos do sistema ASP"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo módulo
          </Button>
        }
      />

      <DataTable
        data={modulos}
        isLoading={isLoading}
        columns={columns}
        onEdit={(row) => setEditing(row)}
        onDelete={(row) => setDeleting(row)}
        searchableFields={["nome", "descricao"]}
        searchPlaceholder="Buscar módulos..."
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Layers}
            title="Nenhum módulo cadastrado"
            description="Cadastre o primeiro módulo. O submódulo 'Geral' será criado automaticamente."
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
        description="Cadastre um módulo do sistema."
        schema={moduloSchema}
        defaultValues={emptyValues}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values);
        }}
      >
        {(form) => <ModuloFields form={form} />}
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
        {(form) => <ModuloFields form={form} />}
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

function ModuloFields({ form }: { form: UseFormReturn<ModuloInput> }) {
  return (
    <>
      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Chat" {...field} />
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
                placeholder="Breve descrição do módulo (opcional)"
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
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background"
                />
              </FormControl>
              <span className="font-mono text-sm text-muted-foreground">
                {field.value?.toUpperCase()}
              </span>
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
