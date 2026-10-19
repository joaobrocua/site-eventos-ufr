"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirOrganizador } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { codigoDoErro, mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import type { ResultadoPresenca } from "@/lib/tipos";
import { lerCodigo } from "@/lib/presenca/codigo";
import type { RespostaPresenca } from "@/lib/presenca/tipos";

const RESULTADOS: ResultadoPresenca[] = [
  "registrado",
  "ja_registrado",
  "nao_inscrito",
  "inscricao_cancelada",
  "codigo_invalido",
];

const registrarSchema = z.object({
  codigo: z
    .string()
    .transform((v) => lerCodigo(v))
    .pipe(z.string({ error: "QR code não reconhecido." })),
  atividadeId: z.uuid({ error: "Atividade inválida." }),
  incluir: z.boolean().default(false),
});

const manualSchema = z.object({
  inscricaoId: z.uuid({ error: "Inscrição inválida." }),
  atividadeId: z.uuid({ error: "Atividade inválida." }),
  presente: z.boolean(),
});

// Atualiza contador e lista da página de presença em qualquer evento.
function atualizarTela() {
  revalidatePath("/painel/eventos/[id]/presenca", "page");
}

export async function registrarPresenca(entrada: {
  codigo: string;
  atividadeId: string;
  incluir?: boolean;
}): Promise<ResultadoAcao<RespostaPresenca>> {
  await exigirOrganizador();

  const parsed = registrarSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { codigo, atividadeId, incluir } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_presenca", {
    p_codigo: codigo,
    p_atividade_id: atividadeId,
    p_incluir: incluir,
  });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };

  const linha = data?.[0];
  const resultado = RESULTADOS.find((r) => r === linha?.resultado);
  if (!linha || !resultado) return { ok: false, erro: mensagemDoErro(null) };

  atualizarTela();
  return {
    ok: true,
    dados: {
      resultado,
      inscricaoId: linha.inscricao_id ?? null,
      nome: linha.nome ?? null,
      rga: linha.rga ?? null,
      presenteEm: linha.presente_em ?? null,
    },
  };
}

export async function marcarPresencaManual(entrada: {
  inscricaoId: string;
  atividadeId: string;
  presente: boolean;
}): Promise<ResultadoAcao<{ presenteEm: string | null }>> {
  await exigirOrganizador();

  const parsed = manualSchema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marcar_presenca_manual", {
    p_inscricao_id: parsed.data.inscricaoId,
    p_atividade_id: parsed.data.atividadeId,
    p_presente: parsed.data.presente,
  });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };

  atualizarTela();
  return { ok: true, dados: { presenteEm: data ?? null } };
}
