import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, escolherTransporte } from "./transporte";

/**
 * Envia os e-mails pendentes da fila (notificacoes_email). Cada lote é
 * reservado no banco de forma atômica: dois processos nunca enviam o mesmo.
 * Falhas ficam registradas e são tentadas de novo (até 5 vezes).
 */
export async function processarEmails(maxLotes = 5) {
  const transporte = escolherTransporte(process.env);
  // Sem serviço configurado, NÃO reserva: cada reserva gasta uma das 5 tentativas
  // e o e-mail se perderia sem nunca ter sido tentado de verdade.
  if (transporte.tipo === "nenhum") {
    throw new Error("Nenhum serviço de e-mail configurado (RESEND_API_KEY/EMAIL_FROM ou MAILPIT_URL).");
  }

  const supabase = createAdminClient();
  let enviados = 0;
  let falhas = 0;

  for (let lote = 0; lote < maxLotes; lote++) {
    const { data, error } = await supabase.rpc("reservar_emails", { p_limite: 20 });
    if (error) throw new Error(`Falha ao reservar e-mails: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      let erroEnvio: string | null = null;
      try {
        await enviarEmail(
          { para: item.email, nome: item.nome, assunto: item.assunto, texto: item.corpo },
          transporte,
        );
      } catch (e) {
        erroEnvio = e instanceof Error ? e.message : String(e);
      }

      const { error: erroConclusao } = await supabase.rpc(
        "concluir_email",
        erroEnvio ? { p_id: item.id, p_erro: erroEnvio } : { p_id: item.id },
      );
      if (erroConclusao) {
        // E-mail pode ter saído mas ficou "reservado": volta à fila em 5 min.
        console.error(`[emails] não foi possível registrar o e-mail ${item.id}:`, erroConclusao.message);
      }

      if (erroEnvio) {
        falhas++;
        console.error(`[emails] falha ao enviar o e-mail ${item.id}:`, erroEnvio);
      } else {
        enviados++;
      }
    }
  }

  return { enviados, falhas };
}

/**
 * Agenda o envio dos e-mails pendentes para DEPOIS da resposta (não atrasa a
 * tela). Chame logo após uma RPC que pode gerar e-mail: remover_atividade,
 * cancelar_inscricao, alterar vagas de atividade, decidir_trabalho.
 */
export function agendarEnvioDeEmails() {
  after(async () => {
    try {
      await processarEmails();
    } catch (e) {
      // A fila continua no banco; a rota /api/cron/emails tenta de novo.
      console.error("[emails]", e);
    }
  });
}
