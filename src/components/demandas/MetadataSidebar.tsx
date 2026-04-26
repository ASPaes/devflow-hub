import * as React from "react";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Clock,
  Folder,
  Layers,
  MapPin,
  User,
  UserX,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { formatDateTimeSP } from "@/lib/format";
import {
  PRIORIDADE_LABEL_CURTA,
  PROXIMOS_STATUS,
  STATUS_DEMANDA_LABEL,
  TRANSICAO_LABEL,
  type DemandaCompleta,
  type StatusDemanda,
  type UpdateDemandaPatch,
} from "@/hooks/useDemandas";
import { useUsuariosComPermissao } from "@/hooks/useUsuarios";
import { useModulos } from "@/hooks/useModulos";
import { useSubmodulos } from "@/hooks/useSubmodulos";
import { useAreas } from "@/hooks/useAreas";

const PRIORIDADES = [1, 2, 3, 4, 5] as const;

interface MetadataSidebarProps {
  demanda: DemandaCompleta;
  canEdit: boolean;
  canChangeStatus: boolean;
  onPatch: (patch: UpdateDemandaPatch) => Promise<void>;
  saving: boolean;
}

export function MetadataSidebar({
  demanda,
  canEdit,
  canChangeStatus,
  onPatch,
  saving,
}: MetadataSidebarProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      {/* Status */}
      <section className="rounded-lg border border-border bg-card p-4">
        <Label>Status</Label>
        <div className="mt-2 flex items-center justify-between gap-2">
          <StatusBadge status={demanda.status} />
          {canChangeStatus && (
            <StatusDropdown
              current={demanda.status}
              disabled={saving}
              onChange={(s) => onPatch({ status: s })}
            />
          )}
        </div>
      </section>

      {/* Desenvolvedor */}
      <section className="rounded-lg border border-border bg-card p-4">
        <Label>Desenvolvedor</Label>
        <div className="mt-2">
          <ResponsavelPicker
            current={demanda.responsavel}
            disabled={!canEdit || saving}
            onChange={(id) => onPatch({ responsavel_id: id })}
          />
        </div>
      </section>

      {/* Prioridade */}
      <section className="rounded-lg border border-border bg-card p-4">
        <Label>Prioridade</Label>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {PRIORIDADES.map((p) => {
            const selected = demanda.prioridade === p;
            return (
              <button
                key={p}
                type="button"
                disabled={!canEdit || saving}
                onClick={() => void onPatch({ prioridade: p })}
                title={PRIORIDADE_LABEL_CURTA[p]}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md border-2 text-sm font-semibold transition-all",
                  "border-input bg-card hover:border-muted-foreground/50",
                  selected && "border-current shadow-sm",
                  (!canEdit || saving) &&
                    "cursor-not-allowed opacity-60 hover:border-input",
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
                {p}
              </button>
            );
          })}
        </div>
      </section>

      {/* Deadline */}
      <section className="rounded-lg border border-border bg-card p-4">
        <Label>
          <Calendar className="mr-1 inline h-3.5 w-3.5" />
          Prazo
        </Label>
        <div className="mt-2">
          <DeadlinePicker
            value={demanda.deadline}
            disabled={!canEdit || saving}
            onChange={(v) => onPatch({ deadline: v })}
          />
        </div>
      </section>

      {/* Estimativa */}
      <section className="rounded-lg border border-border bg-card p-4">
        <Label>
          <Clock className="mr-1 inline h-3.5 w-3.5" />
          Estimativa
        </Label>
        <div className="mt-2">
          <EstimativaInput
            value={demanda.estimativa_horas}
            disabled={!canEdit || saving}
            onChange={(v) => onPatch({ estimativa_horas: v })}
          />
        </div>
      </section>

      {/* Classificação */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
        <Label>Classificação</Label>
        <ClassificacaoEditor
          demanda={demanda}
          canEdit={canEdit}
          saving={saving}
          onPatch={onPatch}
        />
      </section>

      {/* Datas */}
      <section className="space-y-1.5 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <DateRow label="Criada" value={formatDateTimeSP(demanda.created_at)} />
        <DateRow
          label="Atualizada"
          value={formatDateTimeSP(demanda.updated_at)}
        />
        {demanda.delivered_at && (
          <DateRow
            label="Entregue"
            value={formatDateTimeSP(demanda.delivered_at)}
          />
        )}
        {demanda.reopen_deadline && (
          <DateRow
            label="Encerramento auto"
            value={formatDateTimeSP(demanda.reopen_deadline)}
          />
        )}
        {demanda.closed_at && (
          <DateRow
            label="Encerrada"
            value={formatDateTimeSP(demanda.closed_at)}
          />
        )}
      </section>
    </aside>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

export const STATUS_BADGE_STYLES: Record<StatusDemanda, string> = {
  triagem:
    "bg-status-triagem/15 text-status-triagem border-status-triagem/30",
  analise:
    "bg-status-analise/15 text-status-analise border-status-analise/30",
  desenvolvimento:
    "bg-status-desenvolvimento/15 text-status-desenvolvimento border-status-desenvolvimento/30",
  teste: "bg-status-teste/15 text-status-teste border-status-teste/30",
  entregue:
    "bg-status-entregue/15 text-status-entregue border-status-entregue/30",
  reaberta:
    "bg-status-reaberta/15 text-status-reaberta border-status-reaberta/30",
  encerrada:
    "bg-status-encerrada/15 text-status-encerrada border-status-encerrada/30",
  cancelada:
    "bg-status-cancelada/15 text-status-cancelada border-status-cancelada/30",
};

export const PRIORIDADE_BADGE_STYLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-prioridade-1/15 text-prioridade-1 border-prioridade-1/30",
  2: "bg-prioridade-2/15 text-prioridade-2 border-prioridade-2/30",
  3: "bg-prioridade-3/15 text-prioridade-3 border-prioridade-3/30",
  4: "bg-prioridade-4/15 text-prioridade-4 border-prioridade-4/30",
  5: "bg-prioridade-5/15 text-prioridade-5 border-prioridade-5/30",
};

export function StatusBadge({ status }: { status: StatusDemanda }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium ${STATUS_BADGE_STYLES[status]}`}
    >
      {STATUS_DEMANDA_LABEL[status]}
    </span>
  );
}

interface StatusDropdownProps {
  current: StatusDemanda;
  disabled: boolean;
  onChange: (s: StatusDemanda) => void;
}

function StatusDropdown({ current, disabled, onChange }: StatusDropdownProps) {
  const next = PROXIMOS_STATUS[current];
  if (next.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          Mover
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {next.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
            {TRANSICAO_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ResponsavelPickerProps {
  current: DemandaCompleta["responsavel"];
  disabled: boolean;
  onChange: (id: string | null) => void;
}

function ResponsavelPicker({
  current,
  disabled,
  onChange,
}: ResponsavelPickerProps) {
  const [open, setOpen] = React.useState(false);
  const { data: users = [], isLoading } = useUsuariosComPermissao(
    "pode_ser_responsavel",
  );

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-left text-sm transition-colors",
        !disabled && "hover:bg-secondary/40",
        disabled && "cursor-not-allowed opacity-70",
      )}
    >
      {current ? (
        <>
          <Avatar className="h-6 w-6">
            {current.avatar_url && (
              <AvatarImage src={current.avatar_url} alt="" />
            )}
            <AvatarFallback className="bg-primary/20 text-[10px] font-medium text-primary">
              {initials(current.nome)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{current.nome}</span>
        </>
      ) : (
        <>
          <UserX className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Sem desenvolvedor</span>
        </>
      )}
    </button>
  );

  if (disabled) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/60"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          <UserX className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Sem responsável</span>
        </button>
        <div className="my-1 h-px bg-border" />
        {isLoading ? (
          <div className="space-y-1 p-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nenhum usuário disponível para ser responsável.
          </p>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary/60"
              onClick={() => {
                onChange(u.id);
                setOpen(false);
              }}
            >
              <Avatar className="h-6 w-6">
                {u.avatar_url && <AvatarImage src={u.avatar_url} alt="" />}
                <AvatarFallback className="bg-primary/20 text-[10px] font-medium text-primary">
                  {initials(u.nome)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{u.nome}</span>
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

interface DeadlinePickerProps {
  value: string | null;
  disabled: boolean;
  onChange: (v: string | null) => void;
}

function DeadlinePicker({ value, disabled, onChange }: DeadlinePickerProps) {
  const [draft, setDraft] = React.useState(value ?? "");
  React.useEffect(() => setDraft(value ?? ""), [value]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = value && value < today;

  const commit = () => {
    const next = draft || null;
    if (next === value) return;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className={cn(
          "h-8 text-sm",
          overdue && "border-destructive text-destructive",
        )}
      />
      {overdue && (
        <span title="Prazo vencido">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </span>
      )}
      {value && !disabled && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onClick={() => {
            setDraft("");
            onChange(null);
          }}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}

interface EstimativaInputProps {
  value: number | null;
  disabled: boolean;
  onChange: (v: number | null) => void;
}

function EstimativaInput({ value, disabled, onChange }: EstimativaInputProps) {
  const [draft, setDraft] = React.useState(value != null ? String(value) : "");
  React.useEffect(
    () => setDraft(value != null ? String(value) : ""),
    [value],
  );

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next != null && (Number.isNaN(next) || next < 0)) return;
    if (next === value) return;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.5"
        min="0"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="h-8 text-sm"
        placeholder="0"
      />
      <span className="text-sm text-muted-foreground">h</span>
    </div>
  );
}

function ClassRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="text-xs text-muted-foreground">{label}:</span>
      {color && (
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      <span className="ml-auto truncate text-foreground">{value}</span>
    </div>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

interface SolicitanteSummaryProps {
  solicitante: DemandaCompleta["solicitante"];
}

export function SolicitanteSummary({ solicitante }: SolicitanteSummaryProps) {
  if (!solicitante) return <span>solicitante desconhecido</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar className="h-5 w-5">
        {solicitante.avatar_url && (
          <AvatarImage src={solicitante.avatar_url} alt="" />
        )}
        <AvatarFallback className="bg-primary/20 text-[9px] font-medium text-primary">
          {initials(solicitante.nome)}
        </AvatarFallback>
      </Avatar>
      <span>{solicitante.nome}</span>
    </span>
  );
}

export function TipoBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="font-normal">
      {children}
    </Badge>
  );
}
