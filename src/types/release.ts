export type TipoRelease =
  | "erro"
  | "melhoria"
  | "nova_funcionalidade"
  | "duvida"
  | "tarefa";

export interface Release {
  id: string;
  demanda_id: string;
  tipo_release: string | null;
  tipo_id: string | null;
  titulo: string;
  resumo: string;
  data_publicacao: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReleasePublicada {
  id: string;
  demanda_id: string;
  demanda_codigo: string;
  tipo_release: string | null;
  tipo_id: string | null;
  tipo_codigo: string | null;
  tipo_label: string | null;
  tipo_icone: string | null;
  tipo_cor: string | null;
  titulo: string;
  resumo: string;
  data_publicacao: string;
  published_at: string;
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

export interface RetornoRelease {
  id: string;
  texto: string | null;
  midia_tipo: string | null;
  midia_url: string | null;
  midia_nome_original: string | null;
  midia_tamanho_bytes: number | null;
  autor_id: string | null;
  autor_nome: string | null;
  autor_avatar: string | null;
  created_at: string;
  ordem: number;
}
