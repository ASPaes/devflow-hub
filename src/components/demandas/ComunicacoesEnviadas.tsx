import * as React from "react";
import {
  AlertCircle,
  ChevronDown,
  CornerDownLeft,
  Mail,
  MessageCircle,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useComunicacoesDemanda } from "@/hooks/useComunicacaoDemanda";
import { comunicacaoFalhou, contraparte, respostaSuspeita } from "@/types/comunicacao";
import type { ComunicacaoDemanda } from "@/types/comunicacao";

/**
 * A conversa com o cliente nesta demanda: o que a gente mandou e o que ele
 * respondeu por e-mail. Cada item abre para mostrar o texto integral — é isso
 * que resolve o "mas vocês me disseram outra coisa".
 */
export function ComunicacoesEnviadas({ demandaId }: { demandaId: string }) {
  const { data: mensagens = [], isLoading } = useComunicacoesDemanda(demandaId);

  if (isLoading || mensagens.length === 0) return null;

  const respostas = mensagens.filter((m) => m.direcao === "entrada").length;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {mensagens.length} mensagem{mensagens.length === 1 ? "" : "s"} trocada
        {mensagens.length === 1 ? "" : "s"} com o cliente
        {respostas > 0 && (
          <span className="text-foreground">
            {" "}
            · {respostas} resposta{respostas === 1 ? "" : "s"} dele
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {mensagens.map((m) => (
          <ItemComunicacao key={m.id} mensagem={m} />
        ))}
      </div>
    </div>
  );
}

function ItemComunicacao({ mensagem }: { mensagem: ComunicacaoDemanda }) {
  const [aberto, setAberto] = React.useState(false);

  const entrada = mensagem.direcao === "entrada";
  const falhou = comunicacaoFalhou(mensagem);
  const suspeita = respostaSuspeita(mensagem);
  const { nome, contato } = contraparte(mensagem);

  const data = new Date(mensagem.enviado_em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const Icone = entrada ? CornerDownLeft : mensagem.canal === "email" ? Mail : MessageCircle;

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        // A resposta do cliente é recuada e com fundo diferente: dá para ver de
        // que lado é a mensagem sem ler nada.
        entrada && "ml-6 border-l-2 border-l-primary bg-muted/40",
        !entrada && "bg-card",
        falhou && "border-destructive/40",
        suspeita && "border-amber-500/50",
        !falhou && !suspeita && !entrada && "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/40"
      >
        <Icone
          className={cn("h-4 w-4 shrink-0", entrada ? "text-primary" : "text-muted-foreground")}
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">
            {entrada && <span className="text-muted-foreground">Resposta · </span>}
            {mensagem.assunto || contato}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {entrada ? "de " : "para "}
            {nome ? `${nome} · ` : ""}
            {contato} · {data}
          </div>
        </div>

        {falhou && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            Falhou
          </span>
        )}

        {suspeita && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
            <ShieldAlert className="h-3.5 w-3.5" />
            Remetente não confere
          </span>
        )}

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
          {mensagem.canal === "email" && mensagem.assunto && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Assunto:</span> {mensagem.assunto}
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm text-foreground">{mensagem.corpo_texto}</p>

          {falhou && mensagem.erro_detalhe && (
            <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {mensagem.erro_detalhe}
            </p>
          )}

          {suspeita && (
            <p className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-500">
              Esta resposta chegou de um e-mail que não é o do solicitante nem de ninguém da
              empresa. Ela ficou registrada aqui, mas não virou comentário na demanda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
