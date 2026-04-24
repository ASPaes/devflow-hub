import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useComentarios } from "@/hooks/useComentarios";

import { ComentarioItem } from "./ComentarioItem";
import { EmptyComentarios } from "./EmptyComentarios";
import { NovoComentarioForm } from "./NovoComentarioForm";

interface Props {
  demandaId: string;
}

export function ComentariosSecao({ demandaId }: Props) {
  const { data: comentarios = [], isLoading } = useComentarios(demandaId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comentários{!isLoading && ` (${comentarios.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <ComentariosSkeleton />
        ) : comentarios.length === 0 ? (
          <EmptyComentarios />
        ) : (
          <div className="space-y-6">
            {comentarios.map((c) => (
              <ComentarioItem key={c.id} comentario={c} />
            ))}
          </div>
        )}

        <Separator />

        <NovoComentarioForm demandaId={demandaId} />
      </CardContent>
    </Card>
  );
}

function ComentariosSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
