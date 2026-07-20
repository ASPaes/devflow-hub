import { useAgenteExecucoes } from "@/hooks/useAgente";
import { STATUS_AGENTE_LABEL, STATUS_AGENTE_ATIVO, type AgenteExecucao } from "@/types/agente";
import { Loader2, CheckCircle2, XCircle, ExternalLink, Bot } from "lucide-react";

function StatusIcone({ e }: { e: AgenteExecucao }) {
  if (e.status === "concluida") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (e.status === "falhou" || e.status === "cancelada")
    return <XCircle className="h-4 w-4 text-destructive" />;
  if (STATUS_AGENTE_ATIVO.includes(e.status))
    return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />;
  return <Bot className="h-4 w-4 text-muted-foreground" />;
}

export function AgenteExecucaoCard({
  demandaId,
  podeVerLinks = false,
}: {
  demandaId: string;
  /** Links técnicos (Run/PR/Deploy) só aparecem para quem pode acionar/editar — não pro cliente. */
  podeVerLinks?: boolean;
}) {
  const { data: execucoes = [] } = useAgenteExecucoes(demandaId);
  if (execucoes.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="h-4 w-4 text-purple-500" /> Agente de correção
      </h3>
      <ul className="space-y-3">
        {execucoes.map((e) => (
          <li key={e.id} className="rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <StatusIcone e={e} />
                {STATUS_AGENTE_LABEL[e.status]}
              </span>
              <div className="flex items-center gap-3 text-xs">
                {podeVerLinks && e.github_run_url && (
                  <a
                    href={e.github_run_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Run <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {podeVerLinks && e.pr_url && (
                  <a
                    href={e.pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    PR <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {podeVerLinks && e.deploy_url && (
                  <a
                    href={e.deploy_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Deploy <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            {e.status === "falhou" && e.erro_mensagem && (
              <p className="mt-2 text-xs text-destructive whitespace-pre-wrap">{e.erro_mensagem}</p>
            )}
            {e.resumo && (
              <div className="mt-2 rounded bg-muted/50 p-2 text-xs whitespace-pre-wrap">
                <span className="font-medium">Devolutiva gerada: </span>
                {e.resumo}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
