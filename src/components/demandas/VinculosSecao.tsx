import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightToLine,
  Ban,
  Check,
  ChevronsUpDown,
  Copy,
  Link2,
  Loader2,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModalForm } from "@/components/common/ModalForm";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { STATUS_DEMANDA_LABEL, type StatusDemanda } from "@/hooks/useDemandas";
import {
  TIPOS_VINCULO_VALUES,
  useCreateVinculo,
  useDeleteVinculo,
  useDemandasParaVincular,
  useVinculos,
  type DemandaVinculada,
  type TipoVinculo,
  type Vinculo,
} from "@/hooks/useVinculos";
import { STATUS_BADGE_STYLES } from "@/components/demandas/MetadataSidebar";

interface TipoVinculoMeta {
  label: string;
  icone: LucideIcon;
  cor: string;
}

export const TIPOS_VINCULO_META: Record<TipoVinculo, TipoVinculoMeta> = {
  depende_de: {
    label: "Depende de",
    icone: ArrowRightToLine,
    cor: "text-status-analise",
  },
  bloqueia: {
    label: "Bloqueia",
    icone: Ban,
    cor: "text-status-reaberta",
  },
  relacionada: {
    label: "Relacionada a",
    icone: Link2,
    cor: "text-accent",
  },
  duplicada: {
    label: "Duplicada por",
    icone: Copy,
    cor: "text-muted-foreground",
  },
};

interface Props {
  demandaId: string;
  podeAdicionar: boolean;
  podeRemover: boolean;
}

export function VinculosSecao({ demandaId, podeAdicionar, podeRemover }: Props) {
  const { data: vinculos = [], isLoading } = useVinculos(demandaId);
  const [addOpen, setAddOpen] = React.useState(false);

  const grupos = React.useMemo(() => {
    const map = new Map<TipoVinculo, Vinculo[]>();
    for (const v of vinculos) {
      const arr = map.get(v.tipo_vinculo as TipoVinculo) ?? [];
      arr.push(v);
      map.set(v.tipo_vinculo as TipoVinculo, arr);
    }
    return Array.from(map.entries());
  }, [vinculos]);

  return (
    <div className="space-y-4">
      {podeAdicionar && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar vínculo
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : vinculos.length === 0 ? (
        <EmptyVinculos podeAdicionar={podeAdicionar} />
      ) : (
        <div className="space-y-5">
          {grupos.map(([tipo, lista]) => (
            <GrupoVinculos
              key={tipo}
              tipo={tipo}
              vinculos={lista}
              podeRemover={podeRemover}
            />
          ))}
        </div>
      )}

      <AddVinculoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        demandaId={demandaId}
      />
    </div>
  );
}

function EmptyVinculos({ podeAdicionar }: { podeAdicionar: boolean }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <Link2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
      <p>Nenhum vínculo ainda.</p>
      {podeAdicionar && (
        <p className="mt-1">Conecte esta demanda a outras relacionadas.</p>
      )}
    </div>
  );
}

function GrupoVinculos({
  tipo,
  vinculos,
  podeRemover,
}: {
  tipo: TipoVinculo;
  vinculos: Vinculo[];
  podeRemover: boolean;
}) {
  const meta = TIPOS_VINCULO_META[tipo];
  const Icon = meta.icone;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", meta.cor)} />
        {meta.label}
      </div>
      <ul className="space-y-1.5">
        {vinculos.map((v) => (
          <VinculoLinha key={v.id} vinculo={v} podeRemover={podeRemover} />
        ))}
      </ul>
    </section>
  );
}

function VinculoLinha({
  vinculo,
  podeRemover,
}: {
  vinculo: Vinculo;
  podeRemover: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const deleteMutation = useDeleteVinculo();
  const destino = vinculo.demanda_destino;

  if (!destino) {
    return (
      <li className="rounded-md border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        Demanda indisponível
      </li>
    );
  }

  const status = (destino.status ?? "triagem") as StatusDemanda;

  return (
    <li className="group flex items-center gap-3 rounded-md border border-border bg-card/50 px-3 py-2 transition-colors hover:bg-secondary/40">
      <Link
        to="/demandas/$codigo"
        params={{ codigo: destino.codigo ?? "" }}
        className="flex flex-1 items-center gap-3 truncate"
      >
        <span className="font-mono text-xs text-muted-foreground">
          {destino.codigo}
        </span>
        <span className="flex-1 truncate text-sm text-foreground">
          {destino.titulo}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE_STYLES[status],
          )}
        >
          {STATUS_DEMANDA_LABEL[status]}
        </span>
      </Link>
      {podeRemover && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100"
          onClick={() => setConfirmOpen(true)}
          aria-label="Remover vínculo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remover vínculo?"
        description="Esta ação não pode ser desfeita."
        variant="destructive"
        confirmLabel="Remover"
        onConfirm={async () => {
          await deleteMutation.mutateAsync({
            id: vinculo.id,
            demanda_origem_id: vinculo.demanda_origem_id,
          });
        }}
      />
    </li>
  );
}

// ---------- Add dialog ----------

const vinculoSchema = z.object({
  tipo_vinculo: z.enum(TIPOS_VINCULO_VALUES),
  demanda_destino_id: z.string().uuid("Selecione uma demanda"),
});

type VinculoFormValues = z.infer<typeof vinculoSchema>;

function AddVinculoDialog({
  open,
  onOpenChange,
  demandaId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string;
}) {
  const { user } = useAuth();
  const createMutation = useCreateVinculo();
  const navigate = useNavigate();

  const handleSubmit = async (values: VinculoFormValues) => {
    if (!user) {
      toast.error("Sessão expirada");
      return;
    }
    await createMutation.mutateAsync({
      demanda_origem_id: demandaId,
      demanda_destino_id: values.demanda_destino_id,
      tipo_vinculo: values.tipo_vinculo,
      user_id: user.id,
    });
    toast.success("Vínculo criado");
    // ensure no stale navigation
    void navigate;
  };

  return (
    <ModalForm<VinculoFormValues>
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar vínculo"
      description="Conecte esta demanda a outra do sistema."
      schema={vinculoSchema}
      defaultValues={{
        tipo_vinculo: "relacionada",
        demanda_destino_id: "",
      }}
      onSubmit={handleSubmit}
      submitLabel="Adicionar"
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="tipo_vinculo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de vínculo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIPOS_VINCULO_VALUES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPOS_VINCULO_META[t].label}
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
            name="demanda_destino_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Demanda alvo</FormLabel>
                <DemandaCombobox
                  demandaAtualId={demandaId}
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ModalForm>
  );
}

function DemandaCombobox({
  demandaAtualId,
  value,
  onChange,
}: {
  demandaAtualId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { data: demandas = [], isLoading } =
    useDemandasParaVincular(demandaAtualId);

  const selecionada = demandas.find((d) => d.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selecionada ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs text-muted-foreground">
                {selecionada.codigo}
              </span>
              <span className="truncate">{selecionada.titulo}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {isLoading ? "Carregando…" : "Selecione uma demanda"}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            // itemValue is "{codigo} {titulo}" — case-insensitive contains match
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por código ou título…" />
          <CommandList>
            <CommandEmpty>Nenhuma demanda encontrada.</CommandEmpty>
            <CommandGroup>
              {demandas.map((d) => (
                <DemandaComboItem
                  key={d.id}
                  demanda={d}
                  selected={d.id === value}
                  onSelect={() => {
                    onChange(d.id);
                    setOpen(false);
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DemandaComboItem({
  demanda,
  selected,
  onSelect,
}: {
  demanda: DemandaVinculada;
  selected: boolean;
  onSelect: () => void;
}) {
  const value = `${demanda.codigo ?? ""} ${demanda.titulo}`;
  return (
    <CommandItem value={value} onSelect={onSelect} className="gap-2">
      <Check
        className={cn(
          "h-4 w-4",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="font-mono text-xs text-muted-foreground">
        {demanda.codigo}
      </span>
      <span className="flex-1 truncate">{demanda.titulo}</span>
    </CommandItem>
  );
}

// helper to silence unused import warning during render (not used in JSX above)
void Loader2;
