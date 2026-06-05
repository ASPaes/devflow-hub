import { cn } from "@/lib/utils";
import type { VersaoFiltro } from "@/types/demanda";

interface Props {
  value: VersaoFiltro;
  onChange: (v: VersaoFiltro) => void;
  className?: string;
}

const VERSOES: Array<{ valor: VersaoFiltro; label: string }> = [
  { valor: "atual", label: "Atual" },
  { valor: "proxima", label: "Próxima" },
  { valor: "futura", label: "Futura" },
  { valor: "todas", label: "Todas" },
];

export function VersaoSwitcher({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-input bg-muted/40 p-0.5",
        className,
      )}
    >
      {VERSOES.map((v) => (
        <button
          key={v.valor}
          type="button"
          onClick={() => onChange(v.valor)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs transition-colors",
            value === v.valor
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
