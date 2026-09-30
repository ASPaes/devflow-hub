// bun test supabase/functions/notificar-cliente-demanda/rodape.test.ts

import { describe, expect, it } from "bun:test";

import {
  assuntoComCodigo,
  linkDaDemanda,
  rodapeHtml,
  rodapeTexto,
  rodapeWhatsApp,
} from "./rodape.ts";

describe("linkDaDemanda", () => {
  it("usa o endereço padrão quando a base não vem", () => {
    expect(linkDaDemanda("DEM-0504", null)).toBe("https://doctordev.lovable.app/demandas/DEM-0504");
    expect(linkDaDemanda("DEM-0504", "  ")).toBe("https://doctordev.lovable.app/demandas/DEM-0504");
  });

  it("tira a barra do fim da base", () => {
    expect(linkDaDemanda("DEM-0504", "https://doctordev.com.br/")).toBe(
      "https://doctordev.com.br/demandas/DEM-0504",
    );
  });
});

describe("assuntoComCodigo", () => {
  it("acrescenta o código quando falta", () => {
    expect(assuntoComCodigo("Ajuste concluído", "DEM-0504")).toBe("Ajuste concluído (DEM-0504)");
  });

  it("não repete o código que o agente já escreveu", () => {
    expect(assuntoComCodigo("dem-0504: ajuste concluído", "DEM-0504")).toBe(
      "dem-0504: ajuste concluído",
    );
  });

  it("sem código, devolve o assunto como veio", () => {
    expect(assuntoComCodigo("Ajuste concluído", null)).toBe("Ajuste concluído");
  });
});

describe("rodapé", () => {
  const link = linkDaDemanda("DEM-0504", null);

  it("texto leva código e link", () => {
    const t = rodapeTexto("DEM-0504", link);
    expect(t).toContain("Demanda: DEM-0504");
    expect(t).toContain(`Acompanhe: ${link}`);
  });

  it("whatsapp leva código e link", () => {
    const w = rodapeWhatsApp("DEM-0504", link);
    expect(w).toBe(`\n\nDemanda *DEM-0504*\nAcompanhe: ${link}`);
  });

  it("html leva botão para o link e o link visível", () => {
    const h = rodapeHtml("DEM-0504", link);
    expect(h).toContain(`href="${link}"`);
    expect(h).toContain("DEM-0504");
    expect(h.split(link).length - 1).toBe(2);
  });
});
