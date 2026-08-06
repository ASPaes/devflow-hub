export type CanalComunicacao = "email" | "whatsapp";

/** Parecer = demanda em andamento. Conclusão = demanda entregue. Muda o tom da IA. */
export type MomentoComunicacao = "parecer" | "conclusao";

export interface RetornoParaComunicacao {
  texto: string;
  autor_nome: string | null;
  created_at: string;
}

export interface EnvioAnterior {
  id: string;
  canal: CanalComunicacao;
  status: string;
  enviado_em: string;
  destinatario: string | null;
}

export interface DadosComunicacaoDemanda {
  demanda: {
    id: string;
    codigo: string | null;
    titulo: string;
    descricao: string | null;
    status: string;
    tipo: string | null;
    delivered_at: string | null;
  };
  empresa: string | null;
  solicitante: {
    id: string | null;
    nome: string | null;
    email: string | null;
    telefone: string | null;
  };
  retornos: RetornoParaComunicacao[];
  envios: EnvioAnterior[];
}

export interface MensagemGerada {
  canal: CanalComunicacao;
  momento: MomentoComunicacao;
  assunto: string;
  corpo: string;
  usage: { input_tokens: number; output_tokens: number };
}

/** Formata só para exibição: 5511999998888 → (11) 99999-8888 */
export function formatarTelefoneBR(bruto: string | null | undefined): string {
  const d = String(bruto ?? "").replace(/\D/g, "");
  const nacional = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return bruto ?? "";
}
