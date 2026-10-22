import { describe, expect, it } from "vitest";
import {
  codigoCertificadoValido,
  foiAtualizado,
  lerAtividadesCertificado,
  normalizarCodigoCertificado,
} from "./certificados";

describe("normalizarCodigoCertificado", () => {
  it("aceita minúsculas, espaços e traços", () => {
    expect(normalizarCodigoCertificado(" abcd 2345-6789 ")).toBe("ABCD-2345-6789");
    expect(normalizarCodigoCertificado("abcd23456789")).toBe("ABCD-2345-6789");
  });
  it("troca O, I e L como o banco", () => {
    expect(normalizarCodigoCertificado("ABCO-I23L-4567")).toBe("ABC0-1231-4567");
  });
  it("tamanho errado fica sem traços", () => {
    expect(normalizarCodigoCertificado("abc-123")).toBe("ABC123");
    expect(codigoCertificadoValido("ABC123")).toBe(false);
    expect(codigoCertificadoValido("ABCD-2345-6789")).toBe(true);
    expect(codigoCertificadoValido("ABCU-2345-6789")).toBe(false); // U não existe no alfabeto
  });
});

describe("foiAtualizado", () => {
  it("exige mais de 1 minuto de diferença", () => {
    expect(foiAtualizado("2026-11-10T10:00:00Z", "2026-11-10T10:00:30Z")).toBe(false);
    expect(foiAtualizado("2026-11-10T10:00:00Z", "2026-11-10T10:01:00Z")).toBe(false);
    expect(foiAtualizado("2026-11-10T10:00:00Z", "2026-11-10T10:05:00Z")).toBe(true);
  });
});

describe("lerAtividadesCertificado", () => {
  it("ignora lixo", () => {
    expect(lerAtividadesCertificado(null)).toEqual([]);
    const ok = { titulo: "A", tipo: "palestra", inicio: "2026-11-10T10:00:00Z", carga_horaria_minutos: 60 };
    expect(lerAtividadesCertificado([ok, 3, null, { titulo: 1 }])).toEqual([ok]);
  });
});
