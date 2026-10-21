import { z } from "zod";
import { MAX_COAUTORES, normalizarCoautores } from "./coautores";

export const MODALIDADES = ["oral", "poster"] as const;

/**
 * Campos do trabalho. `areas` é a lista de áreas temáticas do evento: se não
 * estiver vazia, a área é obrigatória e precisa ser uma delas.
 * (O banco confere tudo de novo; aqui é para avisar a pessoa antes.)
 */
export function criarTrabalhoSchema(areas: string[]) {
  return z
    .object({
      titulo: z
        .string()
        .trim()
        .min(5, "O título precisa ter pelo menos 5 caracteres.")
        .max(300, "O título pode ter no máximo 300 caracteres."),
      resumo: z
        .string()
        .trim()
        .min(50, "O resumo precisa ter pelo menos 50 caracteres.")
        .max(5000, "O resumo pode ter no máximo 5000 caracteres."),
      palavrasChave: z.string().trim().max(300, "As palavras-chave podem ter no máximo 300 caracteres."),
      area: z.string().trim().max(120),
      modalidade: z.enum(MODALIDADES, { error: "Escolha a modalidade." }),
      coautores: z
        .array(z.string())
        .transform(normalizarCoautores)
        .pipe(
          z
            .array(
              z
                .string()
                .min(3, "Cada coautor precisa de um nome com pelo menos 3 caracteres.")
                .max(150, "O nome de um coautor pode ter no máximo 150 caracteres."),
            )
            .max(MAX_COAUTORES, `Você pode informar no máximo ${MAX_COAUTORES} coautores.`),
        ),
    })
    .superRefine((v, ctx) => {
      if (areas.length > 0 && !areas.includes(v.area)) {
        ctx.addIssue({ code: "custom", path: ["area"], message: "Escolha uma área temática." });
      }
    });
}

export type TrabalhoEntrada = z.output<ReturnType<typeof criarTrabalhoSchema>>;
export type TrabalhoCampos = z.input<ReturnType<typeof criarTrabalhoSchema>>;
