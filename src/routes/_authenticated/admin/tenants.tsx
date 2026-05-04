import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { createFileRoute } from "@tanstack/react-router";
import { Building, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { TenantLogo } from "@/components/ui/TenantLogo";
import {
  useRemoverTenantLogo,
  useUploadTenantLogo,
} from "@/hooks/useTenantLogo";

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
  tenantSchema,
  useTenants,
  useCreateTenant,
  useDeleteTenant,
  useUpdateTenant,
  type Tenant,
  type TenantInput,
} from "@/hooks/useTenants";
import { formatRelativeSP } from "@/lib/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/admin/tenants")({
  component: TenantsPage,
});

const emptyValues: TenantInput = {
  nome: "",
  descricao: "",
  doctorsaas_tenant_id: "",
  ativo: true,
};

function TenantsPage() {
  useDocumentTitle("Empresas");
  const { data: tenants, isLoading } = useTenants();
  const createMut = useCreateTenant();
  const updateMut = useUpdateTenant();
  const deleteMut = useDeleteTenant();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Tenant | null>(null);
  const [deleting, setDeleting] = React.useState<Tenant | null>(null);

  const editValues = React.useMemo<TenantInput>(() => {
    if (!editing) return emptyValues;
    return {
      nome: editing.nome,
      descricao: editing.descricao ?? "",
      doctorsaas_tenant_id: editing.doctorsaas_tenant_id ?? "",
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<Tenant>[] = [
    {
      key: "logo",
      header: "",
      render: (row) => (
        <TenantLogo nome={row.nome} logoUrl={row.logo_url} updatedAt={row.updated_at} size="md" />
      ),
    },
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
      key: "doctorsaas_tenant_id",
      header: "DoctorSaas ID",
      render: (row) =>
        row.doctorsaas_tenant_id ? (
          <span className="font-mono text-xs text-muted-foreground">
            {row.doctorsaas_tenant_id}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
    <div className="p-8">
      <PageHeader
        title="Empresas"
        description="Empresas que utilizam o devflow-hub"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova empresa
          </Button>
        }
      />

      <DataTable
        data={tenants}
        isLoading={isLoading}
        columns={columns}
        onEdit={(row) => setEditing(row)}
        onDelete={(row) => setDeleting(row)}
        searchableFields={["nome", "descricao"]}
        searchPlaceholder="Buscar empresas..."
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Building}
            title="Nenhuma empresa cadastrada"
            description="Cadastre a primeira empresa para organizar usuários e demandas."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar primeira empresa
              </Button>
            }
          />
        }
      />

      <ModalForm<TenantInput>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nova empresa"
        description="Cadastre uma empresa do devflow-hub."
        schema={tenantSchema}
        defaultValues={emptyValues}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values);
        }}
      >
        {(form) => <TenantFields form={form} />}
      </ModalForm>

      <ModalForm<TenantInput>
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar empresa"
        schema={tenantSchema}
        defaultValues={editValues}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateMut.mutateAsync({ id: editing.id, input: values });
        }}
      >
        {(form) => (
          <>
            {editing && <TenantLogoUpload tenant={editing} />}
            <TenantFields form={form} />
          </>
        )}
      </ModalForm>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir empresa"
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

function TenantFields({ form }: { form: UseFormReturn<TenantInput> }) {
  return (
    <>
      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <FormControl>
              <Input placeholder="Ex: ASP Softwares" {...field} />
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
                placeholder="Breve descrição do tenant (opcional)"
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
        name="doctorsaas_tenant_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>DoctorSaas Tenant ID</FormLabel>
            <FormControl>
              <Input
                placeholder="00000000-0000-0000-0000-000000000000"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormDescription>
              ID da empresa correspondente no DoctorSaas, quando aplicável. Use
              para mapear futura integração.
            </FormDescription>
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
                Empresas inativas não recebem novos usuários nem demandas.
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

function TenantLogoUpload({
  tenant,
}: {
  tenant: { id: string; nome: string; logo_url: string | null };
}) {
  const upload = useUploadTenantLogo();
  const remover = useRemoverTenantLogo();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Logo maior que 2MB");
      e.target.value = "";
      return;
    }
    upload.mutate({ tenantId: tenant.id, arquivo: f });
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Logo</label>
      <div className="flex items-center gap-4">
        <TenantLogo
          nome={tenant.nome}
          logoUrl={tenant.logo_url}
          updatedAt={tenant.updated_at}
          size="lg"
        />
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFile}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              {tenant.logo_url ? "Trocar" : "Enviar"}
            </Button>
            {tenant.logo_url && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm("Remover logo?")) {
                    remover.mutate({
                      tenantId: tenant.id,
                      logoUrl: tenant.logo_url!,
                    });
                  }
                }}
                disabled={remover.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, SVG, WEBP ou GIF até 2MB.
          </p>
        </div>
      </div>
    </div>
  );
}
