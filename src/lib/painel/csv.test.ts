import { describe, expect, it } from "vitest";
import { celulaCsv, linhasDeExportacao, montarCsv, type InscritoExportacao } from "./csv";

describe("celulaCsv", () => {
  it("não mexe em texto simples", () => {
    expect(celulaCsv("Maria da Silva")).toBe("Maria da Silva");
    expect(celulaCsv(null)).toBe("");
  });

  it("escapa aspas, ponto e vírgula e quebras de linha", () => {
    expect(celulaCsv('Ele disse "oi"')).toBe('"Ele disse ""oi"""');
    expect(celulaCsv("a;b")).toBe('"a;b"');
    expect(celulaCsv("a\nb")).toBe('"a\nb"');
  });

  it.each(["=1+1", "+55", "-2", "@SOMA(A1)", "\tx", "\rx"])("neutraliza fórmula %j", (v) => {
    expect(celulaCsv(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("neutraliza e escapa ao mesmo tempo", () => {
    expect(celulaCsv('=HYPERLINK("x";"y")')).toBe('"\'=HYPERLINK(""x"";""y"")"');
  });
});

describe("montarCsv", () => {
  it("usa BOM, ; e CRLF", () => {
    const csv = montarCsv([["a", "b"], ["c", "d"]]);
    expect(csv).toBe("\uFEFFa;b\r\nc;d\r\n");
  });
});

describe("linhasDeExportacao", () => {
  const inscritos: InscritoExportacao[] = [
    {
      nome: "Ana",
      email: "ana@x.com",
      rga: "202011111",
      curso: "Minas",
      telefone: null,
      atividades: [
        { atividade_id: "a1", presente_em: "2026-11-10T18:30:00Z" },
        { atividade_id: "a2", presente_em: null },
      ],
    },
    { nome: "Bia", email: "bia@x.com", rga: null, curso: null, telefone: null, atividades: [] },
  ];
  const titulos = { a1: "Abertura", a2: "Oficina" };

  it("gera uma linha por atividade e mantém quem não escolheu nenhuma", () => {
    const l = linhasDeExportacao(inscritos, titulos);
    expect(l).toHaveLength(4);
    expect(l[1].slice(5)).toEqual(["Abertura", "Sim", "10/11/2026 14:30"]);
    expect(l[2].slice(5)).toEqual(["Oficina", "Não", ""]);
    expect(l[3].slice(0, 2)).toEqual(["Bia", "bia@x.com"]);
  });

  it("filtra por atividade", () => {
    const l = linhasDeExportacao(inscritos, titulos, "a2");
    expect(l).toHaveLength(2);
    expect(l[1][0]).toBe("Ana");
    expect(l[1][5]).toBe("Oficina");
  });
});
