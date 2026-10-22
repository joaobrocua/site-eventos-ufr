import { redirect } from "next/navigation";
import { obterUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gerarPdfCertificado, obterSiteUrl } from "@/lib/certificados/pdf";
import { converterLinha } from "@/lib/certificados/tipos";

export const runtime = "nodejs";

const PAGINA_NAO_ENCONTRADO = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificado não encontrado</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#1a1a1f}a{color:#086ab1}</style>
</head><body>
<h1>Certificado não encontrado, revogado ou sem permissão</h1>
<p>Confira o código e se você entrou com a conta correta.</p>
<p><a href="/certificados/validar">Validar um certificado</a></p>
</body></html>`;

function naoEncontrado() {
  return new Response(PAGINA_NAO_ENCONTRADO, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

function erroInterno() {
  return new Response("Não foi possível gerar o certificado agora. Tente novamente em instantes.", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(_request: Request, ctx: RouteContext<"/certificados/[codigo]/pdf">) {
  const { codigo } = await ctx.params;

  const usuario = await obterUsuario();
  if (!usuario) redirect(`/entrar?proximo=${encodeURIComponent(`/certificados/${codigo}/pdf`)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dados_certificado", { p_codigo: codigo });
  if (error) return erroInterno();
  const linha = data?.[0];
  if (!linha) return naoEncontrado();

  const dados = converterLinha(linha);
  let pdf: Uint8Array;
  try {
    pdf = await gerarPdfCertificado(dados, { siteUrl: obterSiteUrl() });
  } catch {
    return erroInterno();
  }

  // O código vem do banco (XXXX-XXXX-XXXX): seguro para o nome do arquivo.
  const arquivo = dados.codigo.replace(/[^A-Z0-9-]/g, "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificado-${arquivo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
