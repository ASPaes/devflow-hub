import * as React from "react";
import { cn } from "@/lib/utils";

interface ScrollableTableProps {
  /** Conteúdo (geralmente um <Table>) */
  children: React.ReactNode;
  className?: string;
  /** Mostra barra espelho no topo (default: true) */
  showTopScrollbar?: boolean;
  /** Habilita drag-to-scroll (default: true) */
  enableDrag?: boolean;
  /** Threshold em px pra ativar drag — abaixo disso, vira click normal (default: 5) */
  dragThreshold?: number;
}

export function ScrollableTable({
  children,
  className,
  showTopScrollbar = true,
  enableDrag = true,
  dragThreshold = 5,
}: ScrollableTableProps) {
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = React.useState(0);
  const [overflowing, setOverflowing] = React.useState(false);
  const isSyncingRef = React.useRef(false);

  // === Sincronizar largura do conteúdo no scrollbar de cima ===
  React.useLayoutEffect(() => {
    if (!innerRef.current || !bottomScrollRef.current) return;
    const measure = () => {
      if (!innerRef.current || !bottomScrollRef.current) return;
      const sw = innerRef.current.scrollWidth;
      const cw = bottomScrollRef.current.clientWidth;
      setContentWidth(sw);
      setOverflowing(sw > cw + 1);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(innerRef.current);
    if (bottomScrollRef.current) ro.observe(bottomScrollRef.current);
    measure();
    return () => ro.disconnect();
  }, [children]);

  // === Sincronizar scroll entre top e bottom ===
  const handleTopScroll = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };
  const handleBottomScroll = () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  // === Drag-to-scroll ===
  const dragStateRef = React.useRef({
    isDown: false,
    startX: 0,
    scrollLeftStart: 0,
    moved: false,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableDrag || !bottomScrollRef.current) return;
    if (e.button !== 0) return;
    // Não inicia drag se o usuário clicou em um input/textarea/select editável
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable='true']")) return;
    dragStateRef.current.isDown = true;
    dragStateRef.current.startX = e.pageX - bottomScrollRef.current.offsetLeft;
    dragStateRef.current.scrollLeftStart = bottomScrollRef.current.scrollLeft;
    dragStateRef.current.moved = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStateRef.current.isDown || !bottomScrollRef.current) return;
    const x = e.pageX - bottomScrollRef.current.offsetLeft;
    const walk = x - dragStateRef.current.startX;
    if (Math.abs(walk) > dragThreshold) {
      dragStateRef.current.moved = true;
      bottomScrollRef.current.style.cursor = "grabbing";
      bottomScrollRef.current.style.userSelect = "none";
    }
    if (dragStateRef.current.moved) {
      e.preventDefault();
      bottomScrollRef.current.scrollLeft =
        dragStateRef.current.scrollLeftStart - walk;
    }
  };

  const endDrag = () => {
    if (!bottomScrollRef.current) return;
    dragStateRef.current.isDown = false;
    bottomScrollRef.current.style.cursor = "";
    bottomScrollRef.current.style.userSelect = "";
  };

  // Drag prevalece sobre click — suprime o click se houve movimento
  const handleClickCapture = (e: React.MouseEvent) => {
    if (dragStateRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragStateRef.current.moved = false;
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Barra espelho no topo — só aparece se houver overflow */}
      {showTopScrollbar && overflowing && (
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="overflow-x-auto overflow-y-hidden"
          style={{ height: 12 }}
          aria-hidden="true"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}

      {/* Container com scroll real */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onClickCapture={handleClickCapture}
        className={cn(
          "overflow-x-auto",
          enableDrag && overflowing && "cursor-grab",
        )}
      >
        <div ref={innerRef} className="min-w-full w-max">
          {children}
        </div>
      </div>
    </div>
  );
}
