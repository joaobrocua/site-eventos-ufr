import { describe, expect, it } from "vitest";
import { TAMANHO_MAX_PDF } from "@/lib/tipos";
import { cabecalhoEhPdf, validarConteudoPdf, validarPdf } from "./arquivo";
import { normalizarCoautores } from "./coautores";
import { acoesPermitidas } from "./permissoes";
import { estadoSubmissao } from "./prazo";
import { criarTrabalhoSchema } from "./schemas";

const valido = {
  titulo: "Um título válido",
  resumo: "r".repeat(60),
  palavrasChave: "",
  area: "",
  modalidade: "oral" as const,
  coautores: [] as string[],
};

describe("criarTrabalhoSchema", () => {
  it("aceita um trabalho completo e normaliza coautores", () => {
    const r = criarTrabalhoSchema([]).parse({
      ...valido,
      titulo: "  Um título válido  ",
      coautores: ["  Maria   Silva ", "", "   "],
    });
    expect(r.titulo).toBe("Um título válido");
    expect(r.coautores).toEqual(["Maria Silva"]);
  });

  it("recusa título e resumo curtos", () => {
    expect(criarTrabalhoSchema([]).safeParse({ ...valido, titulo: "abc" }).success).toBe(false);
    expect(criarTrabalhoSchema([]).safeParse({ ...valido, resumo: "r".repeat(49) }).success).toBe(false);
    expect(criarTrabalhoSchema([]).safeParse({ ...valido, resumo: "r".repeat(5001) }).success).toBe(false);
  });

  it("limita palavras-chave a 300", () => {
    expect(criarTrabalhoSchema([]).safeParse({ ...valido, palavrasChave: "a".repeat(301) }).success).toBe(false);
  });

  it("exige área quando o evento tem áreas, e dentre as listadas", () => {
    const s = criarTrabalhoSchema(["Saúde", "Educação"]);
    expect(s.safeParse(valido).success).toBe(false);
    expect(s.safeParse({ ...valido, area: "Outra" }).success).toBe(false);
    expect(s.safeParse({ ...valido, area: "Saúde" }).success).toBe(true);
  });

  it("coautor curto ou mais de 15 coautores é recusado", () => {
    const s = criarTrabalhoSchema([]);
    expect(s.safeParse({ ...valido, coautores: ["Al"] }).success).toBe(false);
    expect(s.safeParse({ ...valido, coautores: ["a".repeat(151)] }).success).toBe(false);
    const quinze = Array.from({ length: 15 }, (_, i) => `Pessoa ${i}`);
    expect(s.safeParse({ ...valido, coautores: quinze }).success).toBe(true);
    expect(s.safeParse({ ...valido, coautores: [...quinze, "Mais Um"] }).success).toBe(false);
  });

  it("recusa modalidade desconhecida", () => {
    expect(criarTrabalhoSchema([]).safeParse({ ...valido, modalidade: "banner" }).success).toBe(false);
  });
});

describe("normalizarCoautores", () => {
  it("limpa espaços e descarta vazios", () => {
    expect(normalizarCoautores([" Ana  Souza", "", "  "])).toEqual(["Ana Souza"]);
  });
});

describe("validarPdf", () => {
  const pdf = { name: "a.pdf", type: "application/pdf", size: 1000 };
  it("aceita PDF", () => expect(validarPdf(pdf)).toBeNull());
  it("aceita .pdf sem tipo informado", () => {
    expect(validarPdf({ name: "A.PDF", type: "", size: 10 })).toBeNull();
  });
  it("recusa outros tipos", () => {
    expect(validarPdf({ name: "a.docx", type: "application/msword", size: 10 })).not.toBeNull();
  });
  it("recusa vazio e grande demais; aceita exatamente o limite", () => {
    expect(validarPdf({ ...pdf, size: 0 })).not.toBeNull();
    expect(validarPdf({ ...pdf, size: TAMANHO_MAX_PDF + 1 })).not.toBeNull();
    expect(validarPdf({ ...pdf, size: TAMANHO_MAX_PDF })).toBeNull();
  });
});

describe("estadoSubmissao", () => {
  const base = { status: "publicado", submissoes_abertas: true, submissoes_ate: "2026-11-10T12:00:00-04:00" };
  const antes = new Date("2026-11-10T11:59:00-04:00");

  it("abre dentro do prazo, inclusive no último instante", () => {
    expect(estadoSubmissao(base, antes).aberto).toBe(true);
    expect(estadoSubmissao(base, new Date("2026-11-10T12:00:00-04:00")).aberto).toBe(true);
  });
  it("fecha depois do prazo", () => {
    const r = estadoSubmissao(base, new Date("2026-11-10T12:00:01-04:00"));
    expect(r).toMatchObject({ aberto: false, motivo: "prazo_encerrado" });
  });
  it("sem prazo definido fica aberto", () => {
    expect(estadoSubmissao({ ...base, submissoes_ate: null }, antes).aberto).toBe(true);
  });
  it("fecha se não está aberto ou não está publicado", () => {
    expect(estadoSubmissao({ ...base, submissoes_abertas: false }, antes)).toMatchObject({ motivo: "nao_aberta" });
    expect(estadoSubmissao({ ...base, status: "rascunho" }, antes)).toMatchObject({ motivo: "nao_publicado" });
    expect(estadoSubmissao({ ...base, status: "encerrado" }, antes)).toMatchObject({ motivo: "nao_publicado" });
  });
});

describe("conteúdo do PDF", () => {
  it("reconhece o cabeçalho %PDF", () => {
    expect(cabecalhoEhPdf("%PDF-")).toBe(true);
    expect(cabecalhoEhPdf("PK")).toBe(false);
    expect(cabecalhoEhPdf("")).toBe(false);
  });
  it("lê os primeiros bytes do arquivo", async () => {
    expect(await validarConteudoPdf(new Blob(["%PDF-1.7 resto"]))).toBeNull();
    expect(await validarConteudoPdf(new Blob(["<html>"]))).toBe("Este arquivo não parece ser um PDF.");
    expect(await validarConteudoPdf(new Blob([]))).not.toBeNull();
  });
});

describe("acoesPermitidas", () => {
  it("submetido com prazo aberto e sem PDF: edita, reenvia e retira", () => {
    expect(acoesPermitidas({ status: "submetido", arquivo_path: null }, true, true)).toEqual({
      editar: true,
      reenviarPdf: true,
      baixarPdf: false,
      retirar: true,
    });
  });
  it("com PDF não pede reenvio, mas baixa", () => {
    const a = acoesPermitidas({ status: "submetido", arquivo_path: "x.pdf" }, true, true);
    expect(a.reenviarPdf).toBe(false);
    expect(a.baixarPdf).toBe(true);
  });
  it("prazo encerrado impede editar e reenviar, mas em análise ainda retira", () => {
    const a = acoesPermitidas({ status: "submetido", arquivo_path: null }, false, true);
    expect(a).toMatchObject({ editar: false, reenviarPdf: false, retirar: true });
  });
  it("em análise retira mesmo com evento não publicado", () => {
    expect(acoesPermitidas({ status: "submetido", arquivo_path: null }, false, false).retirar).toBe(true);
  });
  it("aprovado só retira com o evento publicado", () => {
    expect(acoesPermitidas({ status: "aprovado", arquivo_path: "x" }, true, true)).toEqual({
      editar: false,
      reenviarPdf: false,
      baixarPdf: true,
      retirar: true,
    });
    expect(acoesPermitidas({ status: "aprovado", arquivo_path: "x" }, false, false).retirar).toBe(false);
  });
  it("reprovado e retirado não têm ações de alteração", () => {
    for (const status of ["reprovado", "retirado"]) {
      const a = acoesPermitidas({ status, arquivo_path: null }, true, true);
      expect(a).toEqual({ editar: false, reenviarPdf: false, baixarPdf: false, retirar: false });
    }
  });
});
