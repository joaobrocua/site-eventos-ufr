import { describe, expect, it } from "vitest";
import { atividadesPendentes, filtrarCertificados, moverItem, type CertificadoPainel } from "./certificados";
import { certificadoConfigSchema, equipeSchema, motivoRevogacaoSchema } from "./schemas-certificados";

describe("atividadesPendentes", () => {
  it("conta as que terminam depois de agora", () => {
    const agora = new Date("2026-11-10T12:00:00Z");
    const r = atividadesPendentes(
      [{ fim: "2026-11-10T11:00:00Z" }, { fim: "2026-11-10T13:00:00Z" }, { fim: "2026-11-11T13:00:00Z" }],
      agora,
    );
    expect(r).toBe(2);
    expect(atividadesPendentes([], agora)).toBe(0);
  });
});

describe("filtrarCertificados / moverItem", () => {
  const base = { tipo: "participante", carga_horaria_minutos: 60, revogado_em: null, revogado_motivo: null };
  const lista: CertificadoPainel[] = [
    { ...base, id: "1", codigo: "ABCD-EFGH-JKMN", nome: "João Álvares" },
    { ...base, id: "2", codigo: "2222-3333-4444", nome: "Maria" },
  ];
  it("busca por nome sem acento e por código", () => {
    expect(filtrarCertificados(lista, "joao")).toHaveLength(1);
    expect(filtrarCertificados(lista, "efgh-jk")[0].id).toBe("1");
    expect(filtrarCertificados(lista, "")).toHaveLength(2);
    expect(filtrarCertificados(lista, "zzzz")).toHaveLength(0);
  });
  it("reordena", () => {
    expect(moverItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moverItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("certificadoConfigSchema", () => {
  it("descarta linhas vazias e converte vazios em null", () => {
    const r = certificadoConfigSchema.parse({
      texto: "",
      registro: " 123 ",
      assinaturas: [
        { nome: " Ana ", cargo: "Coordenadora" },
        { nome: "", cargo: "" },
      ],
    });
    expect(r.certificado_texto).toBeNull();
    expect(r.certificado_promotor).toBeNull();
    expect(r.certificado_registro).toBe("123");
    expect(r.certificado_assinaturas).toEqual([{ nome: "Ana", cargo: "Coordenadora" }]);
  });
  it("rejeita assinatura pela metade, mais de 3 e texto longo", () => {
    expect(certificadoConfigSchema.safeParse({ assinaturas: [{ nome: "Ana", cargo: "" }] }).success).toBe(false);
    const a = { nome: "A", cargo: "B" };
    expect(certificadoConfigSchema.safeParse({ assinaturas: [a, a, a, a] }).success).toBe(false);
    expect(certificadoConfigSchema.safeParse({ promotor: "x".repeat(201), assinaturas: [] }).success).toBe(false);
    expect(certificadoConfigSchema.parse({ promotor: " Coordenação ", assinaturas: [] }).certificado_promotor).toBe("Coordenação");
    expect(certificadoConfigSchema.safeParse({ texto: "x".repeat(1501), assinaturas: [] }).success).toBe(false);
  });
});

describe("equipeSchema", () => {
  const ok = {
    nome: "Dra. Ana",
    email: "",
    tipo: "palestrante",
    funcao: "Ministrante",
    atividade_id: "",
    carga_horas: "2",
    carga_minutos: "30",
  };
  it("converte vazios, e-mail minúsculo e carga em minutos", () => {
    const r = equipeSchema.parse({ ...ok, email: " ANA@X.com " });
    expect(r.email).toBe("ana@x.com");
    expect(r.atividade_id).toBeNull();
    expect(r.carga_horaria_minutos).toBe(150);
    expect(equipeSchema.parse(ok).email).toBeNull();
  });
  it("rejeita e-mail inválido, tipo errado, atividade inválida e carga zero", () => {
    expect(equipeSchema.safeParse({ ...ok, email: "abc" }).success).toBe(false);
    expect(equipeSchema.safeParse({ ...ok, tipo: "x" }).success).toBe(false);
    expect(equipeSchema.safeParse({ ...ok, carga_horas: "0", carga_minutos: "0" }).success).toBe(false);
    expect(equipeSchema.safeParse({ ...ok, atividade_id: "nao-uuid" }).success).toBe(false);
  });
});

describe("motivoRevogacaoSchema", () => {
  it("exige pelo menos 5 caracteres", () => {
    expect(motivoRevogacaoSchema.safeParse("   abc ").success).toBe(false);
    expect(motivoRevogacaoSchema.safeParse("Presença errada").success).toBe(true);
  });
});

describe("limites alinhados ao banco", () => {
  const ok = { nome: "Dra. Ana", tipo: "palestrante", funcao: "Ministrante", carga_horas: "1", carga_minutos: "0" };
  it("carga máxima de 720 h", () => {
    expect(equipeSchema.safeParse({ ...ok, carga_horas: "720" }).success).toBe(true);
    expect(equipeSchema.safeParse({ ...ok, carga_horas: "720", carga_minutos: "1" }).success).toBe(false);
  });
  it("e-mail recusa vírgula, ponto e vírgula, < e > e exige domínio com ponto", () => {
    for (const email of ["a,b@x.com", "a;b@x.com", "<a>@x.com", "a@x", "a b@x.com"]) {
      expect(equipeSchema.safeParse({ ...ok, email }).success, email).toBe(false);
    }
    expect(equipeSchema.safeParse({ ...ok, email: "a@x.com.br" }).success).toBe(true);
  });
});
