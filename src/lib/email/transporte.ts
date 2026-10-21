// Como o e-mail sai, escolhido pelas variáveis de ambiente:
//   * RESEND_API_KEY + EMAIL_FROM  -> Resend (produção)
//   * MAILPIT_URL                  -> Mailpit local (desenvolvimento; nada sai para a internet)
//   * nenhum                       -> erro: o e-mail fica PENDENTE na fila, nunca "enviado" de mentira.

export type Mensagem = { para: string; nome?: string | null; assunto: string; texto: string };

export type Transporte =
  | { tipo: "resend"; chave: string; remetente: string }
  | { tipo: "mailpit"; url: string; remetente: string }
  | { tipo: "nenhum" };

const REMETENTE_PADRAO = "Eventos UFR <nao-responda@eventos.ufr.test>";

export function escolherTransporte(env: Record<string, string | undefined>): Transporte {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return { tipo: "resend", chave: env.RESEND_API_KEY, remetente: env.EMAIL_FROM };
  }
  if (env.MAILPIT_URL) {
    return { tipo: "mailpit", url: env.MAILPIT_URL.replace(/\/$/, ""), remetente: env.EMAIL_FROM || REMETENTE_PADRAO };
  }
  return { tipo: "nenhum" };
}

/** "Nome <email@x>" -> { Name, Email }. */
export function separarRemetente(remetente: string) {
  const m = remetente.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { Name: m[1], Email: m[2] } : { Name: "", Email: remetente.trim() };
}

const RODAPE =
  "\n\n—\nEventos UFR · Universidade Federal de Rondonópolis\nEste é um e-mail automático; não responda.";

export function montarTexto(m: Mensagem) {
  const saudacao = m.nome ? `Olá, ${m.nome.split(/\s+/)[0]}!\n\n` : "Olá!\n\n";
  return saudacao + m.texto + RODAPE;
}

export async function enviarEmail(m: Mensagem, transporte: Transporte, fetcher: typeof fetch = fetch) {
  const texto = montarTexto(m);

  if (transporte.tipo === "resend") {
    const r = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${transporte.chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: transporte.remetente, to: [m.para], subject: m.assunto, text: texto }),
    });
    if (!r.ok) throw new Error(`Resend respondeu ${r.status}`);
    return;
  }

  if (transporte.tipo === "mailpit") {
    const r = await fetcher(`${transporte.url}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: separarRemetente(transporte.remetente),
        To: [{ Email: m.para, Name: m.nome ?? "" }],
        Subject: m.assunto,
        Text: texto,
      }),
    });
    if (!r.ok) throw new Error(`Mailpit respondeu ${r.status}`);
    return;
  }

  throw new Error("Nenhum serviço de e-mail configurado (RESEND_API_KEY/EMAIL_FROM ou MAILPIT_URL).");
}
