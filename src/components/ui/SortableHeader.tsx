import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColunaOrdenavel, SortConfig } from "@/hooks/useDemandas";

interface SortableHeaderProps {
  label: string;
  campo: ColunaOrdenavel;
  sort: SortConfig | undefined;
  onSortChange: (next: SortConfig | undefined) => void;
  className?: string;
}

export function SortableHeader({
  label,
  campo,
  sort,
  onSortChange,
  className,
}: SortableHeaderProps) {
  const isAtivo = sort?.campo === campo;
  const direcao = isAtivo ? sort?.direcao : null;

  const handleClick = () => {
    if (!isAtivo) {
      onSortChange({ campo, direcao: "asc" });
    } else if (direcao === "asc") {
      onSortChange({ campo, direcao: "desc" });
    } else {
      onSortChange(undefined);
    }
  };

  return (
    <th className={cn("px-4 py-2.5 font-medium", className)}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
          isAtivo ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        {!isAtivo && <ArrowUpDown className="h-3 w-3 opacity-50" />}
        {direcao === "asc" && <ArrowUp className="h-3 w-3" />}
        {direcao === "desc" && <ArrowDown className="h-3 w-3" />}
      </button>
    </th>
  );
}
