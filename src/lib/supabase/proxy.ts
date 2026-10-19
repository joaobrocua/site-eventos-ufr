import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// A maioria das páginas é pública (lista de eventos, página do evento).
// Só estas exigem login; a checagem de ORGANIZADOR fica no layout de /painel.
const PREFIXOS_PRIVADOS = ["/minha-area", "/cadastro", "/painel"];

function ehPrivada(pathname: string) {
  return PREFIXOS_PRIVADOS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Renova a sessão do Supabase e manda para /entrar quem acessa área privada sem login. */
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
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
    return redirect;
  }

  return response;
}
