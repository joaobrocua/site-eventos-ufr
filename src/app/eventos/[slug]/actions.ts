"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obterUsuario } from "@/lib/auth";
import { codigoDoErro, mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import { agendarEnvioDeEmails } from "@/lib/email/fila";
import { createClient } from "@/lib/supabase/server";

const SEM_SESSAO = "Sua sessão expirou. Entre novamente.";
const DADOS_INVALIDOS = "Não foi possível processar o pedido. Atualize a página e tente de novo.";

const idSchema = z.uuid();
const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const inscreverSchema = z.object({
  eventoId: idSchema,
  slug: slugSchema,
  atividades: z.array(idSchema).min(1, "Escolha pelo menos uma atividade.").max(100),
});

function atualizarTelas(slug: string) {
  revalidatePath(`/eventos/${slug}`);
  revalidatePath("/minha-area");
}

/** Inscreve (ou adiciona atividades). A função do banco é tudo-ou-nada. */
export async function inscrever(entrada: unknown): Promise<ResultadoAcao> {
  if (!(await obterUsuario())) return { ok: false, erro: SEM_SESSAO };
  const v = inscreverSchema.safeParse(entrada);
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? DADOS_INVALIDOS };

  const supabase = await createClient();
  const { error } = await supabase.rpc("inscrever_em_evento", {
    p_evento_id: v.data.eventoId,
    p_atividades: [...new Set(v.data.atividades)],
  });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };

  atualizarTelas(v.data.slug);
  return { ok: true, dados: undefined };
}

export async function removerAtividade(entrada: unknown): Promise<ResultadoAcao> {
  if (!(await obterUsuario())) return { ok: false, erro: SEM_SESSAO };
  const v = z.object({ atividadeId: idSchema, slug: slugSchema }).safeParse(entrada);
  if (!v.success) return { ok: false, erro: DADOS_INVALIDOS };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remover_atividade", { p_atividade_id: v.data.atividadeId });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };
  // Liberar a vaga pode ter promovido alguém da fila: dispara os avisos por e-mail.
  agendarEnvioDeEmails();

  atualizarTelas(v.data.slug);
  return { ok: true, dados: undefined };
}

export async function cancelarInscricao(entrada: unknown): Promise<ResultadoAcao> {
  if (!(await obterUsuario())) return { ok: false, erro: SEM_SESSAO };
  const v = z.object({ eventoId: idSchema, slug: slugSchema }).safeParse(entrada);
  if (!v.success) return { ok: false, erro: DADOS_INVALIDOS };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_inscricao", { p_evento_id: v.data.eventoId });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };
  agendarEnvioDeEmails();

  atualizarTelas(v.data.slug);
  return { ok: true, dados: undefined };
}

/** Entra na fila de uma atividade lotada. Devolve a posição (1 = próximo a ser chamado). */
export async function entrarListaEspera(entrada: unknown): Promise<ResultadoAcao<{ posicao: number }>> {
  if (!(await obterUsuario())) return { ok: false, erro: SEM_SESSAO };
  const v = z.object({ atividadeId: idSchema, slug: slugSchema }).safeParse(entrada);
  if (!v.success) return { ok: false, erro: DADOS_INVALIDOS };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("entrar_lista_espera", { p_atividade_id: v.data.atividadeId });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };

  atualizarTelas(v.data.slug);
  return { ok: true, dados: { posicao: Number(data) } };
}

export async function sairListaEspera(entrada: unknown): Promise<ResultadoAcao> {
  if (!(await obterUsuario())) return { ok: false, erro: SEM_SESSAO };
  const v = z.object({ atividadeId: idSchema, slug: slugSchema }).safeParse(entrada);
  if (!v.success) return { ok: false, erro: DADOS_INVALIDOS };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sair_lista_espera", { p_atividade_id: v.data.atividadeId });
  if (error) return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };

  atualizarTelas(v.data.slug);
  return { ok: true, dados: undefined };
}
