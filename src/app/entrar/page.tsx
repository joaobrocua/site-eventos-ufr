import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterUsuario } from "@/lib/auth";
import { caminhoSeguro } from "@/lib/caminho";
import { FormEntrar } from "./form-entrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const { proximo } = await searchParams;
  const destino = caminhoSeguro(typeof proximo === "string" ? proximo : null, "/minha-area");

  if (await obterUsuario()) redirect(`/cadastro?proximo=${encodeURIComponent(destino)}`);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12 sm:py-20">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-muted-foreground">
          Sem senha: enviamos um código de 6 dígitos para o seu e-mail.
        </p>
      </div>
      <FormEntrar destino={destino} />
    </div>
  );
}
