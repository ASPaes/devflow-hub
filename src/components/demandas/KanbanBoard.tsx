import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
import { useMoverStatusDemanda } from "@/hooks/useMoverStatusDemanda";
import { KanbanCard } from "@/components/demandas/KanbanCard";
import { IncluirReleaseDialog } from "@/components/demandas/IncluirReleaseDialog";

export type ColunaStatus =
  | "triagem"
  | "analise"
  | "desenvolvimento"
  | "teste"
  | "para_publicar"
  | "entregue";

const COLUNAS: { key: ColunaStatus; label: string; cor: string }[] = [
  { key: "triagem", label: "Triagem", cor: "var(--color-status-triagem)" },
  { key: "analise", label: "Análise", cor: "var(--color-status-analise)" },
  {
    key: "desenvolvimento",
    label: "Desenvolvimento",
    cor: "var(--color-status-desenvolvimento)",
  },
  { key: "teste", label: "Teste", cor: "var(--color-status-teste)" },
  {
    key: "para_publicar",
    label: "Para Publicar",
    cor: "var(--color-status-para_publicar)",
  },
  { key: "entregue", label: "Entregue", cor: "var(--color-status-entregue)" },
];

export const STATUS_NO_BOARD: StatusDemanda[] = [
  "triagem",
  "reaberta",
  "analise",
  "desenvolvimento",
  "teste",
  "para_publicar",
  "entregue",
];

interface KanbanBoardProps {
  rows: DemandaListaRow[];
  isLoading?: boolean;
  onCardClick?: (row: DemandaListaRow) => void;
}

function DraggableCard({
  row,
  podeMover,
  onCardClick,
}: {
  row: DemandaListaRow;
  podeMover: boolean;
  onCardClick?: (row: DemandaListaRow) => void;
}) {
  const id = row.id ?? row.codigo ?? "";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled: !podeMover,
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
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
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

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
        </div>
        <Badge variant="secondary" className="text-xs">
          {items.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          isOver && "border-2 border-dashed border-primary/60 bg-primary/5",
          items.length === 0 && !isLoading && "justify-center",
        )}
      >
        {isLoading ? (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Sem demandas
          </div>
        ) : (
          items.map((row) => (
            <DraggableCard
              key={row.id ?? row.codigo}
              row={row}
              podeMover={podeMover}
              onCardClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ rows, isLoading, onCardClick }: KanbanBoardProps) {
  const { temPermissao } = useProfile();
  const podeMover = temPermissao("editar_qualquer_demanda");
  const podeGerenciarReleases = temPermissao("gerenciar_releases");
  const mover = useMoverStatusDemanda();
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
      teste: [],
      para_publicar: [],
      entregue: [],
    };
    for (const d of rows) {
      const s = d.status;
      if (!s) continue;
      const coluna: ColunaStatus | null =
        s === "reaberta"
          ? "triagem"
          : s === "triagem" ||
              s === "analise" ||
              s === "desenvolvimento" ||
              s === "teste" ||
              s === "para_publicar" ||
              s === "entregue"
            ? s
            : null;
      if (coluna) mapa[coluna].push(d);
    }
    for (const k of Object.keys(mapa) as ColunaStatus[]) {
      mapa[k].sort((a, b) => {
        const pa = a.prioridade ?? 0;
        const pb = b.prioridade ?? 0;
        if (pa !== pb) return pb - pa;
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
    const demandaId = String(event.active.id);
    const novoStatus = event.over?.id as ColunaStatus | undefined;
    if (!novoStatus) return;

    const demanda = rows.find((r) => r.id === demandaId);
    if (!demanda || !demanda.status) return;

    // "reaberta" vive na coluna "triagem" — soltar lá não muda nada
    const colunaAtual: ColunaStatus | null =
      demanda.status === "reaberta" ? "triagem" : (demanda.status as ColunaStatus);
    if (colunaAtual === novoStatus) return;

    mover.mutate(
      {
        demandaId,
        novoStatus: novoStatus as StatusDemanda,
        statusAnterior: demanda.status,
      },
      {
        onSuccess: () => {
          if (
            novoStatus === "entregue" &&
            podeGerenciarReleases &&
            !demanda.incluir_release
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
    </DndContext>
  );
}
