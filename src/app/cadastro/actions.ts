"use server";

import { revalidatePath } from "next/cache";
import { obterUsuario } from "@/lib/auth";
import { mensagemDoErro, type ResultadoAcao } from "@/lib/erros";
import { perfilSchema } from "@/lib/schemas/perfil";
import { createClient } from "@/lib/supabase/server";

export async function salvarPerfil(entrada: unknown): Promise<ResultadoAcao> {
  const usuario = await obterUsuario();
  if (!usuario) return { ok: false, erro: "Sua sessão expirou. Entre novamente." };

  const valido = perfilSchema.safeParse(entrada);
  if (!valido.success) return { ok: false, erro: valido.error.issues[0].message };

  const supabase = await createClient();
  // email é preenchido pelo trigger do banco a partir de auth.users.
  const { error } = await supabase
    .from("perfis")
    .upsert({ id: usuario.id, email: "", ...valido.data }, { onConflict: "id" });

  if (error) return { ok: false, erro: mensagemDoErro(error) };

  revalidatePath("/", "layout");
  return { ok: true, dados: undefined };
}
