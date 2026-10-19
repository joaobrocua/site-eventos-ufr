import { describe, expect, it } from "vitest";
import { caminhoSeguro } from "./caminho";

describe("caminhoSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(caminhoSeguro("/minha-area")).toBe("/minha-area");
    expect(caminhoSeguro("/eventos/x?y=1")).toBe("/eventos/x?y=1");
  });

  it("recusa URLs externas e truques", () => {
    expect(caminhoSeguro("https://mal.com")).toBe("/");
    expect(caminhoSeguro("//mal.com")).toBe("/");
    expect(caminhoSeguro("/\\mal.com")).toBe("/");
    expect(caminhoSeguro("/\tmal")).toBe("/");
    expect(caminhoSeguro(null, "/painel")).toBe("/painel");
  });
});
