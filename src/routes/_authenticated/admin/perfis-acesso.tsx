import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShieldCheck } from "lucide-react";

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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissoesCheckboxGroup } from "@/components/admin/PermissoesCheckboxGroup";
import {
  perfilAcessoSchema,
  usePerfisAcesso,
  useCreatePerfilAcesso,
  useUpdatePerfilAcesso,
  useDeletePerfilAcesso,
  type PerfilAcesso,
  type PerfilAcessoInput,
} from "@/hooks/usePerfisAcesso";
import { formatRelativeSP } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/perfis-acesso")({
  component: PerfisAcessoPage,
});

const emptyValues: PerfilAcessoInput = {
  nome: "",
  descricao: "",
  permissoes: [],
  ativo: true,
};

const TOTAL_PERMS = 10;

function PerfisAcessoPage() {
  const { data: perfis, isLoading } = usePerfisAcesso();
  const createMut = useCreatePerfilAcesso();
  const updateMut = useUpdatePerfilAcesso();
  const deleteMut = useDeletePerfilAcesso();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PerfilAcesso | null>(null);
  const [deleting, setDeleting] = React.useState<PerfilAcesso | null>(null);

  const editValues = React.useMemo<PerfilAcessoInput>(() => {
    if (!editing) return emptyValues;
    return {
      nome: editing.nome,
      descricao: editing.descricao ?? "",
      permissoes: editing.permissoes,
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<PerfilAcesso>[] = [
    {
      key: "nome",
      header: "Nome",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.nome}</span>
          {row.sistema && (
            <Badge variant="outline" className="text-xs">
              Sistema
            </Badge>
          )}
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
      key: "permissoes",
      header: "Permissões",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.permissoes.length} / {TOTAL_PERMS}
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
    <TooltipProvider delayDuration={150}>
      <div className="p-8">
        <PageHeader
          title="Perfis de Acesso"
          description="Gerencie perfis e permissões do sistema"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo perfil
            </Button>
          }
        />

        <DataTable
          data={perfis}
          isLoading={isLoading}
          columns={columns}
          onEdit={(row) => setEditing(row)}
          onDelete={(row) => {
            if (row.sistema) return;
            setDeleting(row);
          }}
          searchableFields={["nome", "descricao"]}
          searchPlaceholder="Buscar perfis..."
          getRowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={ShieldCheck}
              title="Nenhum perfil cadastrado"
              description="Crie um perfil pra começar a atribuir permissões."
            />
          }
        />

        <ModalForm<PerfilAcessoInput>
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="Novo perfil de acesso"
          description="Defina o nome e selecione as permissões."
          schema={perfilAcessoSchema}
          defaultValues={emptyValues}
          onSubmit={async (values) => {
            await createMut.mutateAsync(values);
          }}
        >
          {(form) => <PerfilFields form={form} />}
        </ModalForm>

        <ModalForm<PerfilAcessoInput>
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          title={editing ? `Editar ${editing.nome}` : "Editar perfil"}
          description={
            editing?.sistema
              ? "Perfil de sistema: apenas a descrição pode ser alterada."
              : undefined
          }
          schema={perfilAcessoSchema}
          defaultValues={editValues}
          onSubmit={async (values) => {
            if (!editing) return;
            await updateMut.mutateAsync({ id: editing.id, input: values });
          }}
        >
          {(form) => <PerfilFields form={form} sistema={editing?.sistema} />}
        </ModalForm>

        <ConfirmDialog
          open={!!deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          title="Excluir perfil"
          description={
            deleting ? (
              <>
                Tem certeza que deseja excluir{" "}
                <strong className="text-foreground">{deleting.nome}</strong>?
                Esta ação não pode ser desfeita.
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
    </TooltipProvider>
  );
}

function PerfilFields({
  form,
  sistema,
}: {
  form: UseFormReturn<PerfilAcessoInput>;
  sistema?: boolean;
}) {
  return (
    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              {sistema ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Input {...field} disabled />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Nome de perfil sistema não pode ser alterado
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Input placeholder="Ex: Dev Júnior" {...field} />
              )}
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
                rows={2}
                placeholder="Breve descrição do perfil (opcional)"
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
        name="permissoes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Permissões</FormLabel>
            <FormControl>
              <PermissoesCheckboxGroup
                value={field.value}
                onChange={field.onChange}
                disabled={sistema}
                disabledReason={
                  sistema
                    ? "Permissões de perfil sistema são fixas"
                    : undefined
                }
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
                Perfis inativos não podem ser atribuídos a usuários.
              </FormDescription>
            </div>
            <FormControl>
              {sistema ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        checked={field.value}
                        disabled
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Perfil sistema não pode ser desativado
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
