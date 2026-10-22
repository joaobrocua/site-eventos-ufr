"use server";

import { revalidatePath } from "next/cache";
import { exigirOrganizador } from "@/lib/auth";
import { agendarEnvioDeEmails } from "@/lib/email/fila";
import { mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import { idSchema } from "@/lib/painel/schemas";
import {
  certificadoConfigSchema,
  equipeSchema,
  motivoRevogacaoSchema,
} from "@/lib/painel/schemas-certificados";
import { createClient } from "@/lib/supabase/server";

// Mesmas regras das demais ações do painel: exigirOrganizador primeiro, zod,
// cliente com a RLS do usuário.

const primeiroErro = (e: { issues: { message: string }[] }) => e.issues[0].message;

function revalidarCertificados(eventoId: string) {
  revalidatePath(`/painel/eventos/${eventoId}`);
  revalidatePath("/minha-area/certificados");
}

export async function salvarConfigCertificado(eventoId: string, entrada: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(eventoId).success) return { ok: false, erro: "Identificador inválido." };
  const valido = certificadoConfigSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .update(valido.data)
    .eq("id", eventoId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!data) return { ok: false, erro: "Evento não encontrado." };

  revalidarCertificados(eventoId);
  return { ok: true, dados: undefined };
}

/** Cria (membroId = null) ou edita um membro da equipe. */
export async function salvarMembroEquipe(
  eventoId: string,
  membroId: string | null,
  entrada: unknown,
): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(eventoId).success) return { ok: false, erro: "Identificador inválido." };
  if (membroId !== null && !idSchema.safeParse(membroId).success) {
    return { ok: false, erro: "Identificador inválido." };
  }
  const valido = equipeSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  if (membroId === null) {
    const { error } = await supabase.from("equipe_evento").insert({ ...valido.data, evento_id: eventoId });
    if (error) return { ok: false, erro: mensagemDoErro(error) };
  } else {
    const { data, error } = await supabase
      .from("equipe_evento")
      .update(valido.data)
      .eq("id", membroId)
      .eq("evento_id", eventoId)
      .select("id");
    if (error) return { ok: false, erro: mensagemDoErro(error) };
    if (!data?.length) return { ok: false, erro: "Pessoa não encontrada." };
  }

  revalidarCertificados(eventoId);
  return { ok: true, dados: undefined };
}

export async function excluirMembroEquipe(eventoId: string, membroId: string): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(eventoId).success || !idSchema.safeParse(membroId).success) {
    return { ok: false, erro: "Identificador inválido." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipe_evento")
    .delete()
    .eq("id", membroId)
    .eq("evento_id", eventoId)
    .select("id");
  if (error) return { ok: false, erro: mensagemDoErro(error) };
  if (!data?.length) return { ok: false, erro: "Pessoa não encontrada." };

  revalidarCertificados(eventoId);
  return { ok: true, dados: undefined };
}

export type ResumoLiberacao = { novos: number; atualizados: number; revogados: number };

/** Libera (ou atualiza) os certificados do evento. Os e-mails saem pela fila. */
export async function liberarCertificados(eventoId: string): Promise<ResultadoAcao<ResumoLiberacao>> {
  await exigirOrganizador();
  if (!idSchema.safeParse(eventoId).success) return { ok: false, erro: "Identificador inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("liberar_certificados", { p_evento_id: eventoId });
  if (error) return { ok: false, erro: mensagemDoErro(error) };

  agendarEnvioDeEmails();
  revalidarCertificados(eventoId);
  const r = data?.[0];
  return {
    ok: true,
    dados: { novos: r?.novos ?? 0, atualizados: r?.atualizados ?? 0, revogados: r?.revogados ?? 0 },
  };
}

export async function revogarCertificado(certificadoId: string, motivo: unknown): Promise<ResultadoAcao> {
  await exigirOrganizador();
  if (!idSchema.safeParse(certificadoId).success) return { ok: false, erro: "Identificador inválido." };
  const valido = motivoRevogacaoSchema.safeParse(motivo);
  if (!valido.success) return { ok: false, erro: primeiroErro(valido.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revogar_certificado", {
    p_certificado_id: certificadoId,
    p_motivo: valido.data,
  });
  if (error) return { ok: false, erro: mensagemDoErro(error) };

  // O evento vem do próprio certificado, não do navegador.
  const { data: cert } = await supabase.from("certificados").select("evento_id").eq("id", certificadoId).maybeSingle();
  if (cert) revalidarCertificados(cert.evento_id);
  return { ok: true, dados: undefined };
}
