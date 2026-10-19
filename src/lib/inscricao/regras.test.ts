import { describe, expect, it } from "vitest";
import {
  bloqueiosPorChoque,
  estaEsgotada,
  jaAconteceu,
  eventoAnterior,
  situacaoInscricoes,
  textoSelecionadas,
  textoVagas,
} from "./regras";

const a = (id: string, ini: string, fim: string) => ({
  id,
  titulo: `Atividade ${id}`,
  inicio: `2026-11-10T${ini}:00-04:00`,
  fim: `2026-11-10T${fim}:00-04:00`,
});
const A = a("A", "09:00", "11:00");
const B = a("B", "10:00", "12:00");
const C = a("C", "11:00", "13:00");
const D = a("D", "14:00", "15:00");

describe("bloqueiosPorChoque", () => {
  it("sem seleção, nada é bloqueado", () => {
    expect(bloqueiosPorChoque([A, B, C], new Set()).size).toBe(0);
  });
  it("bloqueia só quem sobrepõe e informa o motivo", () => {
    const r = bloqueiosPorChoque([A, B, C, D], new Set(["A"]));
    expect(r.get("B")).toBe("Atividade A");
    expect(r.has("C")).toBe(false); // 11:00 encosta no fim de A, não choca
    expect(r.has("D")).toBe(false);
    expect(r.has("A")).toBe(false); // a própria selecionada nunca é bloqueada
  });
  it("considera atividades fixas (já inscrito)", () => {
    const r = bloqueiosPorChoque([A, B, D], new Set(), new Set(["B"]));
    expect(r.get("A")).toBe("Atividade B");
  });
});

describe("situacaoInscricoes", () => {
  const base = { status: "publicado", inscricoes_abertas: true, inscricoes_ate: null };
  const agora = new Date("2026-11-01T12:00:00Z");
  it("aberta", () => expect(situacaoInscricoes(base, agora)).toEqual({ abertas: true }));
  it("evento encerrado", () =>
    expect(situacaoInscricoes({ ...base, status: "encerrado" }, agora)).toEqual({
      abertas: false,
      motivo: "evento_encerrado",
    }));
  it("fechadas manualmente", () =>
    expect(situacaoInscricoes({ ...base, inscricoes_abertas: false }, agora)).toMatchObject({
      motivo: "inscricoes_fechadas",
    }));
  it("prazo vencido e prazo futuro", () => {
    expect(
      situacaoInscricoes({ ...base, inscricoes_ate: "2026-10-31T00:00:00Z" }, agora),
    ).toMatchObject({ abertas: false, motivo: "prazo_encerrado" });
    expect(situacaoInscricoes({ ...base, inscricoes_ate: "2026-11-02T00:00:00Z" }, agora)).toEqual({
      abertas: true,
    });
  });
});

describe("vagas", () => {
  it("textos", () => {
    expect(textoVagas({ vagas: null, ocupadas: 5 })).toBe("Vagas ilimitadas");
    expect(textoVagas({ vagas: 10, ocupadas: 7 })).toBe("Restam 3 vagas");
    expect(textoVagas({ vagas: 10, ocupadas: 9 })).toBe("Resta 1 vaga");
    expect(textoVagas({ vagas: 10, ocupadas: 10 })).toBe("Esgotado");
    expect(textoVagas(undefined)).toBeNull();
  });
  it("esgotada", () => {
    expect(estaEsgotada({ vagas: 2, ocupadas: 3 })).toBe(true);
    expect(estaEsgotada({ vagas: null, ocupadas: 3 })).toBe(false);
    expect(estaEsgotada(undefined)).toBe(false);
  });
});

describe("eventoAnterior", () => {
  it("encerrado ou data_fim passada", () => {
    expect(eventoAnterior({ status: "encerrado", data_fim: "2027-01-01" }, "2026-10-19")).toBe(true);
    expect(eventoAnterior({ status: "publicado", data_fim: "2026-10-18" }, "2026-10-19")).toBe(true);
    expect(eventoAnterior({ status: "publicado", data_fim: "2026-10-19" }, "2026-10-19")).toBe(false);
  });
});

describe("textoSelecionadas", () => {
  it("singular e plural", () => {
    expect(textoSelecionadas(0)).toBe("Nenhuma atividade selecionada");
    expect(textoSelecionadas(1)).toBe("1 atividade selecionada");
    expect(textoSelecionadas(4)).toBe("4 atividades selecionadas");
  });
});

describe("jaAconteceu", () => {
  const agora = new Date("2026-11-10T16:00:00Z"); // 12:00 em Cuiabá
  it("terminada, em andamento e futura", () => {
    expect(jaAconteceu(a("X", "09:00", "11:00"), agora)).toBe(true);
    expect(jaAconteceu(a("X", "09:00", "12:00"), agora)).toBe(true); // fim == agora
    expect(jaAconteceu(a("X", "11:00", "13:00"), agora)).toBe(false);
    expect(jaAconteceu(a("X", "14:00", "15:00"), agora)).toBe(false);
  });
});
