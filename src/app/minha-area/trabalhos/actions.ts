"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { codigoDoErro, mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import { BUCKET_TRABALHOS } from "@/lib/tipos";
import { criarTrabalhoSchema, type TrabalhoCampos } from "@/lib/trabalhos/schemas";

// A lista de áreas é conferida pelo banco; aqui validamos só o formato.
const schemaCampos = criarTrabalhoSchema([]);
const uuid = z.uuid({ error: "Identificação inválida." });

type Erro = { ok: false; erro: string; codigo?: ReturnType<typeof codigoDoErro> };

function falha(error: Parameters<typeof mensagemDoErro>[0]): Erro {
  return { ok: false, erro: mensagemDoErro(error), codigo: codigoDoErro(error) };
}

function atualizarTela() {
  revalidatePath("/minha-area/trabalhos");
}

/** Cria o trabalho (sem PDF ainda) e devolve o caminho onde o navegador deve gravar o PDF. */
export async function submeterTrabalho(
  eventoId: string,
  campos: TrabalhoCampos,
): Promise<ResultadoAcao<{ trabalhoId: string; caminho: string }>> {
  const perfil = await exigirPerfil("/minha-area/trabalhos");

  const id = uuid.safeParse(eventoId);
  const c = schemaCampos.safeParse(campos);
  if (!id.success || !c.success) {
    return { ok: false, erro: (id.error ?? c.error)?.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: trabalhoId, error } = await supabase.rpc("submeter_trabalho", {
    p_evento_id: id.data,
    p_titulo: c.data.titulo,
    p_resumo: c.data.resumo,
    p_palavras_chave: c.data.palavrasChave,
    p_area: c.data.area,
    p_modalidade: c.data.modalidade,
    p_coautores: c.data.coautores,
  });
  if (error || !trabalhoId) return falha(error);

  atualizarTela();
  // Mesmo formato de caminho_arquivo_trabalho(); montado aqui para não ter um segundo
  // passo que possa falhar depois do trabalho já estar criado.
  return { ok: true, dados: { trabalhoId, caminho: `${id.data}/${perfil.id}/${trabalhoId}.pdf` } };
}

export async function editarTrabalho(
  trabalhoId: string,
  campos: TrabalhoCampos,
): Promise<ResultadoAcao<{ caminho: string }>> {
  await exigirPerfil("/minha-area/trabalhos");

  const id = uuid.safeParse(trabalhoId);
  const c = schemaCampos.safeParse(campos);
  if (!id.success || !c.success) {
    return { ok: false, erro: (id.error ?? c.error)?.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("editar_trabalho", {
    p_trabalho_id: id.data,
    p_titulo: c.data.titulo,
    p_resumo: c.data.resumo,
    p_palavras_chave: c.data.palavrasChave,
    p_area: c.data.area,
    p_modalidade: c.data.modalidade,
    p_coautores: c.data.coautores,
  });
  if (error) return falha(error);

  const { data: caminho, error: erroCaminho } = await supabase.rpc("caminho_arquivo_trabalho", {
    p_trabalho_id: id.data,
  });
  atualizarTela();
  if (erroCaminho || !caminho) return falha(erroCaminho);
  return { ok: true, dados: { caminho } };
}

/** Caminho do PDF no Storage (para reenviar o arquivo de um trabalho já criado). */
export async function caminhoDoPdf(trabalhoId: string): Promise<ResultadoAcao<{ caminho: string }>> {
  await exigirPerfil("/minha-area/trabalhos");
  const id = uuid.safeParse(trabalhoId);
  if (!id.success) return { ok: false, erro: "Identificação inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("caminho_arquivo_trabalho", { p_trabalho_id: id.data });
  if (error || !data) return falha(error);
  return { ok: true, dados: { caminho: data } };
}

/** Depois do upload pelo navegador: o banco confere que o arquivo existe e grava o caminho. */
export async function confirmarPdf(trabalhoId: string): Promise<ResultadoAcao> {
  await exigirPerfil("/minha-area/trabalhos");
  const id = uuid.safeParse(trabalhoId);
  if (!id.success) return { ok: false, erro: "Identificação inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_arquivo_trabalho", { p_trabalho_id: id.data });
  if (error) return falha(error);

  atualizarTela();
  return { ok: true, dados: undefined };
}

export async function retirarTrabalho(trabalhoId: string): Promise<ResultadoAcao> {
  await exigirPerfil("/minha-area/trabalhos");
  const id = uuid.safeParse(trabalhoId);
  if (!id.success) return { ok: false, erro: "Identificação inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("retirar_trabalho", { p_trabalho_id: id.data });
  if (error) return falha(error);

  atualizarTela();
  return { ok: true, dados: undefined };
}

/** Link de download do próprio PDF, válido por 60 segundos. */
export async function urlDoMeuPdf(trabalhoId: string): Promise<ResultadoAcao<{ url: string }>> {
  const perfil = await exigirPerfil("/minha-area/trabalhos");
  const id = uuid.safeParse(trabalhoId);
  if (!id.success) return { ok: false, erro: "Identificação inválida." };

  const supabase = await createClient();
  const { data: trabalho, error } = await supabase
    .from("trabalhos")
    .select("arquivo_path")
    .eq("id", id.data)
    .eq("autor_id", perfil.id)
    .maybeSingle();
  if (error) return falha(error);
  if (!trabalho?.arquivo_path) return { ok: false, erro: "Este trabalho ainda não tem PDF." };

  const { data, error: erroUrl } = await supabase.storage
    .from(BUCKET_TRABALHOS)
    .createSignedUrl(trabalho.arquivo_path, 60);
  if (erroUrl || !data) return { ok: false, erro: "Não foi possível gerar o link do PDF. Tente de novo." };
  return { ok: true, dados: { url: data.signedUrl } };
}
