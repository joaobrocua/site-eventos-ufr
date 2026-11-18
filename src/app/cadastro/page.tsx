import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirLogin, obterPapel, obterPerfil } from "@/lib/auth";
import { caminhoSeguro } from "@/lib/caminho";
import { FormCadastro } from "./form-cadastro";

export const metadata: Metadata = { title: "Complete seu cadastro" };

const DESTINOS_SEM_CADASTRO = ["/minha-area/certificados", "/certificados"];

export default async function PaginaCadastro({ searchParams }: PageProps<"/cadastro">) {
  const { proximo, editar } = await searchParams;
  const destino = caminhoSeguro(typeof proximo === "string" ? proximo : null, "/minha-area");
  const usuario = await exigirLogin(`/cadastro?proximo=${encodeURIComponent(destino)}`);
  const perfil = await obterPerfil();

  // Já tem cadastro e não pediu para editar: segue para onde ia.
  if (perfil && editar !== "1") redirect(destino);
  // Organizador indo para o painel não precisa de cadastro de participante.
  if (!perfil && destino.startsWith("/painel") && (await obterPapel())) redirect(destino);
  // Equipe do evento (palestrante/monitor) baixa o certificado sem cadastro de
  // participante: essas páginas só exigem login.
  if (!perfil && DESTINOS_SEM_CADASTRO.some((p) => destino === p || destino.startsWith(`${p}/`))) {
    redirect(destino);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {perfil ? "Seus dados" : "Complete seu cadastro"}
        </h1>
        <p className="text-muted-foreground">
          Seu nome aparece no certificado exatamente como você escrever aqui.
        </p>
      </div>
      <FormCadastro email={usuario.email} perfil={perfil} destino={destino} />
    </div>
  );
}
