import { describe, expect, it } from "vitest";
import { ehCodigoValido, leituraRepetida, lerCodigo, normalizarCodigo } from "./codigo";

const COD = "0123456789abcdef0123456789abcdef";

describe("código de inscrição", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(normalizarCodigo(`  ${COD.toUpperCase()}\n`)).toBe(COD);
    expect(lerCodigo(` ${COD.toUpperCase()} `)).toBe(COD);
  });

  it("recusa o que não é um código", () => {
    expect(ehCodigoValido(COD)).toBe(true);
    expect(lerCodigo("")).toBeNull();
    expect(lerCodigo("https://exemplo.com")).toBeNull();
    expect(lerCodigo(COD.slice(1))).toBeNull();
    expect(lerCodigo(COD + "a")).toBeNull();
    expect(lerCodigo("g".repeat(32))).toBeNull();
  });
});

describe("leituraRepetida", () => {
  it("ignora o mesmo código dentro de 3s", () => {
    expect(leituraRepetida({ codigo: COD, em: 1000 }, COD, 3999)).toBe(true);
  });
  it("aceita depois de 3s", () => {
    expect(leituraRepetida({ codigo: COD, em: 1000 }, COD, 4000)).toBe(false);
  });
  it("aceita código diferente ou primeira leitura", () => {
    expect(leituraRepetida({ codigo: COD, em: 1000 }, "b".repeat(32), 1100)).toBe(false);
    expect(leituraRepetida(null, COD, 1100)).toBe(false);
  });
});
