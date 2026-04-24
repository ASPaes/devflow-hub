import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MoreHorizontal,
  Pencil,
  Power,
  PowerOff,
  Users,
} from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModalForm } from "@/components/common/ModalForm";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useUsuarios, useUpdateUsuario, type UsuarioAdmin } from "@/hooks/useUsuarios";
import { formatRelativeSP } from "@/lib/format";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

const editNomeSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80),
});
type EditNomeValues = z.infer<typeof editNomeSchema>;

type ConfirmState = { usuario: UsuarioAdmin } | null;

function isAdmin(u: UsuarioAdmin) {
  return (
    u.permissoes.includes("gerenciar_usuarios") &&
    u.permissoes.includes("gerenciar_perfis_acesso")
  );
}

function isLastActiveAdmin(usuarios: UsuarioAdmin[], candidato: UsuarioAdmin) {
  if (!isAdmin(candidato) || !candidato.ativo) return false;
  const ativosAdmin = usuarios.filter((u) => isAdmin(u) && u.ativo);
  return ativosAdmin.length === 1 && ativosAdmin[0].id === candidato.id;
}

function UsuariosPage() {
  const { user } = useAuth();
  const meuId = user?.id ?? null;
  const { data: usuarios, isLoading } = useUsuarios();
  const updateMutation = useUpdateUsuario();

  const [editTarget, setEditTarget] = React.useState<UsuarioAdmin | null>(null);
  const [confirmState, setConfirmState] = React.useState<ConfirmState>(null);

  const lista = usuarios ?? [];

  const handleEditNome = async (values: EditNomeValues) => {
    if (!editTarget) return;
    await updateMutation.mutateAsync({ id: editTarget.id, patch: { nome: values.nome } });
  };

  const handleConfirm = async () => {
    if (!confirmState) return;
    await updateMutation.mutateAsync({
      id: confirmState.usuario.id,
      patch: { ativo: false },
    });
  };

  const reativar = (u: UsuarioAdmin) =>
    updateMutation.mutate({ id: u.id, patch: { ativo: true } });

  const columns: DataTableColumn<UsuarioAdmin>[] = [
    {
      key: "usuario",
      header: "Usuário",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/20 text-xs font-medium text-primary">
              {initials(row.nome || row.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="truncate">{row.nome}</span>
              {row.id === meuId && (
                <span className="text-xs text-muted-foreground">(você)</span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "perfil_acesso_nome",
      header: "Perfil",
      render: (row) =>
        isAdmin(row) ? (
          <Badge className="border-transparent bg-status-desenvolvimento/15 text-status-desenvolvimento hover:bg-status-desenvolvimento/20">
            {row.perfil_acesso_nome}
          </Badge>
        ) : (
          <Badge variant="secondary">{row.perfil_acesso_nome}</Badge>
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
          <Badge variant="outline">Inativo</Badge>
        ),
    },
    {
      key: "last_sign_in_at",
      header: "Último acesso",
      render: (row) =>
        row.last_sign_in_at ? (
          <span className="text-sm text-muted-foreground">
            {formatRelativeSP(row.last_sign_in_at)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Nunca</span>
        ),
    },
    {
      key: "created_at",
      header: "Cadastro",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeSP(row.created_at)}
        </span>
      ),
    },
  ];

  const renderRowActions = (row: UsuarioAdmin) => {
    const isSelf = row.id === meuId;
    const isLastAdmin = isLastActiveAdmin(lista, row);
    const deactivateDisabled = isLastAdmin || isSelf;

    const deactivateReason = isSelf
      ? "Você não pode desativar sua própria conta"
      : "Não é possível desativar o último administrador ativo";

    return (
      <TooltipProvider delayDuration={150}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Ações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setEditTarget(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar nome
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {row.ativo ? (
              <DisabledTooltipItem
                disabled={deactivateDisabled}
                reason={deactivateReason}
                onSelect={() => setConfirmState({ usuario: row })}
                icon={<PowerOff className="mr-2 h-4 w-4" />}
                label="Desativar"
                destructive
              />
            ) : (
              <DropdownMenuItem onClick={() => reativar(row)}>
                <Power className="mr-2 h-4 w-4" />
                Reativar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Usuários"
        description="Gerencie acesso e perfis da equipe"
      />

      <DataTable<UsuarioAdmin>
        data={lista}
        isLoading={isLoading}
        columns={columns}
        searchableFields={["nome", "email"]}
        searchPlaceholder="Buscar por nome ou e-mail..."
        rowActions={renderRowActions}
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Users}
            title="Nenhum usuário"
            description="Ainda não há usuários cadastrados no sistema."
          />
        }
      />

      {editTarget && (
        <ModalForm<EditNomeValues>
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          title="Editar nome"
          description={editTarget.email}
          schema={editNomeSchema}
          defaultValues={{ nome: editTarget.nome }}
          onSubmit={handleEditNome}
        >
          {(form) => (
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </ModalForm>
      )}

      <ConfirmDialog
        open={!!confirmState}
        onOpenChange={(o) => !o && setConfirmState(null)}
        title={confirmState ? `Desativar ${confirmState.usuario.nome}?` : ""}
        description={
          confirmState
            ? `${confirmState.usuario.nome} não conseguirá mais fazer login até ser reativado.`
            : ""
        }
        confirmLabel="Desativar"
        variant="destructive"
        onConfirm={handleConfirm}
      />
    </div>
  );
}

interface DisabledTooltipItemProps {
  disabled: boolean;
  reason: string;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}

function DisabledTooltipItem({
  disabled,
  reason,
  onSelect,
  icon,
  label,
  destructive,
}: DisabledTooltipItemProps) {
  const item = (
    <DropdownMenuItem
      onSelect={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onSelect();
      }}
      disabled={disabled}
      className={destructive ? "text-destructive focus:text-destructive" : undefined}
    >
      {icon}
      {label}
    </DropdownMenuItem>
  );

  if (!disabled) return item;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{item}</div>
      </TooltipTrigger>
      <TooltipContent side="left">{reason}</TooltipContent>
    </Tooltip>
  );
}
