import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processarEmails } from "@/lib/email/fila";

// Reenvio periódico dos e-mails que ficaram pendentes (rede caiu, serviço fora).
// Protegido por CRON_SECRET (a Vercel envia "Authorization: Bearer <segredo>").
function autorizado(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const resultado = await processarEmails();
    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ erro: "Falha ao processar e-mails." }, { status: 500 });
  }
}
