import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/tipos";

export type Papel = "admin" | "organizador";

/** Usuário logado (id e e-mail), ou null. Validado pelo JWT, uma vez por requisição. */
export const obterUsuario = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string | undefined) ?? "" };
});

/** Perfil do usuário logado, ou null se ainda não completou o cadastro. */
export const obterPerfil = cache(async (): Promise<Perfil | null> => {
  const usuario = await obterUsuario();
  if (!usuario) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("perfis").select("*").eq("id", usuario.id).maybeSingle();
  return data;
});

/** 'admin' | 'organizador' | null. A fonte da verdade é a função meu_papel() do banco. */
export const obterPapel = cache(async (): Promise<Papel | null> => {
  const usuario = await obterUsuario();
  if (!usuario) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("meu_papel");
  return data === "admin" || data === "organizador" ? data : null;
});

/** Exige login; senão manda para /entrar e volta para `proximo` depois. */
export async function exigirLogin(proximo: string) {
  const usuario = await obterUsuario();
  if (!usuario) redirect(`/entrar?proximo=${encodeURIComponent(proximo)}`);
  return usuario;
}

/** Exige login + cadastro completo (perfil). */
export async function exigirPerfil(proximo: string) {
  await exigirLogin(proximo);
  const perfil = await obterPerfil();
  if (!perfil) redirect(`/cadastro?proximo=${encodeURIComponent(proximo)}`);
  return perfil;
}

/**
 * Exige organizador. Use no topo de TODA server action e página do painel:
 * o layout de /painel protege a navegação, mas server actions podem ser
 * chamadas diretamente. A RLS do banco é a última barreira.
 */
export async function exigirOrganizador() {
  const usuario = await exigirLogin("/painel");
  const papel = await obterPapel();
  if (!papel) redirect("/");
  return { ...usuario, papel };
}
