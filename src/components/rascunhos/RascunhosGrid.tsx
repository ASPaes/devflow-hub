import { Pin } from "lucide-react";
import { useRascunhos } from "@/hooks/useRascunhos";
import { RascunhoCard } from "./RascunhoCard";
import type { RascunhoComItens } from "@/types/rascunho";

type Filtro = "meus" | "compartilhados" | "todos" | "lixeira";

export function RascunhosGrid({ filtro = "todos" }: { filtro?: Filtro }) {
  const { data: rascunhos = [], isLoading } = useRascunhos(filtro);
  const naLixeira = filtro === "lixeira";

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  if (rascunhos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
        {naLixeira
          ? "A Lixeira está vazia."
          : "Nenhum rascunho ainda. Crie um acima."}
      </div>
    );
  }

  if (naLixeira) {
    return (
      <Secao
        titulo="Itens na Lixeira"
        icon={null}
        itens={rascunhos}
        naLixeira
      />
    );
  }

  const fixadas = rascunhos.filter((r) => r.fixada);
  const outras = rascunhos.filter((r) => !r.fixada);

  return (
    <div className="space-y-6">
      {fixadas.length > 0 && (
        <Secao titulo="Fixados" icon={<Pin className="h-3 w-3" />} itens={fixadas} />
      )}
      {outras.length > 0 && (
        <Secao
          titulo={fixadas.length > 0 ? "Outros" : undefined}
          itens={outras}
        />
      )}
    </div>
  );
}

function Secao({
  titulo,
  icon,
  itens,
  naLixeira,
}: {
  titulo?: string;
  icon?: React.ReactNode;
  itens: RascunhoComItens[];
  naLixeira?: boolean;
}) {
  return (
    <div className="space-y-2">
      {titulo && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {icon}
          {titulo}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {itens.map((r) => (
          <RascunhoCard key={r.id} rascunho={r} naLixeira={naLixeira} />
        ))}
      </div>
    </div>
  );
}
