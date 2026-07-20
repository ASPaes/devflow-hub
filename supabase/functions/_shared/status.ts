export const STATUS_AGENTE = [
  "enfileirada",
  "corrigindo",
  "testando",
  "deploy",
  "concluida",
  "falhou",
  "cancelada",
] as const;

export type StatusAgente = (typeof STATUS_AGENTE)[number];

export function isStatusAgente(v: string): v is StatusAgente {
  return (STATUS_AGENTE as readonly string[]).includes(v);
}

const TERMINAIS: StatusAgente[] = ["concluida", "falhou", "cancelada"];

// Ordem do fluxo feliz; permite pular etapas para frente (ex.: testando → concluida).
const ORDEM: StatusAgente[] = [
  "enfileirada",
  "corrigindo",
  "testando",
  "deploy",
  "concluida",
];

export function transicaoValida(de: StatusAgente, para: StatusAgente): boolean {
  if (TERMINAIS.includes(de)) return false; // estado terminal não sai
  if (para === "falhou" || para === "cancelada") return true; // pode abortar de qualquer ativo
  const i = ORDEM.indexOf(de);
  const j = ORDEM.indexOf(para);
  if (i === -1 || j === -1) return false;
  return j > i; // só avança
}
