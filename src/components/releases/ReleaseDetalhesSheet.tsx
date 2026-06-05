import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2,
  MessageSquare,
  Image as ImageIcon,
  Mic,
  Video,
  Paperclip,
  User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRetornosReleasePublica } from "@/hooks/useReleases";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string | null;
  demandaCodigo: string | null;
  releaseTitulo: string | null;
}

const ICONE_MIDIA: Record<string, React.ReactNode> = {
  imagem: <ImageIcon className="h-3.5 w-3.5" />,
  audio: <Mic className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
};

export function ReleaseDetalhesSheet({
  open,
  onOpenChange,
  demandaId,
  demandaCodigo,
  releaseTitulo,
}: Props) {
  const { data: retornos = [], isLoading } = useRetornosReleasePublica(demandaId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {releaseTitulo ?? "Detalhes"}
          </SheetTitle>
          <SheetDescription>
            Histórico de retornos da demanda {demandaCodigo}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && retornos.length === 0 && (
            <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Esta demanda não tem retornos registrados.
            </div>
          )}

          {!isLoading &&
            retornos.map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">
                    {r.autor_nome ?? "Desconhecido"}
                  </span>
                  <span>•</span>
                  <span>
                    {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {r.texto && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {r.texto}
                  </p>
                )}

                {r.midia_tipo && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                    {ICONE_MIDIA[r.midia_tipo] ?? (
                      <Paperclip className="h-3.5 w-3.5" />
                    )}
                    <span className="capitalize">{r.midia_tipo}</span>
                    <span className="opacity-70">— disponível na demanda</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
