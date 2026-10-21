"use server";

import { revalidatePath } from "next/cache";
import { exigirOrganizador } from "@/lib/auth";
import { agendarEnvioDeEmails } from "@/lib/email/fila";
import { mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import {
  configTrabalhosSchema,
  decisaoTrabalhoSchema,
  idSchema,
  sessaoTrabalhoSchema,
} from "@/lib/painel/schemas";
import { coautoresComoLista, type DetalheTrabalhoDados } from "@/lib/painel/trabalhos";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_TRABALHOS } from "@/lib/tipos";

// Mesmas regras das demais ações do painel: exigirOrganizador primeiro, zod,
// cliente com RLS do usuário.

const primeiroErro = (e: { issues: { message: string }[] }) => e.issues[0].message;

function revalidarTrabalhos(eventoId: string, slug: string) {
  revalidatePath(`/painel/eventos/${eventoId}`);
  revalidatePath(`/eventos/${slug}`);
  revalidatePath(`/eventos/${slug}/trabalhos`);
}

export async function salvarConfigTrabalhos(eventoId: string, entrada: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(eventoId).success) return { ok: false, erro: "Identificador inválido." };
  const valido = configTrabalhosSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .update(valido.data)
    .eq("id", eventoId)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!data) return { ok: false, erro: "Evento não encontrado." };

  revalidarTrabalhos(eventoId, data.slug);
  return { ok: true, dados: undefined };
}

/** Evento e endereço do trabalho, lidos no servidor (não confiamos no id enviado pelo navegador). */
async function eventoDoTrabalho(trabalhoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trabalhos")
    .select("evento_id, eventos(slug)")
    .eq("id", trabalhoId)
    .maybeSingle();
  if (!data) return null;
  const ev = Array.isArray(data.eventos) ? data.eventos[0] : data.eventos;
  return { eventoId: data.evento_id, slug: ev?.slug ?? null };
}

async function revalidarDoTrabalho(trabalhoId: string) {
  const ev = await eventoDoTrabalho(trabalhoId);
  if (!ev) return;
  if (ev.slug) revalidarTrabalhos(ev.eventoId, ev.slug);
  else revalidatePath(`/painel/eventos/${ev.eventoId}`);
}

export async function decidirTrabalho(trabalhoId: string, entrada: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(trabalhoId).success) return { ok: false, erro: "Identificador inválido." };
  const valido = decisaoTrabalhoSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  if (valido.data.status === "aprovado") {
    const { data: t } = await supabase.from("trabalhos").select("arquivo_path").eq("id", trabalhoId).maybeSingle();
    if (t && !t.arquivo_path) return { ok: false, erro: "O autor ainda não enviou o PDF." };
  }
  const { error } = await supabase.rpc("decidir_trabalho", {
    p_trabalho_id: trabalhoId,
    p_status: valido.data.status,
    p_parecer: valido.data.parecer,
  });
  if (error) return { ok: false, erro: mensagemDoErro(error) };

  // O autor recebe e-mail com a decisão.
  agendarEnvioDeEmails();
  await revalidarDoTrabalho(trabalhoId);
  return { ok: true, dados: undefined };
}

export async function vincularSessao(trabalhoId: string, entrada: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(trabalhoId).success) return { ok: false, erro: "Identificador inválido." };
  const valido = sessaoTrabalhoSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("vincular_trabalho_sessao", {
    p_trabalho_id: trabalhoId,
    p_atividade_id: valido.data.atividade_id as string,
    p_ordem: valido.data.ordem as number,
  });
  if (error) return { ok: false, erro: mensagemDoErro(error) };

  await revalidarDoTrabalho(trabalhoId);
  return { ok: true, dados: undefined };
}

/** Resumo, palavras-chave e coautores: carregados só quando o detalhe é aberto. */
export async function detalheTrabalho(trabalhoId: string): Promise<ResultadoAcao<DetalheTrabalhoDados>> {
  await exigirOrganizador();
  if (!idSchema.safeParse(trabalhoId).success) return { ok: false, erro: "Identificador inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trabalhos")
    .select("resumo, palavras_chave, coautores")
    .eq("id", trabalhoId)
    .maybeSingle();
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!data) return { ok: false, erro: "Trabalho não encontrado." };
  return {
    ok: true,
    dados: { resumo: data.resumo, palavras_chave: data.palavras_chave, coautores: coautoresComoLista(data.coautores) },
  };
}

/** URL assinada (60 s) do PDF, gerada com o cliente do usuário: a policy do Storage libera o organizador. */
export async function urlPdfTrabalho(trabalhoId: string): Promise<ResultadoAcao<{ url: string }>> {
  await exigirOrganizador();
  if (!idSchema.safeParse(trabalhoId).success) return { ok: false, erro: "Identificador inválido." };
  const supabase = await createClient();
  const { data: trabalho, error } = await supabase
    .from("trabalhos")
    .select("arquivo_path")
    .eq("id", trabalhoId)
    .maybeSingle();
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!trabalho?.arquivo_path) return { ok: false, erro: "O PDF ainda não foi enviado." };

  const { data, error: erroUrl } = await supabase.storage
    .from(BUCKET_TRABALHOS)
    .createSignedUrl(trabalho.arquivo_path, 60);
  if (erroUrl || !data) return { ok: false, erro: "Não foi possível abrir o PDF. Tente novamente." };
  return { ok: true, dados: { url: data.signedUrl } };
}
