import { describe, expect, it } from "vitest";
import { filtrarInscritos, type InscritoPainel } from "./inscritos";

const lista: InscritoPainel[] = [
  { id: "1", nome: "João Álvares", email: "joao@x.com", rga: "202011111", curso: null, atividades: [{ atividade_id: "a", presente_em: null }], fila: [] },
  { id: "2", nome: "Maria Souza", email: "maria@x.com", rga: null, curso: null, atividades: [], fila: [] },
];

describe("filtrarInscritos", () => {
  it("busca sem diferenciar acentos nem maiúsculas", () => {
    expect(filtrarInscritos(lista, "joao alvares", null).map((i) => i.id)).toEqual(["1"]);
    expect(filtrarInscritos(lista, "MARIA@", null).map((i) => i.id)).toEqual(["2"]);
  });
  it("busca por RGA", () => {
    expect(filtrarInscritos(lista, "2020111", null)).toHaveLength(1);
  });
  it("filtra por atividade", () => {
    expect(filtrarInscritos(lista, "", "a").map((i) => i.id)).toEqual(["1"]);
    expect(filtrarInscritos(lista, "", null)).toHaveLength(2);
  });
});
