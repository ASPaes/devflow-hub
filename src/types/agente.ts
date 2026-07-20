export type StatusAgente =
  | "enfileirada"
  | "corrigindo"
  | "testando"
  | "deploy"
  | "concluida"
  | "falhou"
  | "cancelada";

export interface AgenteExecucao {
  id: string;
  demanda_id: string;
  status: StatusAgente;
  github_run_id: number | null;
  github_run_url: string | null;
  pr_url: string | null;
  deploy_url: string | null;
  resumo: string | null;
  erro_mensagem: string | null;
  retorno_id: string | null;
  disparado_por: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export const STATUS_AGENTE_ATIVO: StatusAgente[] = [
  "enfileirada",
  "corrigindo",
  "testando",
  "deploy",
];

export const STATUS_AGENTE_LABEL: Record<StatusAgente, string> = {
  enfileirada: "Na fila",
  corrigindo: "Corrigindo",
  testando: "Testando",
  deploy: "Publicando",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};
