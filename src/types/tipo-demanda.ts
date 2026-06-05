export interface TipoDemanda {
  id: string;
  codigo: string;
  label: string;
  icone: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  sistema: boolean;
  created_at: string;
  updated_at: string;
}
