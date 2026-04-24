import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Network, Plus } from "lucide-react";

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
  submoduloSchema,
  useCreateSubmodulo,
  useDeleteSubmodulo,
  useSubmodulos,
  useUpdateSubmodulo,
  type SubmoduloComModulo,
  type SubmoduloInput,
} from "@/hooks/useSubmodulos";
import { useModulos } from "@/hooks/useModulos";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/submodulos")({
  component: SubmodulosPage,
});

const ALL = "__todos__";
const DEFAULT_COLOR = "#8B5CF6";

const emptyValues: SubmoduloInput = {
  modulo_id: "",
  nome: "",
  descricao: "",
  ativo: true,
};

function SubmodulosPage() {
  const { data: submodulos, isLoading } = useSubmodulos();
  const { data: modulos } = useModulos();
  const createMut = useCreateSubmodulo();
  const updateMut = useUpdateSubmodulo();
  const deleteMut = useDeleteSubmodulo();

  const [filtroModulo, setFiltroModulo] = React.useState<string>(ALL);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubmoduloComModulo | null>(null);
  const [deleting, setDeleting] = React.useState<SubmoduloComModulo | null>(
    null,
  );

  const modulosAtivos = React.useMemo(
    () => (modulos ?? []).filter((m) => m.ativo),
    [modulos],
  );

  const filtered = React.useMemo(() => {
    if (!submodulos) return undefined;
    if (filtroModulo === ALL) return submodulos;
    return submodulos.filter((s) => s.modulo_id === filtroModulo);
  }, [submodulos, filtroModulo]);

  const editValues = React.useMemo<SubmoduloInput>(() => {
    if (!editing) return emptyValues;
    return {
      modulo_id: editing.modulo_id,
      nome: editing.nome,
      descricao: editing.descricao ?? "",
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<SubmoduloComModulo>[] = [
    {
      key: "modulo",
      header: "Módulo",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: row.modulo?.cor ?? DEFAULT_COLOR }}
            aria-hidden
          />
          <span className="font-mono text-xs text-muted-foreground">
            {row.modulo?.nome ?? "—"}
          </span>
        </div>
      ),
    },
    {
      key: "nome",
      header: "Submódulo",
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

  const noModulos = (modulos?.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Submódulos"
        description="Detalhamento de telas e funcionalidades de cada módulo"
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={modulosAtivos.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo submódulo
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Todos os módulos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os módulos</SelectItem>
            {(modulos ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome}
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
        searchableFields={["nome", "descricao"]}
        searchPlaceholder="Buscar submódulos..."
        getRowKey={(row) => row.id}
        emptyState={
          noModulos ? (
            <EmptyState
              icon={Network}
              title="Nenhum módulo cadastrado ainda"
              description="Crie o primeiro módulo em /admin/modulos — o submódulo 'Geral' virá junto automaticamente."
              action={
                <Button asChild>
                  <Link to="/admin/modulos">Ir para Módulos</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Network}
              title="Nenhum submódulo cadastrado"
              description="Cadastre submódulos para detalhar onde as demandas ocorrem."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro submódulo
                </Button>
              }
            />
          )
        }
      />

      <ModalForm<SubmoduloInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo submódulo"
        description="Cadastre um submódulo dentro de um módulo existente."
        schema={submoduloSchema}
        defaultValues={emptyValues}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values);
        }}
      >
        {(form) => <SubmoduloFields form={form} modulos={modulosAtivos} />}
      </ModalForm>

      <ModalForm<SubmoduloInput>
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar submódulo"
        schema={submoduloSchema}
        defaultValues={editValues}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateMut.mutateAsync({ id: editing.id, input: values });
        }}
      >
        {(form) => <SubmoduloFields form={form} modulos={modulosAtivos} />}
      </ModalForm>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir submódulo"
        description={
          deleting ? (
            <>
              Excluir{" "}
              <strong className="text-foreground">{deleting.nome}</strong> de{" "}
              <strong className="text-foreground">
                {deleting.modulo?.nome ?? "—"}
              </strong>
              ? Esta ação não pode ser desfeita.
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

interface SubmoduloFieldsProps {
  form: UseFormReturn<SubmoduloInput>;
  modulos: Array<{ id: string; nome: string; cor: string | null }>;
}

function SubmoduloFields({ form, modulos }: SubmoduloFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="modulo_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Módulo</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um módulo" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {modulos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: m.cor ?? DEFAULT_COLOR }}
                        aria-hidden
                      />
                      {m.nome}
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
              <Input placeholder="Ex: conversa" {...field} />
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
                placeholder="Breve descrição do submódulo (opcional)"
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
        name="ativo"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Ativo</FormLabel>
              <FormDescription>
                Submódulos inativos não aparecem em novas demandas.
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
