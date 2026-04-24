import * as React from "react";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCreateComentario } from "@/hooks/useComentarios";
import { initials } from "@/lib/utils";

const MAX_LEN = 5000;

interface Props {
  demandaId: string;
}

export function NovoComentarioForm({ demandaId }: Props) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const createMutation = useCreateComentario();
  const [texto, setTexto] = React.useState("");

  const submitting = createMutation.isPending;
  const trimmed = texto.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LEN && !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    try {
      await createMutation.mutateAsync({
        demanda_id: demandaId,
        conteudo: trimmed,
        user_id: user.id,
      });
      setTexto("");
    } catch {
      // toast já tratado no hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const nome = profile?.nome ?? user?.email ?? "?";
  const avatarUrl = profile?.avatar_url ?? undefined;

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <Avatar className="h-9 w-9 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={nome} />}
        <AvatarFallback className="bg-primary/20 text-xs font-medium text-primary">
          {initials(nome)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <Textarea
          placeholder="Adicione um comentário..."
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LEN}
          disabled={submitting}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {texto.length > 0 ? `${texto.length}/${MAX_LEN}` : ""}
          </span>
          <Button type="submit" disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Comentar
          </Button>
        </div>
      </div>
    </form>
  );
}
