"use server";

import { revalidatePath } from "next/cache";
import { exigirOrganizador } from "@/lib/auth";
import { agendarEnvioDeEmails } from "@/lib/email/fila";
import { mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import { createClient } from "@/lib/supabase/server";
import {
  atividadeSchema,
  eventoSchema,
  idSchema,
  inscricoesSchema,
  statusEventoSchema,
} from "@/lib/painel/schemas";

// Toda ação começa com exigirOrganizador(): server actions podem ser chamadas
// diretamente, sem passar pelo layout. A RLS do banco é a última barreira.

const MSG_SLUG_REPETIDO = "Já existe um evento com esse endereço. Escolha outro.";

/** Atualiza as telas afetadas, inclusive as públicas. */
function revalidarEvento(id: string | null, ...slugs: (string | null | undefined)[]) {
  revalidatePath("/painel");
  if (id) revalidatePath(`/painel/eventos/${id}`);
  for (const slug of new Set(slugs)) if (slug) revalidatePath(`/eventos/${slug}`);
  revalidatePath("/eventos");
  revalidatePath("/");
}

const primeiroErro = (e: { issues: { message: string }[] }) => e.issues[0].message;

export async function criarEvento(entrada: unknown): Promise<ResultadoAcao<{ id: string }>> {
  await exigirOrganizador();
  const valido = eventoSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .insert({ ...valido.data, status: "rascunho" })
    .select("id")
    .single();
  if (error) {
    return { ok: false, erro: error.code === "23505" ? MSG_SLUG_REPETIDO : mensagemDoErro(error) };
  }

  revalidarEvento(data.id, valido.data.slug);
  return { ok: true, dados: { id: data.id } };
}

export async function atualizarEvento(id: string, entrada: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  const idValido = idSchema.safeParse(id);
  if (!idValido.success) return { ok: false, erro: primeiroErro(idValido.error) };
  const valido = eventoSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { data: atual } = await supabase.from("eventos").select("slug").eq("id", id).maybeSingle();
  if (!atual) return { ok: false, erro: "Evento não encontrado." };

  const { error } = await supabase.from("eventos").update(valido.data).eq("id", id);
  if (error) {
    return { ok: false, erro: error.code === "23505" ? MSG_SLUG_REPETIDO : mensagemDoErro(error) };
  }

  revalidarEvento(id, atual.slug, valido.data.slug);
  return { ok: true, dados: undefined };
}

export async function mudarStatusEvento(id: string, status: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  const idValido = idSchema.safeParse(id);
  const statusValido = statusEventoSchema.safeParse(status);
  if (!idValido.success || !statusValido.success) return { ok: false, erro: "Pedido inválido." };

  const supabase = await createClient();
  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", id).maybeSingle();
  if (!evento) return { ok: false, erro: "Evento não encontrado." };

  if (statusValido.data === "publicado") {
    const { count, error } = await supabase
      .from("atividades")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", id);
    if (error) return { ok: false, erro: mensagemDoErro(error) };
    if (!count) {
      return {
        ok: false,
        erro: "Para publicar, cadastre pelo menos uma atividade na aba Atividades.",
      };
    }
  }

  const { error } = await supabase.from("eventos").update({ status: statusValido.data }).eq("id", id);
  if (error) return { ok: false, erro: mensagemDoErro(error) };

  revalidarEvento(id, evento.slug);
  return { ok: true, dados: undefined };
}

export async function salvarInscricoes(id: string, entrada: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  const idValido = idSchema.safeParse(id);
  if (!idValido.success) return { ok: false, erro: primeiroErro(idValido.error) };
  const valido = inscricoesSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { data: evento, error } = await supabase
    .from("eventos")
    .update(valido.data)
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!evento) return { ok: false, erro: "Evento não encontrado." };

  revalidarEvento(id, evento.slug);
  return { ok: true, dados: undefined };
}

export async function excluirEvento(id: string): Promise<ResultadoAcao> {
  await exigirOrganizador();
  const idValido = idSchema.safeParse(id);
  if (!idValido.success) return { ok: false, erro: primeiroErro(idValido.error) };

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug, status")
    .eq("id", id)
    .maybeSingle();
  if (!evento) return { ok: false, erro: "Evento não encontrado." };
  if (evento.status !== "rascunho") {
    return { ok: false, erro: "Só é possível excluir eventos em rascunho. Volte o evento para rascunho primeiro." };
  }

  // Um rascunho que já teve inscrições (foi publicado e voltou) não pode sumir
  // levando junto os dados dos participantes.
  const { count, error: erroCount } = await supabase
    .from("inscricoes")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", id);
  if (erroCount) return { ok: false, erro: mensagemDoErro(erroCount) };
  if (count) {
    return { ok: false, erro: "Este evento já tem inscrições e não pode ser excluído. Use \"Encerrar evento\"." };
  }

  const { count: trabalhos, error: erroTrabalhos } = await supabase
    .from("trabalhos")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", id);
  if (erroTrabalhos) return { ok: false, erro: mensagemDoErro(erroTrabalhos) };
  if (trabalhos) {
    return { ok: false, erro: "Este evento já recebeu trabalhos e não pode ser excluído. Use \"Encerrar evento\"." };
  }

  const { data: removido, error } = await supabase
    .from("eventos")
    .delete()
    .eq("id", id)
    .eq("status", "rascunho")
    .select("id");
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!removido?.length) return { ok: false, erro: "Não foi possível excluir o evento." };

  revalidarEvento(id, evento.slug);
  return { ok: true, dados: undefined };
}

/** Cria (atividadeId = null) ou edita uma atividade do evento. */
export async function salvarAtividade(
  eventoId: string,
  atividadeId: string | null,
  entrada: unknown,
): Promise<ResultadoAcao> {
  await exigirOrganizador();
  const eventoValido = idSchema.safeParse(eventoId);
  if (!eventoValido.success) return { ok: false, erro: primeiroErro(eventoValido.error) };
  if (atividadeId !== null && !idSchema.safeParse(atividadeId).success) {
    return { ok: false, erro: "Identificador inválido." };
  }
  const valido = atividadeSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) return { ok: false, erro: "Evento não encontrado." };

  if (atividadeId === null) {
    const { error } = await supabase.from("atividades").insert({ ...valido.data, evento_id: eventoId });
    if (error) return { ok: false, erro: mensagemDoErro(error) };
  } else {
    // Reduzir as vagas abaixo do número de inscritos deixaria o evento inconsistente.
    if (valido.data.vagas !== null) {
      const { data: vagas } = await supabase.rpc("vagas_por_atividade", { p_evento_id: eventoId });
      const ocupadas = vagas?.find((v) => v.atividade_id === atividadeId)?.ocupadas ?? 0;
      if (valido.data.vagas < ocupadas) {
        return {
          ok: false,
          erro: `Esta atividade já tem ${ocupadas} inscritos. O número de vagas não pode ser menor que isso.`,
        };
      }
    }
    const { data: salvo, error } = await supabase
      .from("atividades")
      .update(valido.data)
      .eq("id", atividadeId)
      .eq("evento_id", eventoId)
      .select("id");
    if (error) return { ok: false, erro: mensagemDoErro(error) };
    if (!salvo?.length) return { ok: false, erro: "Atividade não encontrada." };
    // Mais vagas promovem a lista de espera no banco; os avisos saem por e-mail.
    agendarEnvioDeEmails();
  }

  revalidarEvento(eventoId, evento.slug);
  return { ok: true, dados: undefined };
}

export async function excluirAtividade(eventoId: string, atividadeId: string): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(eventoId).success || !idSchema.safeParse(atividadeId).success) {
    return { ok: false, erro: "Identificador inválido." };
  }

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) return { ok: false, erro: "Evento não encontrado." };

  const { data: removida, error } = await supabase
    .from("atividades")
    .delete()
    .eq("id", atividadeId)
    .eq("evento_id", eventoId)
    .select("id");
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!removida?.length) return { ok: false, erro: "Atividade não encontrada." };

  revalidarEvento(eventoId, evento.slug);
  return { ok: true, dados: undefined };
}
