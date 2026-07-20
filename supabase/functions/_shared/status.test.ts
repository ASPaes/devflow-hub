import { describe, it, expect } from "vitest";
import { isStatusAgente, transicaoValida } from "./status";

describe("status agente", () => {
  it("reconhece status válido/inválido", () => {
    expect(isStatusAgente("corrigindo")).toBe(true);
    expect(isStatusAgente("banana")).toBe(false);
  });

  it("permite avanço no fluxo feliz", () => {
    expect(transicaoValida("enfileirada", "corrigindo")).toBe(true);
    expect(transicaoValida("corrigindo", "testando")).toBe(true);
    expect(transicaoValida("testando", "deploy")).toBe(true);
    expect(transicaoValida("deploy", "concluida")).toBe(true);
    expect(transicaoValida("testando", "concluida")).toBe(true); // auto_deploy=false: pula deploy
  });

  it("permite falhar de qualquer etapa ativa", () => {
    expect(transicaoValida("corrigindo", "falhou")).toBe(true);
    expect(transicaoValida("testando", "falhou")).toBe(true);
  });

  it("bloqueia transição a partir de estado terminal", () => {
    expect(transicaoValida("concluida", "corrigindo")).toBe(false);
    expect(transicaoValida("falhou", "concluida")).toBe(false);
    expect(transicaoValida("cancelada", "corrigindo")).toBe(false);
  });

  it("bloqueia retrocesso", () => {
    expect(transicaoValida("testando", "corrigindo")).toBe(false);
  });
});
