export type TipoRelease =
  | "erro"
  | "melhoria"
  | "nova_funcionalidade"
  | "duvida"
  | "tarefa";

export interface Release {
  id: string;
  demanda_id: string;
  tipo_release: TipoRelease;
  titulo: string;
  resumo: string;
  data_publicacao: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleasePublicada extends Release {
  demanda_codigo: string;
  published_by_nome: string | null;
}

export const TIPO_RELEASE_LABEL: Record<TipoRelease, string> = {
  erro: "Correção",
  melhoria: "Melhoria",
  nova_funcionalidade: "Nova funcionalidade",
  duvida: "Dúvida",
  tarefa: "Tarefa",
};

export const TIPO_RELEASE_ICONE: Record<TipoRelease, string> = {
  erro: "🐛",
  melhoria: "📈",
  nova_funcionalidade: "✨",
  duvida: "❓",
  tarefa: "✅",
};
