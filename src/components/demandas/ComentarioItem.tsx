import * as React from "react";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  useDeleteComentario,
  useUpdateComentario,
  type Comentario,
} from "@/hooks/useComentarios";
import { formatRelativeSP } from "@/lib/format";
import { initials } from "@/lib/utils";

const MAX_LEN = 5000;

interface Props {
  comentario: Comentario;
}

export function ComentarioItem({ comentario }: Props) {
  const { user } = useAuth();
  const { temPermissao } = useProfile();
  const updateMutation = useUpdateComentario();
  const deleteMutation = useDeleteComentario();

  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(comentario.conteudo);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const isAuthor = user?.id === comentario.autor_id;
  const isAdmin = temPermissao("editar_qualquer_demanda");
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;
  const showMenu = canEdit || canDelete;

  const startEdit = () => {
    setDraft(comentario.conteudo);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(comentario.conteudo);
    setEditing(false);
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comentario.conteudo) {
      setEditing(false);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: comentario.id,
        conteudo: trimmed,
      });
      setEditing(false);
    } catch {
      // toast tratado
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void saveEdit();
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({
      id: comentario.id,
      demanda_id: comentario.demanda_id,
    });
  };

  const nome = comentario.autor?.nome ?? "Usuário";
  const avatarUrl = comentario.autor?.avatar_url ?? undefined;
  const saving = updateMutation.isPending;

  return (
    <div className="flex gap-3">
      <Avatar className="h-9 w-9 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={nome} />}
        <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
          {initials(nome)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{nome}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeSP(comentario.created_at)}
          </span>
          {showMenu && (
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onSelect={() => startEdit()}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      onSelect={() => setConfirmOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              maxLength={MAX_LEN}
              disabled={saving}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void saveEdit()}
                disabled={saving || !draft.trim()}
              >
                {saving && (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                )}
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {comentario.conteudo}
            </p>
            {comentario.edited_at && (
              <p className="text-xs text-muted-foreground">
                (editado {formatRelativeSP(comentario.edited_at)})
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir comentário?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
