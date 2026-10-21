import { describe, expect, it } from "vitest";
import { coautoresComoLista, contarPorStatus, filtrarTrabalhos, type TrabalhoPainel } from "./trabalhos";
import { configTrabalhosSchema, decisaoTrabalhoSchema, sessaoTrabalhoSchema } from "./schemas";

const base = {
  modalidade: "oral", temArquivo: false,
  parecer: null, atividade_id: null, ordem_apresentacao: null, autor_email: "a@x.com",
};
const lista: TrabalhoPainel[] = [
  { ...base, id: "1", titulo: "Mineração sustentável", autor: "João Álvares", area: "Minas", status: "submetido" },
  { ...base, id: "2", titulo: "Geotecnia", autor: "Maria", area: "Geo", status: "aprovado" },
  { ...base, id: "3", titulo: "Outro", autor: "Ana", area: "Geo", status: "retirado" },
];

describe("filtrarTrabalhos / contarPorStatus", () => {
  it("busca sem acento, por status e por área", () => {
    expect(filtrarTrabalhos(lista, "mineracao", null, null).map((t) => t.id)).toEqual(["1"]);
    expect(filtrarTrabalhos(lista, "joao alvares", null, null)).toHaveLength(1);
    expect(filtrarTrabalhos(lista, "", "aprovado", null).map((t) => t.id)).toEqual(["2"]);
    expect(filtrarTrabalhos(lista, "", null, "Geo")).toHaveLength(2);
  });
  it("conta por status", () => {
    expect(contarPorStatus(lista)).toEqual({ submetido: 1, aprovado: 1, reprovado: 0, retirado: 1 });
  });
  it("coautores aceita só textos", () => {
    expect(coautoresComoLista(["A", 3, " "])).toEqual(["A"]);
    expect(coautoresComoLista({})).toEqual([]);
  });
});

describe("configTrabalhosSchema", () => {
  it("limpa áreas vazias/repetidas e converte prazo", () => {
    const r = configTrabalhosSchema.parse({
      abertas: true, ate_data: "2026-11-01", ate_hora: "23:59", instrucoes: "", areas: [" Minas ", "minas", "", "Geo"],
    });
    expect(r.areas_tematicas).toEqual(["Minas", "Geo"]);
    expect(r.submissoes_ate).toBe("2026-11-01T23:59:00-04:00");
    expect(r.submissao_instrucoes).toBeNull();
  });
  it("rejeita área longa, mais de 30 áreas e prazo incompleto", () => {
    const ok = { abertas: false, ate_data: "", ate_hora: "", instrucoes: "", areas: [] as string[] };
    expect(configTrabalhosSchema.safeParse({ ...ok, areas: ["x".repeat(121)] }).success).toBe(false);
    expect(configTrabalhosSchema.safeParse({ ...ok, areas: Array.from({ length: 31 }, (_, i) => `a${i}`) }).success).toBe(false);
    expect(configTrabalhosSchema.safeParse({ ...ok, ate_data: "2026-11-01" }).success).toBe(false);
  });
});

describe("decisão e sessão", () => {
  it("valida decisão e parecer", () => {
    expect(decisaoTrabalhoSchema.safeParse({ status: "aprovado" }).success).toBe(true);
    expect(decisaoTrabalhoSchema.safeParse({ status: "retirado" }).success).toBe(false);
    expect(decisaoTrabalhoSchema.safeParse({ status: "aprovado", parecer: "x".repeat(3001) }).success).toBe(false);
  });
  it("valida ordem", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(sessaoTrabalhoSchema.parse({ atividade_id: id, ordem: "3" }).ordem).toBe(3);
    expect(sessaoTrabalhoSchema.parse({ atividade_id: null, ordem: "" }).ordem).toBeNull();
    expect(sessaoTrabalhoSchema.safeParse({ atividade_id: id, ordem: "0" }).success).toBe(false);
    expect(sessaoTrabalhoSchema.safeParse({ atividade_id: id, ordem: "abc" }).success).toBe(false);
  });
});
