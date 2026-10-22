import { z } from "zod";
import { inteiro, RE_UUID, textoOpcional } from "./schemas";

const assinaturaSchema = z.object({
  nome: z.string().trim().max(120, "O nome da assinatura pode ter no máximo 120 caracteres."),
  cargo: z.string().trim().max(120, "O cargo pode ter no máximo 120 caracteres."),
});

/** Texto, registro e até 3 assinaturas impressas (nome + cargo). */
export const certificadoConfigSchema = z
  .object({
    promotor: textoOpcional(200, "O campo Promovido por"),
    texto: textoOpcional(1500, "O texto complementar"),
    registro: textoOpcional(200, "O número de registro"),
    assinaturas: z.array(assinaturaSchema).max(3, "No máximo 3 assinaturas."),
  })
  .superRefine((v, ctx) => {
    // linha totalmente vazia é descartada; preenchida pela metade, não
    if (v.assinaturas.some((a) => (a.nome === "") !== (a.cargo === ""))) {
      ctx.addIssue({
        code: "custom",
        path: ["assinaturas"],
        message: "Cada assinatura precisa de nome e cargo.",
      });
    }
  })
  .transform((v) => ({
    certificado_promotor: v.promotor,
    certificado_texto: v.texto,
    certificado_registro: v.registro,
    certificado_assinaturas: v.assinaturas.filter((a) => a.nome !== ""),
  }));

export const equipeSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "O nome precisa ter pelo menos 3 letras.")
      .max(150, "O nome pode ter no máximo 150 caracteres."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "O e-mail é muito longo.")
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v), "Informe um e-mail válido."),
    tipo: z.enum(["palestrante", "organizacao"], "Escolha o tipo."),
    funcao: z
      .string()
      .trim()
      .min(3, "Descreva a função (ex.: Monitor(a)).")
      .max(120, "A função pode ter no máximo 120 caracteres."),
    atividade_id: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || RE_UUID.test(v), "Atividade inválida."),
    carga_horas: z.string().optional().default("0"),
    carga_minutos: z.string().optional().default("0"),
  })
  .superRefine((v, ctx) => {
    const total = inteiro(v.carga_horas || "0") * 60 + inteiro(v.carga_minutos || "0");
    if (!(total >= 1) || total > 720 * 60) {
      ctx.addIssue({
        code: "custom",
        path: ["carga_horas"],
        message: "Informe a carga horária (pelo menos 1 minuto).",
      });
    }
  })
  .transform((v) => ({
    nome: v.nome,
    email: v.email,
    tipo: v.tipo,
    funcao: v.funcao,
    atividade_id: v.atividade_id,
    carga_horaria_minutos: inteiro(v.carga_horas || "0") * 60 + inteiro(v.carga_minutos || "0"),
  }));

export const motivoRevogacaoSchema = z
  .string()
  .trim()
  .min(5, "Explique o motivo da revogação (pelo menos 5 letras).")
  .max(300, "O motivo pode ter no máximo 300 caracteres.");
