import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
  CornerDownLeft,
  FileText,
  Mail,
  MessageCircle,
  Paperclip,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getAnexoUrl } from "@/lib/storage";
import { formatBytes } from "@/lib/upload-anexos";
import { useComunicacoesDemanda } from "@/hooks/useComunicacaoDemanda";
import {
  comunicacaoFalhou,
  contraparte,
  respostaSuspeita,
  textoSemMarcadorDeImagem,
} from "@/types/comunicacao";
import type { AnexoComunicacao, ComunicacaoDemanda } from "@/types/comunicacao";

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
  const anexos = mensagem.anexos ?? [];
  const texto =
    anexos.length > 0 ? textoSemMarcadorDeImagem(mensagem.corpo_texto) : mensagem.corpo_texto;

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

        {anexos.length > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
            title={`${anexos.length} anexo${anexos.length === 1 ? "" : "s"}`}
          >
            <Paperclip className="h-3.5 w-3.5" />
            {anexos.length}
          </span>
        )}

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
          {texto && <p className="whitespace-pre-wrap text-sm text-foreground">{texto}</p>}

          {anexos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {anexos.map((a) => (
                <AnexoDaMensagem key={a.storage_path} anexo={a} />
              ))}
            </div>
          )}

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

/** Imagem aparece no lugar; o resto vira um link com nome e tamanho. Abre em outra aba. */
function AnexoDaMensagem({ anexo }: { anexo: AnexoComunicacao }) {
  const { data: url } = useQuery({
    queryKey: ["anexo-url-path", anexo.storage_path],
    queryFn: () => getAnexoUrl(anexo.storage_path),
    staleTime: 50 * 60_000,
  });

  if (anexo.mime_type.startsWith("image/")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={anexo.nome_arquivo}
        className="block overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary"
      >
        {url ? (
          <img
            src={url}
            alt={anexo.nome_arquivo}
            className="max-h-72 max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="h-32 w-48 animate-pulse bg-muted" />
        )}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground transition-colors hover:border-primary"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="max-w-[16rem] truncate">{anexo.nome_arquivo}</span>
      <span className="shrink-0 text-muted-foreground">{formatBytes(anexo.tamanho_bytes)}</span>
    </a>
  );
}
