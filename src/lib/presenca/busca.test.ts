import { describe, expect, it } from "vitest";
import { filtrarPorBusca, normalizarBusca } from "./busca";

const pessoas = [
  { nome: "José da Conceição", rga: "202311900123" },
  { nome: "Maria Ângela Souza", rga: "202211900456" },
  { nome: "João Pedro", rga: null },
];

describe("normalizarBusca", () => {
  it("tira acento, caixa e espaços", () => {
    expect(normalizarBusca("  JOSÉ   Conceição ")).toBe("jose conceicao");
  });
});

describe("filtrarPorBusca", () => {
  it("devolve tudo com busca vazia", () => {
    expect(filtrarPorBusca(pessoas, "   ")).toHaveLength(3);
  });
  it("ignora acento e maiúsculas", () => {
    expect(filtrarPorBusca(pessoas, "jose").map((p) => p.nome)).toEqual(["José da Conceição"]);
    expect(filtrarPorBusca(pessoas, "ANGELA").map((p) => p.nome)).toEqual(["Maria Ângela Souza"]);
  });
  it("aceita palavras em qualquer ordem", () => {
    expect(filtrarPorBusca(pessoas, "souza maria")).toHaveLength(1);
  });
  it("busca por RGA com ou sem pontuação", () => {
    expect(filtrarPorBusca(pessoas, "2022").map((p) => p.nome)).toEqual(["Maria Ângela Souza"]);
    expect(filtrarPorBusca(pessoas, "2023.1190").map((p) => p.nome)).toEqual(["José da Conceição"]);
  });
  it("RGA nulo não quebra", () => {
    expect(filtrarPorBusca(pessoas, "123456")).toHaveLength(0);
  });
});
