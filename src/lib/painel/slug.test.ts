import { describe, expect, it } from "vitest";
import { gerarSlug } from "./slug";

describe("gerarSlug", () => {
  it("remove acentos e pontuação", () => {
    expect(gerarSlug("Semana de Engenharia de Minas 2026!")).toBe("semana-de-engenharia-de-minas-2026");
    expect(gerarSlug("  Ação & Reação — Ciência  ")).toBe("acao-reacao-ciencia");
  });

  it("respeita o limite sem terminar em hífen", () => {
    const slug = gerarSlug("palavra ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("devolve vazio quando não sobra nada", () => {
    expect(gerarSlug("!!!")).toBe("");
  });
});
