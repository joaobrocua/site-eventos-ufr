import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { gerarNonce, montarCsp } from "@/lib/csp";

// A maioria das páginas é pública (lista de eventos, página do evento).
// Só estas exigem login; a checagem de ORGANIZADOR fica no layout de /painel.
const PREFIXOS_PRIVADOS = ["/minha-area", "/cadastro", "/painel"];

function ehPrivada(pathname: string) {
  return PREFIXOS_PRIVADOS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renova a sessão do Supabase, aplica a Content-Security-Policy (com nonce novo
 * a cada requisição) e manda para /entrar quem acessa área privada sem login.
 */
export async function atualizarSessao(request: NextRequest) {
  const nonce = gerarNonce();
  const csp = montarCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    desenvolvimento: process.env.NODE_ENV === "development",
  });

  // O Next.js lê a CSP e o nonce dos cabeçalhos da REQUISIÇÃO para marcar os
  // próprios <script>. Recriado sempre que o Supabase renova cookies, para que
  // a página também receba os cookies novos.
  const seguir = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return NextResponse.next({ request: { headers } });
  };

  let response = seguir();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = seguir();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() valida a assinatura do JWT (não use getSession() para decidir acesso).
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;

  if (!logado && ehPrivada(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?proximo=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set("content-security-policy", csp);
    return redirect;
  }

  response.headers.set("content-security-policy", csp);
  return response;
}
