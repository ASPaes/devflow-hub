import { describe, expect, it } from "vitest";

import {
  formatHorasCorridas,
  formatTempoDoPeriodo,
  usaHorasCorridas,
} from "./horasDev";

describe("formatHorasCorridas", () => {
  it("mostra a DEM-0639 real: 2542 s sao 42 minutos, nao 71", () => {
    expect(formatHorasCorridas(2542)).toBe("00h 42m 22s");
  });

  it("cobre os exemplos de 30 e 90 minutos", () => {
    expect(formatHorasCorridas(1800)).toBe("00h 30m 00s");
    expect(formatHorasCorridas(5400)).toBe("01h 30m 00s");
  });

  it("nao esconde total acima de 99 horas", () => {
    expect(formatHorasCorridas(360000)).toBe("100h 00m 00s");
  });

  it("trata vazio como zero", () => {
    expect(formatHorasCorridas(null)).toBe("00h 00m 00s");
    expect(formatHorasCorridas(undefined)).toBe("00h 00m 00s");
  });
});

describe("corte de exibicao em 01/10/2026", () => {
  it("vale a partir de outubro", () => {
    expect(usaHorasCorridas("2026-10-01")).toBe(true);
    expect(usaHorasCorridas("2026-11-01")).toBe(true);
    expect(usaHorasCorridas("2026-09-30")).toBe(false);
  });

  it("periodo novo mostra horas corridas; antigo continua decimal", () => {
    const tempo = { segundos: 2542, horas: 0.71 };
    expect(formatTempoDoPeriodo("2026-11-01", tempo)).toBe("00h 42m 22s");
    expect(formatTempoDoPeriodo("2026-09-01", tempo)).toBe("0,71");
  });
});
