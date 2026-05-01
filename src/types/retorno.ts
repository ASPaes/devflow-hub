export type TipoMidiaRetorno = "imagem" | "video" | "audio";

export interface DemandaRetorno {
  id: string;
  demanda_id: string;
  ordem: number;
  texto: string | null;
  midia_url: string | null;
  midia_tipo: TipoMidiaRetorno | null;
  midia_nome_original: string | null;
  midia_tamanho_bytes: number | null;
  autor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandaRetornoComAutor extends DemandaRetorno {
  autor_nome: string | null;
  autor_avatar: string | null;
}
