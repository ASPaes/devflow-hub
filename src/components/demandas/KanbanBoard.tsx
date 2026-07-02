import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  STATUS_DEMANDA_LABEL,
  type DemandaListaRow,
  type StatusDemanda,
} from "@/hooks/useDemandas";
import { useProfile } from "@/hooks/useProfile";
import { useReposicionarDemanda } from "@/hooks/useReposicionarDemanda";
import { KanbanCard } from "@/components/demandas/KanbanCard";
import { IncluirReleaseDialog } from "@/components/demandas/IncluirReleaseDialog";
import { useNavigate } from "@tanstack/react-router";

export type ColunaStatus =
  | "triagem"
  | "aprovado"
  | "nao_aprovado"
  | "analise"
  | "para_desenvolver"
  | "duvidas_dev"
  | "aguardando_cliente"
  | "desenvolvimento"
  | "teste"
  | "para_publicar"
  | "entregue";

const COLUNAS: { key: ColunaStatus; label: string; cor: string }[] = [
  { key: "triagem", label: STATUS_DEMANDA_LABEL.triagem, cor: "var(--color-status-triagem)" },
  { key: "aprovado", label: STATUS_DEMANDA_LABEL.aprovado, cor: "var(--color-status-aprovado)" },
  { key: "nao_aprovado", label: STATUS_DEMANDA_LABEL.nao_aprovado, cor: "var(--color-status-nao_aprovado)" },
  { key: "analise", label: STATUS_DEMANDA_LABEL.analise, cor: "var(--color-status-analise)" },
  { key: "para_desenvolver", label: STATUS_DEMANDA_LABEL.para_desenvolver, cor: "var(--color-status-para_desenvolver)" },
  { key: "duvidas_dev", label: STATUS_DEMANDA_LABEL.duvidas_dev, cor: "var(--color-status-duvidas_dev)" },
  { key: "aguardando_cliente", label: STATUS_DEMANDA_LABEL.aguardando_cliente, cor: "var(--color-status-aguardando_cliente)" },
  { key: "desenvolvimento", label: STATUS_DEMANDA_LABEL.desenvolvimento, cor: "var(--color-status-desenvolvimento)" },
  { key: "teste", label: STATUS_DEMANDA_LABEL.teste, cor: "var(--color-status-teste)" },
  { key: "para_publicar", label: STATUS_DEMANDA_LABEL.para_publicar, cor: "var(--color-status-para_publicar)" },
  { key: "entregue", label: STATUS_DEMANDA_LABEL.entregue, cor: "var(--color-status-entregue)" },
];

export const STATUS_NO_BOARD: StatusDemanda[] = [
  "triagem",
  "reaberta",
  "aprovado",
  "nao_aprovado",
  "analise",
  "para_desenvolver",
  "duvidas_dev",
  "aguardando_cliente",
  "desenvolvimento",
  "teste",
  "para_publicar",
  "entregue",
];


const POSICAO_STEP = 1000;

interface KanbanBoardProps {
  rows: DemandaListaRow[];
  isLoading?: boolean;
  onCardClick?: (row: DemandaListaRow) => void;
}

function SortableCard({
  row,
  podeMover,
  onCardClick,
}: {
  row: DemandaListaRow;
  podeMover: boolean;
  onCardClick?: (row: DemandaListaRow) => void;
}) {
  const id = row.id ?? row.codigo ?? "";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !podeMover,
    data: { type: "card", row },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: podeMover ? (isDragging ? "grabbing" : "grab") : "pointer",
    touchAction: podeMover ? "none" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-kanban-card="true"
      {...listeners}
      {...attributes}
    >
      <KanbanCard row={row} onClick={onCardClick} />
    </div>
  );
}

function isHoje(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function ColunaDroppable({
  col,
  items,
  isLoading,
  podeMover,
  onCardClick,
}: {
  col: (typeof COLUNAS)[number];
  items: DemandaListaRow[];
  isLoading?: boolean;
  podeMover: boolean;
  onCardClick?: (row: DemandaListaRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.key,
    data: { type: "coluna", coluna: col.key },
  });
  const [mostrarTodosEntregues, setMostrarTodosEntregues] =
    React.useState(false);

  const isEntregue = col.key === "entregue";
  const itemsExibidos = React.useMemo(() => {
    if (!isEntregue || mostrarTodosEntregues) return items;
    return items.filter((r) => isHoje(r.delivered_at));
  }, [isEntregue, mostrarTodosEntregues, items]);

  const sortableIds = React.useMemo(
    () => itemsExibidos.map((r) => r.id ?? r.codigo ?? ""),
    [itemsExibidos],
  );

  return (
    <div className="flex max-h-[calc(100vh-260px)] w-80 flex-shrink-0 flex-col rounded-lg border border-border bg-secondary/20">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: col.cor }}
            aria-hidden
          />
          <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
          {col.key === "triagem" && (
            <span
              className="text-[10px] text-muted-foreground"
              title={`Inclui ${STATUS_DEMANDA_LABEL.reaberta}`}
            >
              + reaberta
            </span>
          )}
          {isEntregue && (
            <button
              type="button"
              onClick={() => setMostrarTodosEntregues((v) => !v)}
              className="rounded border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={
                mostrarTodosEntregues
                  ? "Mostrando todos os entregues"
                  : "Mostrando apenas os entregues hoje"
              }
            >
              {mostrarTodosEntregues ? "Todos" : "Hoje"}
            </button>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {itemsExibidos.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          isOver && "border-2 border-dashed border-primary/60 bg-primary/5",
          itemsExibidos.length === 0 && !isLoading && "justify-center",
        )}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {isLoading ? (
            <>
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </>
          ) : itemsExibidos.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {isEntregue && !mostrarTodosEntregues
                ? "Nenhuma demanda entregue hoje"
                : "Sem demandas"}
            </div>
          ) : (
            itemsExibidos.map((row) => (
              <SortableCard
                key={row.id ?? row.codigo}
                row={row}
                podeMover={podeMover}
                onCardClick={onCardClick}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function statusToColuna(s: StatusDemanda): ColunaStatus | null {
  if (s === "reaberta") return "triagem";
  if (
    s === "triagem" ||
    s === "analise" ||
    s === "desenvolvimento" ||
    s === "aguardando_cliente" ||
    s === "teste" ||
    s === "para_publicar" ||
    s === "entregue"
  ) {
    return s;
  }
  return null;
}

export function KanbanBoard({ rows, isLoading, onCardClick }: KanbanBoardProps) {
  const { temPermissao } = useProfile();
  const podeMover = temPermissao("editar_qualquer_demanda");
  const podeGerenciarReleases = temPermissao("gerenciar_releases");
  const reposicionar = useReposicionarDemanda();
  const navigate = useNavigate();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [releaseDialog, setReleaseDialog] = React.useState<
    { id: string; codigo: string; titulo: string; tipo: string } | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // === Drag-to-scroll horizontal no board (ignora cliques em cards) ===
  const boardRef = React.useRef<HTMLDivElement>(null);
  const dragScrollRef = React.useRef({
    isDown: false,
    startX: 0,
    scrollLeftStart: 0,
    moved: false,
  });

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-kanban-card]")) return;
    if (!boardRef.current) return;
    dragScrollRef.current.isDown = true;
    dragScrollRef.current.startX = e.pageX - boardRef.current.offsetLeft;
    dragScrollRef.current.scrollLeftStart = boardRef.current.scrollLeft;
    dragScrollRef.current.moved = false;
  };

  const handleBoardMouseMove = (e: React.MouseEvent) => {
    if (!dragScrollRef.current.isDown || !boardRef.current) return;
    const x = e.pageX - boardRef.current.offsetLeft;
    const walk = x - dragScrollRef.current.startX;
    if (Math.abs(walk) > 5) {
      dragScrollRef.current.moved = true;
      boardRef.current.style.cursor = "grabbing";
      boardRef.current.style.userSelect = "none";
    }
    if (dragScrollRef.current.moved) {
      e.preventDefault();
      boardRef.current.scrollLeft =
        dragScrollRef.current.scrollLeftStart - walk;
    }
  };

  const endBoardDrag = () => {
    if (!boardRef.current) return;
    dragScrollRef.current.isDown = false;
    boardRef.current.style.cursor = "";
    boardRef.current.style.userSelect = "";
    requestAnimationFrame(() => {
      dragScrollRef.current.moved = false;
    });
  };

  const porColuna = React.useMemo(() => {
    const mapa: Record<ColunaStatus, DemandaListaRow[]> = {
      triagem: [],
      analise: [],
      desenvolvimento: [],
      aguardando_cliente: [],
      teste: [],
      para_publicar: [],
      entregue: [],
    };
    for (const d of rows) {
      if (!d.status) continue;
      const coluna = statusToColuna(d.status);
      if (coluna) mapa[coluna].push(d);
    }
    for (const k of Object.keys(mapa) as ColunaStatus[]) {
      mapa[k].sort((a, b) => {
        const pa = a.posicao;
        const pb = b.posicao;
        if (pa != null && pb != null) return pa - pb;
        if (pa != null) return -1;
        if (pb != null) return 1;
        // Fallback: legado sem posição
        const ra = a.prioridade ?? 0;
        const rb = b.prioridade ?? 0;
        if (ra !== rb) return rb - ra;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    }
    return mapa;
  }, [rows]);

  const activeRow = React.useMemo(
    () => (activeId ? rows.find((r) => r.id === activeId) ?? null : null),
    [activeId, rows],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const demandaId = String(active.id);
    const demanda = rows.find((r) => r.id === demandaId);
    if (!demanda || !demanda.status) return;

    const colunaAtual = statusToColuna(demanda.status);
    if (!colunaAtual) return;

    // Detecta coluna alvo: over pode ser coluna ou outro card
    const overData = over.data.current as
      | { type?: string; coluna?: ColunaStatus; row?: DemandaListaRow }
      | undefined;

    let colunaAlvo: ColunaStatus | null = null;
    let indexAlvo = -1;

    if (overData?.type === "coluna" && overData.coluna) {
      colunaAlvo = overData.coluna;
      indexAlvo = porColuna[colunaAlvo].length; // final da coluna
    } else if (overData?.type === "card" && overData.row?.status) {
      colunaAlvo = statusToColuna(overData.row.status);
      if (colunaAlvo) {
        const lista = porColuna[colunaAlvo];
        indexAlvo = lista.findIndex((r) => r.id === over.id);
        if (indexAlvo === -1) indexAlvo = lista.length;
      }
    }

    if (!colunaAlvo) return;

    // Calcula nova posição
    const listaAlvo = porColuna[colunaAlvo].filter((r) => r.id !== demandaId);
    const idxClamp = Math.max(0, Math.min(indexAlvo, listaAlvo.length));
    const anterior = idxClamp > 0 ? listaAlvo[idxClamp - 1] : null;
    const posterior =
      idxClamp < listaAlvo.length ? listaAlvo[idxClamp] : null;

    let novaPosicao: number;
    const pa = anterior?.posicao ?? null;
    const pp = posterior?.posicao ?? null;
    if (pa != null && pp != null) {
      novaPosicao = (pa + pp) / 2;
    } else if (pa != null) {
      novaPosicao = pa + POSICAO_STEP;
    } else if (pp != null) {
      novaPosicao = pp - POSICAO_STEP;
    } else {
      novaPosicao = POSICAO_STEP;
    }

    const mudouColuna = colunaAtual !== colunaAlvo;
    const mesmaPosicao =
      !mudouColuna && demanda.posicao != null && demanda.posicao === novaPosicao;
    if (mesmaPosicao) return;

    const novoStatus: StatusDemanda = mudouColuna
      ? (colunaAlvo as StatusDemanda)
      : demanda.status;

    reposicionar.mutate(
      {
        demandaId,
        novoStatus,
        statusAnterior: demanda.status,
        novaPosicao,
      },
      {
        onSuccess: () => {
          if (
            mudouColuna &&
            colunaAlvo === "entregue" &&
            podeGerenciarReleases
          ) {
            setReleaseDialog({
              id: demandaId,
              codigo: demanda.codigo ?? "",
              titulo: demanda.titulo ?? "",
              tipo: demanda.tipo ?? "tarefa",
            });
          }
        },
      },
    );
  };

  const handleDragCancel = () => setActiveId(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={boardRef}
        className="flex cursor-grab gap-4 overflow-x-auto pb-4"
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={endBoardDrag}
        onMouseLeave={endBoardDrag}
      >
        {COLUNAS.map((col) => (
          <ColunaDroppable
            key={col.key}
            col={col}
            items={porColuna[col.key]}
            isLoading={isLoading}
            podeMover={podeMover}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeRow ? (
          <div
            className="rotate-2 cursor-grabbing opacity-95 shadow-2xl"
            style={{ width: 304 }}
          >
            <KanbanCard row={activeRow} />
          </div>
        ) : null}
      </DragOverlay>

      <IncluirReleaseDialog
        open={!!releaseDialog}
        onOpenChange={(o) => !o && setReleaseDialog(null)}
        demanda={releaseDialog}
        onConcluido={({ tituloIA, resumoIA }) => {
          const codigo = releaseDialog?.codigo;
          console.log("[ReleaseFlow] 5. navegando pra aba Releases", {
            codigo,
            tituloIA,
            resumoIA,
          });
          if (!codigo) return;
          void navigate({
            to: "/demandas/$codigo",
            params: { codigo },
            search: { tab: "releases", tituloIA, resumoIA },
          });
        }}
      />
    </DndContext>
  );
}
