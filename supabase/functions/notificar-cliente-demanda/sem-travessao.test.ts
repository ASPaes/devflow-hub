// bun test supabase/functions/notificar-cliente-demanda/sem-travessao.test.ts

import { describe, expect, it } from "bun:test";

import { semTravessao } from "./sem-travessao.ts";
import { semTravessao as copiaDaIA } from "../gerar-mensagem-cliente/sem-travessao.ts";

const casos: Array<[string, string, string]> = [
  ["travessão no assunto", "Busca de Estabelecimento — Entregue", "Busca de Estabelecimento, Entregue"],
  ["meia-risca", "Ajuste feito – confira", "Ajuste feito, confira"],
  ["travessão colado", "pronto—confira", "pronto, confira"],
  ["hífen como travessão", "Revise antes de enviar - o texto vai assim", "Revise antes de enviar, o texto vai assim"],
  ["marcador de lista", "Itens:\n- primeiro\n- segundo", "Itens:\nprimeiro\nsegundo"],
  ["travessão antes de ponto", "Concluímos a análise —.", "Concluímos a análise."],
  ["travessão no fim da linha", "Olá Thomas —\nTudo certo", "Olá Thomas\nTudo certo"],
  ["hífen de palavra fica", "Responda este e-mail, bem-vindo à DEM-0663", "Responda este e-mail, bem-vindo à DEM-0663"],
  ["data fica", "Entregue em 17-11-2026", "Entregue em 17-11-2026"],
  ["parágrafos ficam", "Olá Thomas,\n\nTudo certo.\n\nEquipe", "Olá Thomas,\n\nTudo certo.\n\nEquipe"],
];

describe("semTravessao", () => {
  for (const [nome, entrada, saida] of casos) {
    it(nome, () => {
      expect(semTravessao(entrada)).toBe(saida);
    });
  }

  it("texto vazio volta vazio", () => {
    expect(semTravessao("")).toBe("");
  });

  it("a cópia da gerar-mensagem-cliente é idêntica", () => {
    for (const [, entrada] of casos) {
      expect(copiaDaIA(entrada)).toBe(semTravessao(entrada));
    }
  });
});
