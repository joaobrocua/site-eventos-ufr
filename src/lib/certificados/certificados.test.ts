import { PDFDocument, StandardFonts } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { dataPorExtenso, periodoPorExtenso } from "./data-extenso";
import { FOLGA_TEXTO, planejarNome, planejarTexto, TOPO_ASSINATURAS, type Medidor } from "./layout";
import { gerarPdfCertificado } from "./pdf";
import { quebrarLinhas, quebrarSegmentos, type Segmento } from "./quebra-linha";
import { cargaHorariaPorExtenso, linhaLocalEData, paragrafoPrincipal, textoPrincipal, trechoPromotor } from "./texto";
import { converterLinha, type DadosCertificado } from "./tipos";
import { paraWinAnsi, paraWinAnsiTrecho } from "./winansi";

const base: DadosCertificado = {
  codigo: "ABCD-EFGH-JKMN",
  tipo: "participante",
  nome: "João da Conceição",
  documento: null,
  funcao: null,
  atividades: [],
  carga_horaria_minutos: 270,
  emitido_em: "2026-11-15T12:00:00-04:00",
  evento_titulo: "Semana Acadêmica",
  evento_local: "Campus Rondonópolis",
  data_inicio: "2026-11-10",
  data_fim: "2026-11-12",
  certificado_texto: null,
  certificado_registro: null,
  certificado_promotor: null,
  certificado_assinaturas: [],
};

const at = (n: number, tipo: "palestra" | "oficina" = "oficina") => ({
  titulo: `Oficina de título bem comprido número ${n} sobre temas variados`,
  tipo,
  inicio: "2026-11-10T10:00:00-04:00",
  carga_horaria_minutos: 90,
});

let medir: Medidor;
beforeAll(async () => {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  medir = (t, b) => (s) => (b ? negrito : normal).widthOfTextAtSize(s, t);
});

describe("cargaHorariaPorExtenso", () => {
  it("formata singular, plural e misto", () => {
    expect(cargaHorariaPorExtenso(240)).toBe("4 horas");
    expect(cargaHorariaPorExtenso(60)).toBe("1 hora");
    expect(cargaHorariaPorExtenso(90)).toBe("1 hora e 30 minutos");
    expect(cargaHorariaPorExtenso(45)).toBe("45 minutos");
    expect(cargaHorariaPorExtenso(61)).toBe("1 hora e 1 minuto");
  });
});

describe("datas por extenso", () => {
  it("data única", () => {
    expect(dataPorExtenso("2026-10-02")).toBe("2 de outubro de 2026");
    expect(dataPorExtenso("2026-03-21")).toBe("21 de março de 2026");
  });
  it("período", () => {
    expect(periodoPorExtenso("2026-10-02", "2026-10-02")).toBe("em 2 de outubro de 2026");
    expect(periodoPorExtenso("2026-11-10", "2026-11-12")).toBe("de 10 a 12 de novembro de 2026");
    expect(periodoPorExtenso("2026-11-28", "2026-12-02")).toBe("de 28 de novembro a 2 de dezembro de 2026");
    expect(periodoPorExtenso("2026-12-28", "2027-01-02")).toBe("de 28 de dezembro de 2026 a 2 de janeiro de 2027");
  });
  it("local e data de emissão usam o dia de Cuiabá, não o UTC", () => {
    // 23h30 em Cuiabá já é dia 22 em UTC
    expect(linhaLocalEData("2026-10-21T23:30:00-04:00")).toBe("Rondonópolis, 21 de outubro de 2026.");
  });
});

describe("paragrafoPrincipal", () => {
  it("participante, sem repetir o nome, com negrito em título e carga", () => {
    const p = paragrafoPrincipal({ ...base, certificado_promotor: "Secretaria de Inovação" });
    expect(textoPrincipal({ ...base, certificado_promotor: "Secretaria de Inovação" })).toBe(
      "participou com êxito do evento Semana Acadêmica, promovido por Secretaria de Inovação, realizado de 10 a 12 de novembro de 2026, em Campus Rondonópolis, contabilizando carga horária total de 4 horas e 30 minutos.",
    );
    expect(p.filter((s) => s.negrito).map((s) => s.texto)).toEqual(["Semana Acadêmica", "4 horas e 30 minutos"]);
    expect(textoPrincipal(base)).not.toContain("João");
  });
  it("sem promotor, local ou carga", () => {
    expect(textoPrincipal({ ...base, evento_local: null, carga_horaria_minutos: 0, data_fim: base.data_inicio })).toBe(
      "participou com êxito do evento Semana Acadêmica, realizado em 10 de novembro de 2026.",
    );
  });
  it("palestrante com uma atividade", () => {
    const d = { ...base, tipo: "palestrante" as const, funcao: "palestrante", atividades: [at(1, "palestra")], carga_horaria_minutos: 60, certificado_promotor: "UFR" };
    expect(textoPrincipal(d)).toBe(
      "atuou como palestrante no evento Semana Acadêmica, na atividade “Oficina de título bem comprido número 1 sobre temas variados”, promovido por UFR, realizado de 10 a 12 de novembro de 2026, em Campus Rondonópolis, com carga horária de 1 hora.",
    );
    expect(paragrafoPrincipal(d).filter((s) => s.negrito).map((s) => s.texto)).toEqual(["palestrante", "Semana Acadêmica", "1 hora"]);
  });
  it("organização sem função usa texto padrão; lista no máximo 3 títulos e 'mais N atividades'", () => {
    const t = textoPrincipal({ ...base, tipo: "organizacao", atividades: [1, 2, 3, 4, 5].map((n) => ({ ...at(n), titulo: `T${n}` })) });
    expect(t).toContain("atuou como membro da organização");
    expect(t).toContain("nas atividades “T1”, “T2”, “T3” e mais 2 atividades,");
    expect(t).not.toContain("T4");
    const t4 = textoPrincipal({ ...base, tipo: "palestrante", atividades: [1, 2, 3, 4].map((n) => ({ ...at(n), titulo: `T${n}` })) });
    expect(t4).toContain("e mais 1 atividade,");
  });
});

describe("paraWinAnsi", () => {
  it("mantém acentos do português", () => {
    const s = "ãõçéêôúíáàü ÃÕÇÉÊÔÚ “aspas” – travessão";
    expect(paraWinAnsi(s)).toBe(s);
  });
  it("normaliza NFC (acento decomposto)", () => {
    expect(paraWinAnsi("José")).toBe("José");
  });
  it("troca o que não existe por equivalente ou ?", () => {
    expect(paraWinAnsi("Łukasz")).toBe("Lukasz");
    expect(paraWinAnsi("Ā")).toBe("A");
    expect(paraWinAnsi("日本")).toBe("??");
    expect(paraWinAnsi("Oi 😀!")).toBe("Oi ?!");
  });
  it("remove controles e invisíveis", () => {
    expect(paraWinAnsi("a\u0000b​c\nd")).toBe("abc d");
  });
  it("tudo o que sai é aceito pela fonte padrão (inclusive em maiúsculas)", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const estranho = "Zoë ı ł Œ € 日本語 😀 ́ ­ → \u0007 ßÿ";
    expect(() => font.widthOfTextAtSize(paraWinAnsi(estranho).toLocaleUpperCase("pt-BR"), 12)).not.toThrow();
  });
});

describe("quebrarLinhas", () => {
  const m = (s: string) => s.length * 10;
  it("quebra por palavras respeitando a largura", () => {
    expect(quebrarLinhas("aaa bbb ccc ddd", 70, m)).toEqual(["aaa bbb", "ccc ddd"]);
  });
  it("corta palavra maior que a linha", () => {
    const l = quebrarLinhas("abcdefghij", 40, m);
    expect(l.every((x) => m(x) <= 40)).toBe(true);
    expect(l.join("")).toBe("abcdefghij");
  });
});

describe("quebrarSegmentos (normal e negrito)", () => {
  const medirFake = (s: string, negrito: boolean) => s.length * (negrito ? 12 : 10);
  const juntar = (linhas: ReturnType<typeof quebrarSegmentos>) => linhas.map((l) => l.map((t) => t.texto).join(""));

  it("quebra por largura medindo cada trecho com a sua fonte", () => {
    const segs: Segmento[] = [{ texto: "um dois " }, { texto: "TRES", negrito: true }, { texto: " quatro cinco" }];
    const linhas = quebrarSegmentos(segs, 120, medirFake);
    for (const l of linhas) {
      const w = l.reduce((s, t) => s + medirFake(t.texto, t.negrito), 0);
      expect(w).toBeLessThanOrEqual(120);
    }
    expect(juntar(linhas).join(" ")).toBe("um dois TRES quatro cinco");
  });

  it("preserva o negrito apenas nos trechos marcados", () => {
    const linhas = quebrarSegmentos([{ texto: "a " }, { texto: "b", negrito: true }, { texto: " c" }], 1000, medirFake);
    expect(linhas).toEqual([
      [
        { texto: "a", negrito: false },
        { texto: " b", negrito: true },
        { texto: " c", negrito: false },
      ],
    ]);
  });

  it("pontuação colada ao negrito não é separada dele", () => {
    // largura só para "TITULO," em uma linha: a vírgula nunca fica sozinha na linha seguinte
    const linhas = quebrarSegmentos([{ texto: "ab " }, { texto: "TITULO", negrito: true }, { texto: ", fim" }], 100, medirFake);
    const textos = juntar(linhas);
    expect(textos.some((t) => t.trimStart().startsWith(","))).toBe(false);
    expect(textos.join(" ")).toBe("ab TITULO, fim");
  });

  it("palavra maior que a linha é cortada sem perder texto", () => {
    const linhas = quebrarSegmentos([{ texto: "x " }, { texto: "ABCDEFGHIJKLMNOP", negrito: true }], 60, medirFake);
    for (const l of linhas) expect(l.reduce((s, t) => s + medirFake(t.texto, t.negrito), 0)).toBeLessThanOrEqual(60);
    expect(juntar(linhas).join("").replace(/\s/g, "")).toBe("xABCDEFGHIJKLMNOP");
  });

  it("com fonte real, nenhuma linha passa da largura", () => {
    const d = { ...base, evento_titulo: "Simpósio ".repeat(12), certificado_promotor: "Secretaria de Inovação da UFR" };
    const linhas = quebrarSegmentos(paragrafoPrincipal(d), 500, (s, b) => medir(14, b)(s));
    expect(linhas.length).toBeGreaterThan(2);
    for (const l of linhas) expect(l.reduce((s, t) => s + medir(14, t.negrito)(t.texto), 0)).toBeLessThanOrEqual(500);
  });
});

describe("planejarNome", () => {
  it("nome normal fica grande em uma linha", () => {
    const p = planejarNome("JOÃO DA CONCEIÇÃO", medir);
    expect(p).toMatchObject({ tamanho: 28, linhas: ["JOÃO DA CONCEIÇÃO"] });
  });
  it("nome longo reduz a fonte para caber em uma linha", () => {
    const nome = "MARIA APARECIDA DOS SANTOS OLIVEIRA DE ALBUQUERQUE";
    const p = planejarNome(nome, medir);
    expect(p.tamanho).toBeLessThan(28);
    expect(p.linhas).toHaveLength(1);
    expect(medir(p.tamanho, true)(nome)).toBeLessThanOrEqual(740 - 80);
  });
  it("nome enorme quebra em mais de uma linha", () => {
    const nome = "ANA ".repeat(40).trim();
    const p = planejarNome(nome, medir);
    expect(p.linhas.length).toBeGreaterThan(1);
  });
});

describe("planejarTexto (página 1 nunca passa das assinaturas)", () => {
  const Y_INICIO = 455; // y logo abaixo de "CERTIFICADO"
  const limite = TOPO_ASSINATURAS + FOLGA_TEXTO;
  const entrada = (d: DadosCertificado, extra: string | null = null) => ({
    nome: d.nome.toLocaleUpperCase("pt-BR"),
    documento: d.documento,
    paragrafo: paragrafoPrincipal(d),
    extra,
  });
  const minimoY = (p: ReturnType<typeof planejarTexto>) => Math.min(...p.linhas.map((l) => l.y));

  it("texto curto fica na página 1 em fonte grande", () => {
    const p = planejarTexto(entrada({ ...base, documento: "RGA 202311900123" }, "Complemento."), Y_INICIO, medir);
    expect(p.extraEmPagina).toBeNull();
    expect(p.tamanhoNome).toBe(28);
    expect(minimoY(p)).toBeGreaterThanOrEqual(limite);
    // ordem: Certificamos que, nome, documento, parágrafo...
    expect(p.linhas[0].trechos[0].texto).toBe("Certificamos que");
    expect(p.linhas[1].trechos[0].texto).toBe("JOÃO DA CONCEIÇÃO");
    expect(p.linhas[2].trechos[0].texto).toBe("RGA 202311900123");
  });

  it("certificado_texto de 1500 caracteres: ou cabe acima das assinaturas ou vai inteiro para outra página", () => {
    const extra = "Palavra longa de texto oficial. ".repeat(60).slice(0, 1500);
    const p = planejarTexto(entrada(base, extra), Y_INICIO, medir);
    expect(minimoY(p)).toBeGreaterThanOrEqual(limite);
    if (p.extraEmPagina === null) {
      const noPlano = p.linhas.filter((l) => l.cor === "cinza" && l.tamanho < 11).map((l) => l.trechos[0].texto).join(" ");
      expect(noPlano.replace(/\s+/g, " ")).toBe(extra.trim().replace(/\s+/g, " "));
    } else {
      expect(p.extraEmPagina).toBe(extra);
    }
  });

  it("palestrante com 10 atividades cabe acima das assinaturas", () => {
    const d = { ...base, tipo: "palestrante" as const, funcao: "ministrante", atividades: Array.from({ length: 10 }, (_, i) => at(i + 1)) };
    const p = planejarTexto(entrada(d, "x ".repeat(700).trim()), Y_INICIO, medir);
    expect(minimoY(p)).toBeGreaterThanOrEqual(limite);
  });

  it("nome longo e título enorme continuam acima das assinaturas", () => {
    const d = { ...base, nome: "MARIA APARECIDA DOS SANTOS OLIVEIRA DE ALBUQUERQUE ".repeat(3), evento_titulo: "Congresso ".repeat(40), documento: "RGA 1" };
    const p = planejarTexto(entrada(d, "Texto. ".repeat(100)), Y_INICIO, medir);
    expect(minimoY(p)).toBeGreaterThanOrEqual(limite);
  });

  it("texto que não cabe nem encolhido vai inteiro para página extra", () => {
    const extra = "Texto oficial longo. ".repeat(200).trim();
    const p = planejarTexto(entrada(base, extra), Y_INICIO, medir);
    expect(p.extraEmPagina).toBe(extra);
    expect(p.linhas.every((l) => l.cor !== "cinza" || l.tamanho >= 11)).toBe(true);
  });
});

describe("converterLinha", () => {
  it("tolera jsonb malformado e lê o promotor", () => {
    const d = converterLinha({
      ...base,
      atividades: "x",
      certificado_assinaturas: [{ nome: "A", cargo: "B" }, 5, { nome: " " }],
      tipo: "???",
      certificado_promotor: "  UFR ",
    });
    expect(d.atividades).toEqual([]);
    expect(d.certificado_assinaturas).toEqual([{ nome: "A", cargo: "B" }]);
    expect(d.tipo).toBe("participante");
    expect(d.certificado_promotor).toBe("UFR");
  });
});

describe("gerarPdfCertificado", () => {
  const assinaturas = [
    { nome: "Profa. Dra. Maria Aparecida", cargo: "Coordenadora do evento" },
    { nome: "Prof. José Álvaro", cargo: "Diretor do instituto" },
    { nome: "Ana Sá", cargo: "Pró-reitora de extensão e cultura" },
  ];
  const e = { siteUrl: "https://eventos.exemplo.br" };
  const comeca = (b: Uint8Array) => new TextDecoder().decode(b.slice(0, 5));

  it("gera PDF válido com 20 atividades, acentos e caracteres estranhos (atividades na página 2)", async () => {
    const bytes = await gerarPdfCertificado(
      {
        ...base,
        nome: "Ângela Conceição Ünsal 日本 😀",
        documento: "RGA 202311900123",
        atividades: Array.from({ length: 20 }, (_, i) => at(i + 1, "palestra")),
        certificado_assinaturas: assinaturas,
        certificado_texto: "Texto adicional com acentuação: ação, emissão.",
        certificado_registro: "Registrado sob nº 123 no livro 4",
        certificado_promotor: "Secretaria de Inovação",
      },
      e,
    );
    expect(comeca(bytes)).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });

  it("uma atividade cabe na página 1", async () => {
    const bytes = await gerarPdfCertificado({ ...base, atividades: [at(1)], certificado_assinaturas: assinaturas }, e);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("mais de 4 atividades vão para a página 2", async () => {
    const bytes = await gerarPdfCertificado({ ...base, atividades: [1, 2, 3, 4, 5].map((n) => at(n)) }, e);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it("palestrante sem assinaturas", async () => {
    const bytes = await gerarPdfCertificado({ ...base, tipo: "palestrante", funcao: "palestrante", atividades: [at(1)] });
    expect(comeca(bytes).slice(0, 4)).toBe("%PDF");
  });

  it("texto de 1500 caracteres é válido; texto enorme usa páginas de informações complementares", async () => {
    const a = await gerarPdfCertificado({ ...base, certificado_texto: "Texto oficial com acentuação. ".repeat(50).slice(0, 1500) }, e);
    expect(comeca(a).slice(0, 4)).toBe("%PDF");
    const b = await gerarPdfCertificado({ ...base, certificado_texto: "Texto oficial com acentuação. ".repeat(200) }, e);
    expect((await PDFDocument.load(b)).getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it("nome longo não quebra o PDF", async () => {
    const bytes = await gerarPdfCertificado({ ...base, nome: "MARIA APARECIDA DOS SANTOS OLIVEIRA DE ALBUQUERQUE ".repeat(4) }, e);
    expect(comeca(bytes).slice(0, 4)).toBe("%PDF");
  });
});

describe("espaços entre trechos normal/negrito (regressão)", () => {
  const medir = (s: string) => s.length;
  const juntar = (segs: Segmento[]) =>
    quebrarSegmentos(segs.map((s) => ({ ...s, texto: paraWinAnsiTrecho(s.texto) })), 1000, medir)
      .map((linha) => linha.map((tr) => tr.texto).join(""))
      .join(" ");

  it("não cola a palavra em negrito na anterior", () => {
    expect(juntar([{ texto: "do evento " }, { texto: "II Semana", negrito: true }, { texto: ", promovido" }])).toBe(
      "do evento II Semana, promovido",
    );
    expect(juntar([{ texto: "carga horária total de " }, { texto: "4 horas", negrito: true }, { texto: "." }])).toBe(
      "carga horária total de 4 horas.",
    );
    expect(juntar([{ texto: "Palestra: ", negrito: true }, { texto: "Abertura" }])).toBe("Palestra: Abertura");
  });

  it("paraWinAnsi continua aparando; a versão de trecho preserva as pontas", () => {
    expect(paraWinAnsi("  a  b ")).toBe("a b");
    expect(paraWinAnsiTrecho("do evento ")).toBe("do evento ");
  });
});

describe("trechoPromotor", () => {
  it("usa o artigo digitado pelo organizador", () => {
    expect(trechoPromotor("pela Secretaria de Inovação")).toBe(", promovido pela Secretaria de Inovação");
    expect(trechoPromotor("pelo Curso de Engenharia de Minas")).toBe(", promovido pelo Curso de Engenharia de Minas");
  });
  it("sem preposição, usa 'por'; vazio some", () => {
    expect(trechoPromotor("UFR")).toBe(", promovido por UFR");
    expect(trechoPromotor("  ")).toBe("");
    expect(trechoPromotor(null)).toBe("");
  });
});

describe("horário de fim no retrato", () => {
  it("converterLinha mantém o fim quando existe e omite quando não", () => {
    const linha = (fim?: string) => ({
      codigo: "ABCD-EFGH-JKMN", tipo: "participante", nome: "X Y", carga_horaria_minutos: 60,
      emitido_em: "2026-10-02T12:00:00Z", evento_titulo: "E", data_inicio: "2026-10-02", data_fim: "2026-10-02",
      atividades: [{ titulo: "A", tipo: "palestra", inicio: "2026-10-02T12:00:00Z", carga_horaria_minutos: 60, ...(fim ? { fim } : {}) }],
    });
    expect(converterLinha(linha("2026-10-02T16:00:00Z")).atividades[0].fim).toBe("2026-10-02T16:00:00Z");
    expect(converterLinha(linha()).atividades[0].fim).toBeUndefined();
  });
});