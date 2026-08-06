import * as React from "react";
import { AlertCircle, ChevronDown, Mail, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useComunicacoesDemanda } from "@/hooks/useComunicacaoDemanda";
import { formatarTelefoneBR } from "@/types/comunicacao";
import type { ComunicacaoEnviada } from "@/types/comunicacao";

/**
 * Histórico do que já foi comunicado ao cliente nesta demanda.
 * Cada item abre para mostrar o texto integral que foi enviado — é isso que
 * resolve o "mas vocês me disseram outra coisa".
 */
export function ComunicacoesEnviadas({ demandaId }: { demandaId: string }) {
  const { data: envios = [], isLoading } = useComunicacoesDemanda(demandaId);

  if (isLoading || envios.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        {envios.length} comunicação{envios.length === 1 ? "" : "ões"} enviada
        {envios.length === 1 ? "" : "s"} ao cliente
      </h3>
      <div className="space-y-2">
        {envios.map((e) => (
          <ItemComunicacao key={e.id} envio={e} />
        ))}
      </div>
    </div>
  );
}

function ItemComunicacao({ envio }: { envio: ComunicacaoEnviada }) {
  const [aberto, setAberto] = React.useState(false);
  const falhou = envio.status !== "enviado";

  const destinatario =
    envio.canal === "email"
      ? envio.email_destinatario
      : formatarTelefoneBR(envio.telefone_destinatario);

  const data = new Date(envio.enviado_em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        falhou ? "border-destructive/40" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/40"
      >
        {envio.canal === "email" ? (
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{envio.assunto || destinatario}</div>
          <div className="truncate text-xs text-muted-foreground">
            {envio.nome_destinatario ? `${envio.nome_destinatario} · ` : ""}
            {destinatario} · {data}
          </div>
        </div>

        {falhou && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            Falhou
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
          {envio.canal === "email" && envio.assunto && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Assunto:</span> {envio.assunto}
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm text-foreground">{envio.corpo_texto}</p>
          {falhou && envio.erro_detalhe && (
            <p className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {envio.erro_detalhe}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
