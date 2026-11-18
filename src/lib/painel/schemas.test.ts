import { describe, expect, it } from "vitest";
import { atividadeSchema, eventoSchema, idSchema, inscricoesSchema } from "./schemas";

const eventoOk = {
  titulo: "Semana de Minas",
  slug: "semana-de-minas",
  resumo: "",
  descricao: "",
  local: "Auditório",
  data_inicio: "2026-11-10",
  data_fim: "2026-11-12",
};

describe("eventoSchema", () => {
  it("aceita um evento válido e converte vazios em null", () => {
    const r = eventoSchema.parse(eventoOk);
    expect(r.resumo).toBeNull();
    expect(r.local).toBe("Auditório");
  });

  it.each(["Com Maiúscula", "com espaço", "-inicio", "fim-", "duplo--hifen", "acentuação"])(
    "rejeita endereço %j",
    (slug) => {
      expect(eventoSchema.safeParse({ ...eventoOk, slug }).success).toBe(false);
    },
  );

  it("rejeita endereço com mais de 80 caracteres", () => {
    expect(eventoSchema.safeParse({ ...eventoOk, slug: "a".repeat(81) }).success).toBe(false);
    expect(eventoSchema.safeParse({ ...eventoOk, slug: "a".repeat(80) }).success).toBe(true);
  });

  it("rejeita data_fim antes de data_inicio", () => {
    const r = eventoSchema.safeParse({ ...eventoOk, data_fim: "2026-11-09" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path).toEqual(["data_fim"]);
    expect(eventoSchema.safeParse({ ...eventoOk, data_fim: "2026-11-10" }).success).toBe(true);
  });

  it("rejeita data inexistente e resumo longo", () => {
    expect(eventoSchema.safeParse({ ...eventoOk, data_inicio: "2026-02-30" }).success).toBe(false);
    expect(eventoSchema.safeParse({ ...eventoOk, resumo: "x".repeat(301) }).success).toBe(false);
  });

  it("ignora capa_url (campo fora do formulário: um link externo seria bloqueado pela CSP)", () => {
    const r = eventoSchema.parse({ ...eventoOk, capa_url: "https://x.com/a.png" });
    expect(r).not.toHaveProperty("capa_url");
  });

  it("rejeita título curto", () => {
    expect(eventoSchema.safeParse({ ...eventoOk, titulo: "ab" }).success).toBe(false);
  });
});

describe("inscricoesSchema", () => {
  it("converte o prazo para horário de Cuiabá", () => {
    const r = inscricoesSchema.parse({ abertas: true, ate_data: "2026-11-09", ate_hora: "23:59" });
    expect(r.inscricoes_ate).toBe("2026-11-09T23:59:00-04:00");
  });

  it("sem prazo vira null e exige data e hora juntas", () => {
    expect(inscricoesSchema.parse({ abertas: false }).inscricoes_ate).toBeNull();
    const parcial = inscricoesSchema.safeParse({ abertas: true, ate_data: "2026-11-09", ate_hora: "" });
    expect(parcial.success).toBe(false);
  });
});

const atividadeOk = {
  titulo: "Palestra de abertura",
  tipo: "palestra",
  descricao: "",
  palestrantes: "Dra. Ana",
  local: "",
  data: "2026-11-10",
  hora_inicio: "19:00",
  hora_fim: "21:30",
  vagas_ilimitadas: true,
  vagas: "",
  carga_horas: "2",
  carga_minutos: "30",
};

describe("atividadeSchema", () => {
  it("converte horários de Cuiabá, vagas ilimitadas e carga horária", () => {
    const r = atividadeSchema.parse(atividadeOk);
    expect(r.inicio).toBe("2026-11-10T19:00:00-04:00");
    expect(r.fim).toBe("2026-11-10T21:30:00-04:00");
    expect(r.vagas).toBeNull();
    expect(r.carga_horaria_minutos).toBe(150);
    expect(r.local).toBeNull();
  });

  it("exige vagas >= 1 quando não são ilimitadas", () => {
    expect(atividadeSchema.safeParse({ ...atividadeOk, vagas_ilimitadas: false, vagas: "" }).success).toBe(false);
    expect(atividadeSchema.safeParse({ ...atividadeOk, vagas_ilimitadas: false, vagas: "0" }).success).toBe(false);
    const r = atividadeSchema.parse({ ...atividadeOk, vagas_ilimitadas: false, vagas: "40" });
    expect(r.vagas).toBe(40);
  });

  it("rejeita fim antes do início, tipo inválido e carga zerada", () => {
    expect(atividadeSchema.safeParse({ ...atividadeOk, hora_fim: "19:00" }).success).toBe(false);
    expect(atividadeSchema.safeParse({ ...atividadeOk, tipo: "show" }).success).toBe(false);
    expect(
      atividadeSchema.safeParse({ ...atividadeOk, carga_horas: "0", carga_minutos: "0" }).success,
    ).toBe(false);
  });
});

describe("idSchema", () => {
  it("aceita uuid e rejeita lixo", () => {
    expect(idSchema.safeParse("123e4567-e89b-12d3-a456-426614174000").success).toBe(true);
    expect(idSchema.safeParse("1; drop table").success).toBe(false);
  });
});
