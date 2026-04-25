import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Users,
} from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModalForm } from "@/components/common/ModalForm";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { DeleteUserConfirmDialog } from "@/components/admin/DeleteUserConfirmDialog";
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
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  useUsuarios,
  useUpdateUsuario,
  useInviteUsuario,
  useResendInvite,
  useDeleteUsuario,
  type UsuarioAdmin,
} from "@/hooks/useUsuarios";
import { usePerfisAcesso } from "@/hooks/usePerfisAcesso";
import { useTenants } from "@/hooks/useTenants";
import type { AppPermissao } from "@/hooks/useProfile";
import { isAdminPerfil, isLastAdmin } from "@/lib/permissions";
import { formatRelativeSP } from "@/lib/format";
import { initials } from "@/lib/utils";
import { getStatusUsuario } from "@/lib/usuarios";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

const editSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80),
  perfil_acesso_id: z.string().uuid("Selecione um perfil de acesso"),
  tenant_id: z.string().uuid("Selecione um tenant"),
  ativo: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  nome: z.string().trim().min(2).max(100),
  perfil_acesso_id: z.string().uuid("Selecione um perfil de acesso"),
  tenant_id: z.string().uuid("Selecione um tenant"),
});
type InviteValues = z.infer<typeof inviteSchema>;

// Local aliases — use shared helpers from "@/lib/permissions"
const isAdmin = isAdminPerfil;
const isLastActiveAdmin = isLastAdmin;

function UsuariosPage() {
  const { user } = useAuth();
  const meuId = user?.id ?? null;
  const { data: usuarios, isLoading } = useUsuarios();
  const { data: perfis } = usePerfisAcesso();
  const { data: tenants } = useTenants();
  const updateMutation = useUpdateUsuario();
  const inviteMutation = useInviteUsuario();
  const resendMutation = useResendInvite();
  const deleteMutation = useDeleteUsuario();

  const [editTarget, setEditTarget] = React.useState<UsuarioAdmin | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] =
    React.useState<UsuarioAdmin | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<UsuarioAdmin | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const lista = usuarios ?? [];
  const perfisAtivos = React.useMemo(
    () => (perfis ?? []).filter((p) => p.ativo),
    [perfis],
  );
  const tenantsAtivos = React.useMemo(
    () => (tenants ?? []).filter((t) => t.ativo),
    [tenants],
  );

  const editValues = React.useMemo<EditValues>(() => {
    if (!editTarget) {
      return { nome: "", perfil_acesso_id: "", tenant_id: "", ativo: true };
    }
    return {
      nome: editTarget.nome,
      perfil_acesso_id: editTarget.perfil_acesso_id,
      tenant_id: editTarget.tenant_id,
      ativo: editTarget.ativo,
    };
  }, [editTarget]);

  const handleEdit = async (values: EditValues) => {
    if (!editTarget) return;
    await updateMutation.mutateAsync({
      id: editTarget.id,
      patch: {
        nome: values.nome,
        perfil_acesso_id: values.perfil_acesso_id,
        tenant_id: values.tenant_id,
        ativo: values.ativo,
      },
    });
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivate) return;
    await updateMutation.mutateAsync({
      id: confirmDeactivate.id,
      patch: { ativo: false },
    });
  };

  const reativar = (u: UsuarioAdmin) =>
    updateMutation.mutate({ id: u.id, patch: { ativo: true } });

  const handleInvite = async (values: InviteValues) => {
    await inviteMutation.mutateAsync(values);
  };

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
            <div className="truncate text-xs text-muted-foreground">
              {row.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "perfil_acesso_nome",
      header: "Perfil",
      render: (row) =>
        isAdmin(row.permissoes) ? (
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
      render: (row) => {
        const status = getStatusUsuario(row);
        if (status === "Ativo") {
          return (
            <Badge className="border-transparent bg-status-entregue/15 text-status-entregue hover:bg-status-entregue/20">
              Ativo
            </Badge>
          );
        }
        if (status === "Pendente") {
          return (
            <Badge className="border-status-triagem/30 bg-status-triagem/15 text-status-triagem hover:bg-status-triagem/20">
              Pendente
            </Badge>
          );
        }
        return <Badge variant="outline">Inativo</Badge>;
      },
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
          <span className="text-sm text-muted-foreground">—</span>
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
    const isLastAdminFlag = isLastActiveAdmin(lista, row);
    const deactivateDisabled = isLastAdminFlag || isSelf;
    const deactivateReason = isSelf
      ? "Você não pode desativar sua própria conta"
      : "Não é possível desativar o último administrador ativo";
    const showResend = !row.last_sign_in_at && !isSelf;
    const deleteDisabled = isSelf || isLastAdminFlag;
    const deleteReason = isSelf
      ? "Você não pode excluir sua própria conta"
      : "Último administrador — não pode ser excluído";

    return (
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
            Editar
          </DropdownMenuItem>
          {showResend && (
            <DropdownMenuItem
              onClick={() => resendMutation.mutate(row.id)}
              disabled={resendMutation.isPending}
            >
              <Mail className="mr-2 h-4 w-4" />
              Reenviar convite
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {row.ativo ? (
            <DisabledTooltipItem
              disabled={deactivateDisabled}
              reason={deactivateReason}
              onSelect={() => setConfirmDeactivate(row)}
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
          <DisabledTooltipItem
            disabled={deleteDisabled}
            reason={deleteReason}
            onSelect={() => setDeleteTarget(row)}
            icon={<Trash2 className="mr-2 h-4 w-4" />}
            label="Excluir usuário"
            destructive
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-8">
        <PageHeader
          title="Usuários"
          description="Gerencie acesso e perfis da equipe"
          action={
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </Button>
          }
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
              description="Convide o primeiro usuário pelo botão acima."
            />
          }
        />

        {editTarget && (
          <ModalForm<EditValues>
            open={!!editTarget}
            onOpenChange={(o) => !o && setEditTarget(null)}
            title={`Editar ${editTarget.nome}`}
            description={editTarget.email}
            schema={editSchema}
            defaultValues={editValues}
            onSubmit={handleEdit}
          >
            {(form) => (
              <EditUserFields
                form={form}
                target={editTarget}
                meuId={meuId}
                lista={lista}
                perfisAtivos={perfisAtivos}
              />
            )}
          </ModalForm>
        )}

        <ModalForm<InviteValues>
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title="Convidar usuário"
          description="O usuário receberá um e-mail com link pra definir a senha."
          schema={inviteSchema}
          defaultValues={{ email: "", nome: "", perfil_acesso_id: "" }}
          onSubmit={handleInvite}
          submitLabel="Enviar convite"
        >
          {(form) => (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="usuario@empresa.com"
                        {...field}
                        autoFocus
                      />
                    </FormControl>
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
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="perfil_acesso_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil de acesso</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {perfisAtivos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </ModalForm>

        <ConfirmDialog
          open={!!confirmDeactivate}
          onOpenChange={(o) => !o && setConfirmDeactivate(null)}
          title={
            confirmDeactivate ? `Desativar ${confirmDeactivate.nome}?` : ""
          }
          description={
            confirmDeactivate
              ? `${confirmDeactivate.nome} não conseguirá mais fazer login até ser reativado.`
              : ""
          }
          confirmLabel="Desativar"
          variant="destructive"
          onConfirm={handleConfirmDeactivate}
        />

        {deleteTarget && (
          <DeleteUserConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            userName={deleteTarget.nome}
            onConfirm={async () => {
              await deleteMutation.mutateAsync(deleteTarget.id);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

interface EditUserFieldsProps {
  form: import("react-hook-form").UseFormReturn<EditValues>;
  target: UsuarioAdmin;
  meuId: string | null;
  lista: UsuarioAdmin[];
  perfisAtivos: Array<{
    id: string;
    nome: string;
    permissoes: AppPermissao[];
  }>;
}

function EditUserFields({
  form,
  target,
  meuId,
  lista,
  perfisAtivos,
}: EditUserFieldsProps) {
  const isSelf = target.id === meuId;
  const isLastAdmin = isLastActiveAdmin(lista, target);

  const ativoDisabled = isSelf || isLastAdmin;
  const ativoReason = isSelf
    ? "Você não pode desativar sua própria conta"
    : "Não é possível desativar o último administrador ativo";

  return (
    <>
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

      <FormField
        control={form.control}
        name="perfil_acesso_id"
        render={({ field }) => {
          return (
            <FormItem>
              <FormLabel>Perfil de acesso</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {perfisAtivos.map((p) => {
                    const wouldRemoveAdmin =
                      isLastAdmin && !isAdmin(p.permissoes);
                    const selfDemote =
                      isSelf &&
                      isAdmin(target.permissoes) &&
                      !isAdmin(p.permissoes);
                    const disabled = wouldRemoveAdmin || selfDemote;
                    const reason = wouldRemoveAdmin
                      ? "Último administrador — não pode ser rebaixado"
                      : "Você não pode remover seu próprio acesso de administrador";

                    if (disabled) {
                      return (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <div>
                              <SelectItem value={p.id} disabled>
                                {p.nome}
                              </SelectItem>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {reason}
                          </TooltipContent>
                        </Tooltip>
                      );
                    }
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name="ativo"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Ativo</FormLabel>
              <FormDescription>
                Usuários inativos não conseguem fazer login.
              </FormDescription>
            </div>
            <FormControl>
              {ativoDisabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch checked={field.value} disabled />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">{ativoReason}</TooltipContent>
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
    </>
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
      className={
        destructive ? "text-destructive focus:text-destructive" : undefined
      }
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
