import { cn } from "@/lib/utils";

interface TipoBadgeProps {
  codigo?: string | null;
  label?: string | null;
  icone?: string | null;
  cor?: string | null;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Badge dinâmico de tipo de demanda. Lê tipo_codigo/label/icone/cor da
 * view vw_demandas_lista. Faz fallback gracioso quando algum campo vier null
 * (demandas legadas sem tipo_id).
 */
export function TipoBadge({
  codigo,
  label,
  icone,
  cor,
  className,
  size = "md",
}: TipoBadgeProps) {
  const labelFinal = label ?? codigo ?? "Sem tipo";
  const iconeFinal = icone ?? "📌";
  const corFinal = cor ?? "#94A3B8";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className,
      )}
      style={{
        color: corFinal,
        borderColor: `${corFinal}40`,
        background: `${corFinal}15`,
      }}
    >
      <span aria-hidden>{iconeFinal}</span>
      <span>{labelFinal}</span>
    </span>
  );
}
