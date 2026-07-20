import { describe, it, expect } from "vitest";
import { montarPromptAgente } from "./contexto";

describe("montarPromptAgente", () => {
  const base = {
    codigo: "DEM-123",
    titulo: "Botão salvar não funciona",
    descricao: "Ao clicar em salvar nada acontece.",
    comentarios: [{ autor: "Ana", texto: "acontece no Chrome" }],
  };

  it("inclui código, título e descrição", () => {
    const p = montarPromptAgente(base);
    expect(p).toContain("DEM-123");
    expect(p).toContain("Botão salvar não funciona");
    expect(p).toContain("Ao clicar em salvar nada acontece.");
  });

  it("inclui os comentários com autor", () => {
    const p = montarPromptAgente(base);
    expect(p).toContain("Ana");
    expect(p).toContain("acontece no Chrome");
  });

  it("funciona sem comentários", () => {
    const p = montarPromptAgente({ ...base, comentarios: [] });
    expect(p).toContain("DEM-123");
    expect(p).not.toContain("undefined");
  });
});
