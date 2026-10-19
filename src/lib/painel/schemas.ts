import { z } from "zod";
import { TIPOS_ATIVIDADE } from "@/lib/tipos";
import { paraInstanteCuiaba } from "@/lib/datas";

// Mesmas regras do banco (supabase/migrations/..._schema_inicial.sql), com
// mensagens em português para a tela.

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identificador (uuid) vindo da URL ou do cliente. */
export const idSchema = z.string().regex(RE_UUID, "Identificador inválido.");

export const dataValida = (v: string) => {
  if (!RE_DATA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
};

const data = (rotulo: string) => z.string().refine(dataValida, `Informe a ${rotulo}.`);
const hora = (rotulo: string) => z.string().regex(RE_HORA, `Informe a ${rotulo}.`);

/** Texto opcional: vazio vira null. */
const textoOpcional = (max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo}: no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

export const eventoSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(3, "O título precisa ter pelo menos 3 letras.")
      .max(150, "O título pode ter no máximo 150 caracteres."),
    slug: z
      .string()
      .trim()
      .min(1, "Informe o endereço da página.")
      .max(80, "O endereço pode ter no máximo 80 caracteres.")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "O endereço só pode ter letras minúsculas sem acento, números e hífens (ex.: semana-de-minas-2026).",
      ),
    resumo: textoOpcional(300, "O resumo"),
    descricao: textoOpcional(10000, "A descrição"),
    local: textoOpcional(200, "O local"),
    data_inicio: data("data de início"),
    data_fim: data("data de término"),
    capa_url: z
      .string()
      .trim()
      .max(2000, "O link da imagem é muito longo.")
      .optional()
      .transform((v) => (v ? v : null))
      .refine(
        (v) => v === null || /^https?:\/\/\S+$/.test(v),
        "O link da imagem deve começar com http:// ou https://.",
      ),
  })
  .refine(
    (v) => !dataValida(v.data_inicio) || !dataValida(v.data_fim) || v.data_fim >= v.data_inicio,
    { path: ["data_fim"], message: "A data de término não pode ser antes da data de início." },
  );

export type EventoEntrada = z.output<typeof eventoSchema>;

export const statusEventoSchema = z.enum(["rascunho", "publicado", "encerrado"]);

/** Inscrições abertas + prazo opcional (data e hora de Cuiabá). */
export const inscricoesSchema = z
  .object({
    abertas: z.boolean(),
    ate_data: z.string().optional().default(""),
    ate_hora: z.string().optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (!v.ate_data && !v.ate_hora) return;
    if (!dataValida(v.ate_data) || !RE_HORA.test(v.ate_hora)) {
      ctx.addIssue({
        code: "custom",
        path: ["ate_data"],
        message: "Para definir um prazo, informe a data e a hora (ou deixe os dois vazios).",
      });
    }
  })
  .transform((v) => ({
    inscricoes_abertas: v.abertas,
    inscricoes_ate: v.ate_data && v.ate_hora ? paraInstanteCuiaba(v.ate_data, v.ate_hora) : null,
  }));

const inteiro = (v: string) => (/^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : NaN);

export const atividadeSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(3, "O título precisa ter pelo menos 3 letras.")
      .max(150, "O título pode ter no máximo 150 caracteres."),
    tipo: z.enum(TIPOS_ATIVIDADE as [string, ...string[]], "Escolha o tipo da atividade."),
    descricao: textoOpcional(5000, "A descrição"),
    palestrantes: textoOpcional(300, "Os palestrantes"),
    local: textoOpcional(200, "O local"),
    data: data("data da atividade"),
    hora_inicio: hora("hora de início"),
    hora_fim: hora("hora de término"),
    vagas_ilimitadas: z.boolean(),
    vagas: z.string().optional().default(""),
    carga_horas: z.string().optional().default("0"),
    carga_minutos: z.string().optional().default("0"),
  })
  .superRefine((v, ctx) => {
    if (RE_HORA.test(v.hora_inicio) && RE_HORA.test(v.hora_fim) && v.hora_fim <= v.hora_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["hora_fim"],
        message: "A hora de término precisa ser depois da hora de início.",
      });
    }
    if (!v.vagas_ilimitadas && !(inteiro(v.vagas) >= 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["vagas"],
        message: 'Informe o número de vagas (pelo menos 1) ou marque "Vagas ilimitadas".',
      });
    }
    const total = inteiro(v.carga_horas || "0") * 60 + inteiro(v.carga_minutos || "0");
    if (!(total >= 1) || total > 24 * 60 * 7) {
      ctx.addIssue({
        code: "custom",
        path: ["carga_horas"],
        message: "Informe a carga horária (pelo menos 1 minuto).",
      });
    }
  })
  .transform((v) => ({
    titulo: v.titulo,
    tipo: v.tipo,
    descricao: v.descricao,
    palestrantes: v.palestrantes,
    local: v.local,
    inicio: paraInstanteCuiaba(v.data, v.hora_inicio),
    fim: paraInstanteCuiaba(v.data, v.hora_fim),
    vagas: v.vagas_ilimitadas ? null : inteiro(v.vagas),
    carga_horaria_minutos: inteiro(v.carga_horas || "0") * 60 + inteiro(v.carga_minutos || "0"),
  }));

export type AtividadeEntrada = z.output<typeof atividadeSchema>;
