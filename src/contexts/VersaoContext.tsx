import * as React from "react";
import type { VersaoFiltro } from "@/types/demanda";

interface VersaoContextValue {
  versao: VersaoFiltro;
  setVersao: (v: VersaoFiltro) => void;
}

const VersaoContext = React.createContext<VersaoContextValue | null>(null);

export function VersaoProvider({ children }: { children: React.ReactNode }) {
  const [versao, setVersao] = React.useState<VersaoFiltro>("atual");
  return (
    <VersaoContext.Provider value={{ versao, setVersao }}>
      {children}
    </VersaoContext.Provider>
  );
}

export function useVersao() {
  const ctx = React.useContext(VersaoContext);
  if (!ctx) throw new Error("useVersao precisa de VersaoProvider");
  return ctx;
}
