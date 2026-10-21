"use client";

import { createClient } from "@/lib/supabase/client";
import { BUCKET_TRABALHOS } from "@/lib/tipos";
import { caminhoDoPdf, confirmarPdf } from "@/app/minha-area/trabalhos/actions";

/**
 * Grava o PDF direto do navegador no Storage (não passa por server action por
 * causa do limite de tamanho do corpo). Devolve a mensagem de erro, ou null se deu certo.
 * A policy do Storage confere dono, situação "em análise" e prazo.
 */
export async function gravarPdf(caminho: string, arquivo: File): Promise<string | null> {
  try {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(BUCKET_TRABALHOS)
      .upload(caminho, arquivo, { upsert: true, contentType: "application/pdf" });
    if (!error) return null;
    if (/row-level security|unauthorized|forbidden/i.test(error.message)) {
      return "O prazo de envio terminou ou este trabalho não aceita mais arquivo.";
    }
    return "Não foi possível enviar o PDF. Confira a internet e tente de novo.";
  } catch {
    return "Não foi possível enviar o PDF. Confira a internet e tente de novo.";
  }
}

/** Upload + confirmação no banco. Devolve a mensagem de erro, ou null. */
export async function enviarEConfirmarPdf(
  trabalhoId: string,
  caminho: string,
  arquivo: File,
): Promise<string | null> {
  const erroUpload = await gravarPdf(caminho, arquivo);
  if (erroUpload) return erroUpload;
  try {
    const r = await confirmarPdf(trabalhoId);
    return r.ok ? null : r.erro;
  } catch {
    return "Não foi possível confirmar o PDF. Confira a internet e tente de novo.";
  }
}

/** Reenvio de um PDF de trabalho que já existe. */
export async function reenviarPdf(trabalhoId: string, arquivo: File): Promise<string | null> {
  const c = await caminhoDoPdf(trabalhoId);
  if (!c.ok) return c.erro;
  return enviarEConfirmarPdf(trabalhoId, c.dados.caminho, arquivo);
}

/** Apaga o PDF do Storage (usado ao retirar o trabalho). Falha só vai para o console. */
export async function apagarPdf(caminho: string): Promise<void> {
  try {
    const { error } = await createClient().storage.from(BUCKET_TRABALHOS).remove([caminho]);
    if (error) console.error("Não foi possível apagar o PDF do trabalho retirado:", error.message);
  } catch (e) {
    console.error("Não foi possível apagar o PDF do trabalho retirado:", e);
  }
}
