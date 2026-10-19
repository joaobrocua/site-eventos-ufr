import { describe, expect, it } from "vitest";
import { perfilSchema } from "./perfil";

describe("perfilSchema", () => {
  it("normaliza RGA e telefone e aceita campos opcionais vazios", () => {
    const r = perfilSchema.parse({
      nome_completo: "  Maria   da Silva ",
      rga: "2023.1190.0123",
      curso: "",
      telefone: "(66) 99999-1234",
    });
    expect(r).toEqual({
      nome_completo: "Maria   da Silva",
      rga: "202311900123",
      curso: null,
      telefone: "66999991234",
    });
  });

  it("exige nome e sobrenome", () => {
    expect(perfilSchema.safeParse({ nome_completo: "Maria", rga: "", curso: "", telefone: "" }).success).toBe(false);
  });

  it("recusa RGA curto", () => {
    expect(perfilSchema.safeParse({ nome_completo: "Maria Silva", rga: "123", curso: "", telefone: "" }).success).toBe(false);
  });
});
