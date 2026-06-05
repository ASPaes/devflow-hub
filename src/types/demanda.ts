export type VersaoDemanda = "atual" | "proxima" | "futura";

export type VersaoFiltro = VersaoDemanda | "todas";

export const VERSAO_LABEL: Record<VersaoDemanda, string> = {
  atual: "Atual",
  proxima: "Próxima",
  futura: "Futura",
};
