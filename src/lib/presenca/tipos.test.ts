import { describe, expect, it } from "vitest";
import { duracaoDoResultado, type RespostaPresenca } from "./tipos";

const dados: RespostaPresenca = {
  resultado: "registrado",
  inscricaoId: null,
  nome: null,
  rga: null,
  presenteEm: null,
};

describe("duracaoDoResultado", () => {
  it("sucesso some sozinho em 2s", () => {
    expect(duracaoDoResultado({ tipo: "registrado", dados, codigo: "x" })).toBe(2000);
    expect(duracaoDoResultado({ tipo: "ja_registrado", dados, codigo: "x" })).toBe(2000);
  });
  it("não inscrito e erro esperam decisão da pessoa", () => {
    expect(duracaoDoResultado({ tipo: "nao_inscrito", dados, codigo: "x" })).toBeNull();
    expect(duracaoDoResultado({ tipo: "erro", mensagem: "x" })).toBeNull();
  });
  it("códigos inválidos somem em 3s", () => {
    expect(duracaoDoResultado({ tipo: "qr_invalido" })).toBe(3000);
    expect(duracaoDoResultado({ tipo: "codigo_invalido", dados, codigo: "x" })).toBe(3000);
  });
});
