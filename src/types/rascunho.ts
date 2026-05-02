export type TipoRascunho = "texto" | "checklist";
export type CorRascunho = "cinza" | "verde" | "azul" | "amarelo" | "vermelho";

export type RascunhoChecklistItem = {
  id: string;
  rascunho_id: string;
  texto: string;
  marcado: boolean;
  ordem: number;
  created_at: string;
};

export type Rascunho = {
  id: string;
  autor_id: string;
  titulo: string | null;
  tipo: TipoRascunho;
  conteudo_texto: string | null;
  cor: CorRascunho;
  fixada: boolean;
  compartilhada: boolean;
  demanda_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type RascunhoComItens = Rascunho & {
  itens: RascunhoChecklistItem[];
  autor_nome?: string | null;
  autor_avatar?: string | null;
};

export const COR_RASCUNHO_CLASSES: Record<CorRascunho, string> = {
  cinza: "bg-card border-border",
  verde: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
  azul: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900",
  amarelo: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
  vermelho: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900",
};

export const COR_RASCUNHO_SWATCH: Record<CorRascunho, string> = {
  cinza: "bg-muted",
  verde: "bg-emerald-300",
  azul: "bg-sky-300",
  amarelo: "bg-amber-300",
  vermelho: "bg-rose-300",
};

export const COR_RASCUNHO_LABEL: Record<CorRascunho, string> = {
  cinza: "Padrão",
  verde: "Verde",
  azul: "Azul",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
};
