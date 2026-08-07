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

/** saida = mandamos ao cliente. entrada = o cliente respondeu por e-mail. */
export type DirecaoComunicacao = "saida" | "entrada";

/** Uma mensagem trocada com o cliente, como fica em demanda_comunicacoes. */
export interface ComunicacaoDemanda {
  id: string;
  canal: CanalComunicacao;
  direcao: DirecaoComunicacao;
  email_destinatario: string | null;
  telefone_destinatario: string | null;
  nome_destinatario: string | null;
  remetente_email: string | null;
  remetente_nome: string | null;
  assunto: string | null;
  corpo_texto: string;
  /** Quando a mensagem foi mandada — por nós (saida) ou pelo cliente (entrada). */
  enviado_em: string;
  status: string;
  erro_detalhe: string | null;
}

/** Só a saída pode falhar. Entrada já chegou — o que ela pode ser é suspeita. */
export function comunicacaoFalhou(c: ComunicacaoDemanda): boolean {
  return c.direcao === "saida" && c.status !== "enviado";
}

/**
 * Resposta cujo remetente não bate com o solicitante nem com ninguém da
 * empresa. Fica registrada, mas não virou comentário na demanda — o token de
 * resposta viaja num endereço de e-mail e qualquer um poderia forjá-lo.
 */
export function respostaSuspeita(c: ComunicacaoDemanda): boolean {
  return c.direcao === "entrada" && c.status === "recebido_suspeito";
}

/** Quem está do outro lado da mensagem, do nosso ponto de vista. */
export function contraparte(c: ComunicacaoDemanda): { nome: string | null; contato: string } {
  if (c.direcao === "entrada") {
    return { nome: c.remetente_nome, contato: c.remetente_email ?? "" };
  }
  return {
    nome: c.nome_destinatario,
    contato:
      c.canal === "email"
        ? (c.email_destinatario ?? "")
        : formatarTelefoneBR(c.telefone_destinatario),
  };
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
