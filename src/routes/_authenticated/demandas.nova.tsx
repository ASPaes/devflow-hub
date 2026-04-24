import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { requirePermission } from "@/lib/auth-guards";
import { useAuth } from "@/hooks/useAuth";
import { useAreas } from "@/hooks/useAreas";
import { useModulos } from "@/hooks/useModulos";
import { useSubmodulos } from "@/hooks/useSubmodulos";
import {
  novaDemandaSchema,
  PRIORIDADE_LABEL,
  TIPO_DEMANDA_LABEL,
  TIPO_DEMANDA_VALUES,
  useCreateDemanda,
  type NovaDemandaInput,
} from "@/hooks/useDemandas";
import { AnexosUpload } from "@/components/demandas/AnexosUpload";

export const Route = createFileRoute("/_authenticated/demandas/nova")({
  beforeLoad: requirePermission("criar_demanda"),
  component: NovaDemandaPage,
});

const PRIORIDADES = [1, 2, 3, 4, 5] as const;

function NovaDemandaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anexos, setAnexos] = React.useState<File[]>([]);
  const createDemanda = useCreateDemanda();

  const modulosQuery = useModulos();
  const submodulosQuery = useSubmodulos();
  const areasQuery = useAreas();

  const form = useForm<NovaDemandaInput>({
    resolver: zodResolver(novaDemandaSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "tarefa",
      prioridade: 3,
      modulo_id: "",
      submodulo_id: "",
      area_id: "",
    },
  });

  const moduloId = form.watch("modulo_id");

  const modulosAtivos = React.useMemo(
    () => (modulosQuery.data ?? []).filter((m) => m.ativo),
    [modulosQuery.data],
  );
  const areasAtivas = React.useMemo(
    () => (areasQuery.data ?? []).filter((a) => a.ativo),
    [areasQuery.data],
  );
  const submodulosFiltrados = React.useMemo(
    () =>
      (submodulosQuery.data ?? []).filter(
        (s) => s.ativo && s.modulo_id === moduloId,
      ),
    [submodulosQuery.data, moduloId],
  );

  // Reset submódulo quando o módulo muda
  const prevModuloRef = React.useRef(moduloId);
  React.useEffect(() => {
    if (prevModuloRef.current !== moduloId) {
      prevModuloRef.current = moduloId;
      form.setValue("submodulo_id", "", { shouldValidate: false });
    }
  }, [moduloId, form]);

  const isSubmitting = createDemanda.isPending;

  const onSubmit = async (input: NovaDemandaInput) => {
    if (!user?.id) return;
    try {
      await createDemanda.mutateAsync({ input, anexos, userId: user.id });
      navigate({ to: "/" });
    } catch {
      // toast já tratado no hook
    }
  };

  const isLoadingDeps =
    modulosQuery.isLoading || submodulosQuery.isLoading || areasQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Nova demanda"
        description="Abra uma solicitação de desenvolvimento"
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={isSubmitting} className="contents">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Coluna principal */}
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-medium">
                      Conteúdo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <FormField
                      control={form.control}
                      name="titulo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Resuma a demanda em uma linha"
                              {...field}
                            />
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
                          <FormDescription>
                            Descreva o problema/pedido de forma clara. Se for um
                            erro, inclua os passos pra reproduzir.
                          </FormDescription>
                          <FormControl>
                            <Textarea
                              placeholder="O que precisa ser feito? Qual o contexto?"
                              className="min-h-[200px] resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-medium">
                      Anexos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AnexosUpload
                      files={anexos}
                      onChange={setAnexos}
                      disabled={isSubmitting}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Coluna lateral */}
              <div className="space-y-6 lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-medium">
                      Classificação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <FormField
                      control={form.control}
                      name="tipo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIPO_DEMANDA_VALUES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {TIPO_DEMANDA_LABEL[t]}
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
                      name="prioridade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridade</FormLabel>
                          <FormControl>
                            <PrioridadePicker
                              value={Number(field.value)}
                              onChange={(v) => field.onChange(v)}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormDescription>
                            Use 4-5 apenas pra itens urgentes que impactam
                            operação.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="modulo_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Módulo</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting || modulosQuery.isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    modulosQuery.isLoading
                                      ? "Carregando..."
                                      : "Selecione um módulo"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {modulosAtivos.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{
                                        backgroundColor: m.cor ?? "#71717a",
                                      }}
                                      aria-hidden
                                    />
                                    {m.nome}
                                  </div>
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
                      name="submodulo_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Submódulo</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={
                              isSubmitting ||
                              !moduloId ||
                              submodulosQuery.isLoading
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    !moduloId
                                      ? "Selecione um módulo primeiro"
                                      : "Selecione um submódulo"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {submodulosFiltrados.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.nome}
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
                      name="area_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Área</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isSubmitting || areasQuery.isLoading}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    areasQuery.isLoading
                                      ? "Carregando..."
                                      : "Selecione uma área"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {areasAtivas.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isLoadingDeps && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Carregando opções...
                        </Label>
                        <Skeleton className="h-9 w-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/" })}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar demanda
              </Button>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
}

interface PrioridadePickerProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function PrioridadePicker({ value, onChange, disabled }: PrioridadePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Prioridade"
      className="grid grid-cols-5 gap-1.5"
    >
      {PRIORIDADES.map((p) => {
        const selected = value === p;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(p)}
            title={PRIORIDADE_LABEL[p]}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-md border-2 px-1 py-2 text-center transition-all",
              "border-input bg-card hover:border-muted-foreground/50",
              selected && "border-current shadow-sm",
              disabled && "cursor-not-allowed opacity-50 hover:border-input",
            )}
            style={
              selected
                ? {
                    color: `var(--color-prioridade-${p})`,
                    backgroundColor: `color-mix(in oklab, var(--color-prioridade-${p}) 12%, transparent)`,
                  }
                : undefined
            }
          >
            <span className="text-base font-semibold leading-none">{p}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {p === 1
                ? "Baixa"
                : p === 2
                  ? "Menor"
                  : p === 3
                    ? "Normal"
                    : p === 4
                      ? "Alta"
                      : "Urgente"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
