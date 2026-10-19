import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  chaveDoDia,
  formatarCargaHoraria,
  formatarHora,
  formatarPeriodo,
  haChoque,
  paraInstanteCuiaba,
  separarDataHoraCuiaba,
} from "./datas";

describe("fuso de Cuiabá", () => {
  it("21h em Cuiabá continua no mesmo dia (01h UTC do dia seguinte)", () => {
    const inicio = "2026-11-11T21:00:00-04:00";
    expect(chaveDoDia(inicio)).toBe("2026-11-11");
    expect(formatarHora(inicio)).toBe("21:00");
  });

  it("converte o que foi digitado no formulário e volta", () => {
    const iso = paraInstanteCuiaba("2026-11-10", "14:00");
    expect(new Date(iso).toISOString()).toBe("2026-11-10T18:00:00.000Z");
    expect(separarDataHoraCuiaba(iso)).toEqual({ data: "2026-11-10", hora: "14:00" });
  });
});

describe("agruparPorDia", () => {
  it("agrupa e ordena por dia local", () => {
    const grupos = agruparPorDia([
      { id: 2, inicio: "2026-11-11T19:00:00-04:00" },
      { id: 1, inicio: "2026-11-10T08:00:00-04:00" },
      { id: 3, inicio: "2026-11-11T22:30:00-04:00" },
    ]);
    expect(grupos.map((g) => g.dia)).toEqual(["2026-11-10", "2026-11-11"]);
    expect(grupos[1].itens.map((i) => i.id)).toEqual([2, 3]);
  });
});

describe("haChoque", () => {
  const a = { inicio: "2026-11-10T14:00:00-04:00", fim: "2026-11-10T16:00:00-04:00" };
  it("detecta sobreposição", () => {
    expect(haChoque(a, { inicio: "2026-11-10T15:00:00-04:00", fim: "2026-11-10T18:00:00-04:00" })).toBe(true);
  });
  it("encostar no horário não é choque", () => {
    expect(haChoque(a, { inicio: "2026-11-10T16:00:00-04:00", fim: "2026-11-10T18:00:00-04:00" })).toBe(false);
  });
});

describe("formatos", () => {
  it("período", () => {
    expect(formatarPeriodo("2026-11-10", "2026-11-12")).toBe("10 a 12/11/2026");
    expect(formatarPeriodo("2026-11-10", "2026-11-10")).toBe("10/11/2026");
    expect(formatarPeriodo("2026-11-28", "2026-12-02")).toBe("28/11 a 02/12/2026");
  });
  it("carga horária", () => {
    expect(formatarCargaHoraria(240)).toBe("4h");
    expect(formatarCargaHoraria(90)).toBe("1h30");
    expect(formatarCargaHoraria(45)).toBe("45 min");
  });
});
