import { describe, expect, it } from "vitest";
import { escolherAtividadePadrao } from "./atividade-padrao";

// Cuiabá = UTC-4
const at = (id: string, inicio: string, fim: string) => ({
  id,
  inicio: `${inicio}:00-04:00`,
  fim: `${fim}:00-04:00`,
});

const lista = [
  at("tarde", "2026-11-10T14:00", "2026-11-10T16:00"),
  at("manha", "2026-11-10T08:00", "2026-11-10T10:00"),
  at("amanha", "2026-11-11T08:00", "2026-11-11T10:00"),
];

describe("escolherAtividadePadrao", () => {
  it("devolve null sem atividades", () => {
    expect(escolherAtividadePadrao([], new Date())).toBeNull();
  });

  it("prefere a que está acontecendo agora", () => {
    expect(escolherAtividadePadrao(lista, new Date("2026-11-10T09:00:00-04:00"))).toBe("manha");
  });

  it("o fim é exclusivo", () => {
    expect(escolherAtividadePadrao(lista, new Date("2026-11-10T10:00:00-04:00"))).toBe("tarde");
  });

  it("entre atividades, pega a próxima de hoje", () => {
    expect(escolherAtividadePadrao(lista, new Date("2026-11-10T11:00:00-04:00"))).toBe("tarde");
  });

  it("com sobreposição, pega a que começou por último", () => {
    const l = [
      at("a", "2026-11-10T08:00", "2026-11-10T12:00"),
      at("b", "2026-11-10T09:00", "2026-11-10T10:00"),
    ];
    expect(escolherAtividadePadrao(l, new Date("2026-11-10T09:30:00-04:00"))).toBe("b");
  });

  it("sem nada hoje, cai na primeira do evento", () => {
    expect(escolherAtividadePadrao(lista, new Date("2026-11-09T12:00:00-04:00"))).toBe("manha");
    expect(escolherAtividadePadrao(lista, new Date("2026-11-20T12:00:00-04:00"))).toBe("manha");
  });

  it("usa o dia de Cuiabá, não o UTC", () => {
    // 22h em Cuiabá = 02h UTC do dia seguinte
    const l = [
      at("noite", "2026-11-10T23:00", "2026-11-10T23:30"),
      at("outra", "2026-11-12T08:00", "2026-11-12T09:00"),
    ];
    expect(escolherAtividadePadrao(l, new Date("2026-11-10T22:00:00-04:00"))).toBe("noite");
  });
});
