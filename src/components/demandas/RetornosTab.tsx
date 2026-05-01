import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  useExcluirRetorno,
  useRetornosDemanda,
} from "@/hooks/useRetornosDemanda";
import { useProfile } from "@/hooks/useProfile";
import { CriarRetornoForm } from "./CriarRetornoForm";
import { RetornoMidiaPlayer } from "./RetornoMidiaPlayer";
import { EditarRetornoDialog } from "./EditarRetornoDialog";
import type { DemandaRetornoComAutor } from "@/types/retorno";

export function RetornosTab({ demandaId }: { demandaId: string }) {
  const { temPermissao } = useProfile();
  const podeCriar = temPermissao("criar_retorno_demanda");
  const { data: retornos = [], isLoading } = useRetornosDemanda(demandaId);
  const [editando, setEditando] = React.useState<DemandaRetornoComAutor | null>(
    null,
  );

  return (
    <div className="space-y-6">
      {podeCriar && <CriarRetornoForm demandaId={demandaId} />}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            {retornos.length === 0
              ? "Sem retornos ainda"
              : `${retornos.length} retorno${retornos.length === 1 ? "" : "s"}`}
          </h3>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : retornos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum retorno publicado ainda.
            </p>
            {podeCriar && (
              <p className="mt-1 text-xs text-muted-foreground">
                Use o formulário acima para publicar.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {retornos.map((r) => (
              <RetornoCard
                key={r.id}
                retorno={r}
                demandaId={demandaId}
                podeEditar={podeCriar}
                onEdit={() => setEditando(r)}
              />
            ))}
          </div>
        )}
      </div>

      {editando && (
        <EditarRetornoDialog
          open={!!editando}
          onOpenChange={(o) => !o && setEditando(null)}
          retorno={editando}
        />
      )}
    </div>
  );
}

function RetornoCard({
  retorno,
  demandaId,
  podeEditar,
  onEdit,
}: {
  retorno: DemandaRetornoComAutor;
  demandaId: string;
  podeEditar: boolean;
  onEdit: () => void;
}) {
  const excluir = useExcluirRetorno();

  const handleExcluir = () => {
    if (
      !confirm(
        "Excluir este retorno? Mídia anexada também será apagada.",
      )
    )
      return;
    excluir.mutate({ retornoId: retorno.id, demandaId });
  };

  const dataFormatada = new Date(retorno.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={retorno.autor_avatar ?? undefined} />
            <AvatarFallback className="text-xs">
              {(retorno.autor_nome ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {retorno.autor_nome ?? "Desconhecido"}
            </div>
            <div className="text-xs text-muted-foreground">{dataFormatada}</div>
          </div>
        </div>
        {podeEditar && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              title="Editar texto"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleExcluir}
              disabled={excluir.isPending}
              title="Excluir retorno"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {retorno.midia_url && retorno.midia_tipo && (
        <RetornoMidiaPlayer
          path={retorno.midia_url}
          tipo={retorno.midia_tipo}
          nome={retorno.midia_nome_original}
        />
      )}

      {retorno.texto && (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {retorno.texto}
        </p>
      )}
    </div>
  );
}
