import { z } from "zod";

const soDigitos = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : v);
const vazioParaNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const perfilSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(150, "Nome muito longo.")
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome (vai no certificado)."),
  rga: z.preprocess(
    (v) => vazioParaNull(soDigitos(v)),
    z.string().regex(/^\d{6,20}$/, "RGA deve ter só números (6 a 20 dígitos).").nullable(),
  ),
  curso: z.preprocess(
    vazioParaNull,
    z.string().trim().max(120, "Nome do curso muito longo.").nullable(),
  ),
  telefone: z.preprocess(
    (v) => vazioParaNull(soDigitos(v)),
    z.string().regex(/^\d{10,13}$/, "Telefone com DDD, só números.").nullable(),
  ),
});

export type PerfilEntrada = z.infer<typeof perfilSchema>;
