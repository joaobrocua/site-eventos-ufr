import type { Metadata } from "next";
import { exigirOrganizador } from "@/lib/auth";

export const metadata: Metadata = { title: "Painel da organização" };

// Toda página em /painel exige organizador. Server actions do painel devem
// chamar exigirOrganizador() de novo (podem ser invocadas sem passar por aqui).
export default async function LayoutPainel({ children }: LayoutProps<"/painel">) {
  await exigirOrganizador();

  return <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>;
}
