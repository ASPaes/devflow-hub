import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Power, Tags } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ModalForm } from "@/components/common/ModalForm";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useProfile } from "@/hooks/useProfile";
import {
  useCriarTipo,
  useEditarTipo,
  useExcluirTipo,
  useTiposDemanda,
} from "@/hooks/useTiposDemanda";
import type { TipoDemanda } from "@/types/tipo-demanda";

export const Route = createFileRoute("/_authenticated/configuracoes/tipos")({
  component: TiposDemandaPage,
});

const ICONES_SUGERIDOS = ["🐛", "✨", "🚀", "📋", "❓", "🔧", "⚡", "🎯"];

const tipoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2, "Código muito curto")
    .max(40, "Código muito longo")
    .regex(/^[a-z0-9_\- ]+$/i, "Use letras, números, _ ou -"),
  label: z
    .string()
    .trim()
    .min(2, "Rótulo muito curto")
    .max(60, "Rótulo muito longo"),
  icone: z.string().trim().max(40).optional().or(z.literal("")),
  cor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use formato #RRGGBB")
    .optional()
    .or(z.literal("")),
  ordem: z.coerce.number().int().min(0).max(9999),
  ativo: z.boolean().optional(),
});

type TipoInput = z.infer<typeof tipoSchema>;

const emptyValues: TipoInput = {
  codigo: "",
  label: "",
  icone: "",
  cor: "#3B82F6",
  ordem: 0,
  ativo: true,
};

function TiposDemandaPage() {
  const { temPermissao } = useProfile();
  const podeGerenciar = temPermissao("gerenciar_tipos");

  const [mostrarInativos, setMostrarInativos] = React.useState(false);
  const { data: tipos, isLoading } = useTiposDemanda(mostrarInativos);
  const criar = useCriarTipo();
  const editar = useEditarTipo();
  const excluir = useExcluirTipo();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TipoDemanda | null>(null);

  const editValues = React.useMemo<TipoInput>(() => {
    if (!editing) return emptyValues;
    return {
      codigo: editing.codigo,
      label: editing.label,
      icone: editing.icone ?? "",
      cor: editing.cor ?? "#3B82F6",
      ordem: editing.ordem,
      ativo: editing.ativo,
    };
  }, [editing]);

  const columns: DataTableColumn<TipoDemanda>[] = [
    {
      key: "icone",
      header: "Ícone",
      render: (row) => (
        <span className="text-lg">{row.icone ?? "—"}</span>
      ),
    },
    {
      key: "codigo",
      header: "Código",
      render: (row) => (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {row.codigo}
        </code>
      ),
    },
    {
      key: "label",
      header: "Rótulo",
      render: (row) => (
        <span className="font-medium text-foreground">{row.label}</span>
      ),
    },
    {
      key: "cor",
      header: "Cor",
      render: (row) =>
        row.cor ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded border border-border"
              style={{ backgroundColor: row.cor }}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {row.cor}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "ordem",
      header: "Ordem",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.ordem}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.sistema && (
            <Badge variant="outline" className="text-xs">
              Sistema
            </Badge>
          )}
          {row.ativo ? (
            <Badge className="border-transparent bg-status-entregue/15 text-status-entregue hover:bg-status-entregue/20">
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary">Inativo</Badge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tipos de Demanda"
        description="Cadastre os tipos disponíveis para classificar as demandas."
        action={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={mostrarInativos}
                onCheckedChange={setMostrarInativos}
              />
              Mostrar inativos
            </label>
            {podeGerenciar && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo tipo
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        data={tipos}
        isLoading={isLoading}
        columns={columns}
        onEdit={podeGerenciar ? (row) => setEditing(row) : undefined}
        rowActions={
          podeGerenciar
            ? (row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (row.ativo) {
                      excluir.mutate(row.id);
                    } else {
                      editar.mutate({
                        id: row.id,
                        label: row.label,
                        icone: row.icone,
                        cor: row.cor,
                        ordem: row.ordem,
                        ativo: true,
                      });
                    }
                  }}
                  disabled={
                    (row.sistema && row.ativo) ||
                    excluir.isPending ||
                    editar.isPending
                  }
                  title={
                    row.sistema && row.ativo
                      ? "Tipos do sistema não podem ser desativados"
                      : row.ativo
                        ? "Desativar"
                        : "Reativar"
                  }
                >
                  <Power className="h-4 w-4" />
                  <span className="ml-2">
                    {row.ativo ? "Desativar" : "Reativar"}
                  </span>
                </Button>
              )
            : undefined
        }
        searchableFields={["codigo", "label"]}
        searchPlaceholder="Buscar tipos..."
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Tags}
            title="Nenhum tipo cadastrado"
            description="Cadastre o primeiro tipo de demanda."
            action={
              podeGerenciar ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro tipo
                </Button>
              ) : undefined
            }
          />
        }
      />

      {podeGerenciar && (
        <>
          <ModalForm<TipoInput>
            open={createOpen}
            onOpenChange={setCreateOpen}
            title="Novo tipo"
            description="Cadastre um novo tipo de demanda."
            schema={tipoSchema}
            defaultValues={emptyValues}
            onSubmit={async (values) => {
              await criar.mutateAsync({
                codigo: values.codigo,
                label: values.label,
                icone: values.icone?.trim() ? values.icone : null,
                cor: values.cor?.trim() ? values.cor : null,
                ordem: values.ordem,
              });
            }}
          >
            {(form) => <TipoFields form={form} isEdit={false} sistema={false} />}
          </ModalForm>

          <ModalForm<TipoInput>
            open={!!editing}
            onOpenChange={(o) => !o && setEditing(null)}
            title="Editar tipo"
            description="Atualize os dados do tipo."
            schema={tipoSchema}
            defaultValues={editValues}
            onSubmit={async (values) => {
              if (!editing) return;
              await editar.mutateAsync({
                id: editing.id,
                label: values.label,
                icone: values.icone?.trim() ? values.icone : null,
                cor: values.cor?.trim() ? values.cor : null,
                ordem: values.ordem,
                ativo: values.ativo ?? editing.ativo,
              });
            }}
          >
            {(form) => (
              <TipoFields
                form={form}
                isEdit={true}
                sistema={editing?.sistema ?? false}
              />
            )}
          </ModalForm>
        </>
      )}
    </div>
  );
}

function TipoFields({
  form,
  isEdit,
  sistema,
}: {
  form: import("react-hook-form").UseFormReturn<TipoInput>;
  isEdit: boolean;
  sistema: boolean;
}) {
  const codigoDisabled = isEdit || sistema;
  return (
    <>
      <FormField
        control={form.control}
        name="codigo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Código</FormLabel>
            <FormControl>
              <Input
                placeholder="ex: melhoria"
                {...field}
                disabled={codigoDisabled}
              />
            </FormControl>
            <FormDescription>
              {codigoDisabled
                ? "Código não pode ser alterado."
                : "Slug único. Será normalizado (minúsculas, sem espaços)."}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rótulo</FormLabel>
            <FormControl>
              <Input placeholder="ex: Melhoria" autoFocus {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="icone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ícone</FormLabel>
            <FormControl>
              <Input
                placeholder="ex: 🐛"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormDescription className="flex flex-wrap gap-1">
              {ICONES_SUGERIDOS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => form.setValue("icone", emoji)}
                  className="rounded border border-border px-2 py-1 text-base hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </FormDescription>
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
            <FormControl>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={field.value || "#3B82F6"}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
                />
                <Input
                  placeholder="#3B82F6"
                  {...field}
                  value={field.value ?? ""}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="ordem"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ordem</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                {...field}
                value={field.value ?? 0}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {isEdit && (
        <FormField
          control={form.control}
          name="ativo"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <FormLabel>Ativo</FormLabel>
                <FormDescription>
                  Tipos inativos não aparecem nos seletores.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                  disabled={sistema}
                />
              </FormControl>
            </FormItem>
          )}
        />
      )}
    </>
  );
}
